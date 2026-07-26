import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { prisma } from '../db'
import { createSession, verifySession, SESSION_COOKIE } from '../session'
import { isAdminVkId } from './listings'

// VK ID OAuth 2.1 (PKCE): /login → id.vk.ru → /callback → сессия в httpOnly-cookie.
// Серверный (confidential) флоу: обмен кода делает бэкенд, VK-токены в браузер
// не попадают. Эндпоинты и параметры — по актуальной доке id.vk.ru.
// Настройка в кабинете VK ID: доверенный redirect URL = https://<домен>/api/auth/vk/callback.
const VKID_AUTH = 'https://id.vk.ru/authorize'
const VKID_TOKEN = 'https://id.vk.ru/oauth2/auth'
const VKID_USERINFO = 'https://id.vk.ru/oauth2/user_info'
const PKCE_COOKIE = 'sa_pkce'

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

const isProd = process.env.NODE_ENV === 'production'

// service_token («Сервисный ключ доступа» из кабинета) — для конфиденциальных
// приложений при обмене кода. VK_APP_SECRET оставлен как back-compat алиас.
const serviceToken = process.env.VK_SERVICE_TOKEN || process.env.VK_APP_SECRET || ''

// redirect_uri ДОЛЖЕН точно совпадать с зарегистрированным в кабинете VK ID.
// Явный VK_REDIRECT_URI надёжнее вывода из заголовков (за прокси); дефолт — для dev.
function redirectUri(req: { protocol: string; host: string }): string {
  return process.env.VK_REDIRECT_URI || `${req.protocol}://${req.host}/api/auth/vk/callback`
}

const sellerSelect = {
  id: true,
  nick: true,
  vkName: true,
  photo: true,
  contact: true,
  city: true,
  experience: true,
  description: true,
  status: true,
  verified: true,
} as const

export async function authRoutes(app: FastifyInstance) {
  // Шаг 1: редирект на VK ID с PKCE.
  app.get('/api/auth/vk/login', async (req, reply) => {
    const clientId = process.env.VK_APP_ID
    if (!clientId) return reply.code(500).send({ error: 'VK_APP_ID не задан' })

    // PKCE: verifier 43 симв. (43–128 по RFC 7636), state ≥32 симв. (требование VK ID).
    const verifier = b64url(crypto.randomBytes(32))
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
    const state = b64url(crypto.randomBytes(32))

    reply.setCookie(PKCE_COOKIE, `${verifier}.${state}`, {
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 600,
    })

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri(req),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256', // регистр важен (RFC 7636 / VK ID)
    })
    return reply.redirect(`${VKID_AUTH}?${params.toString()}`)
  })

  // Шаг 2: обмен кода на токен, профиль, сессия.
  app.get<{ Querystring: { code?: string; state?: string; device_id?: string } }>(
    '/api/auth/vk/callback',
    async (req, reply) => {
      const clientId = process.env.VK_APP_ID
      const { code, state, device_id } = req.query
      const pkce = req.cookies[PKCE_COOKIE]
      reply.clearCookie(PKCE_COOKIE, { path: '/api/auth' })

      if (!clientId || !code || !state || !pkce) return reply.redirect('/?auth=failed')
      const [verifier, savedState] = pkce.split('.')
      if (!verifier || savedState !== state) return reply.redirect('/?auth=failed') // CSRF-защита

      // Обмен кода на токены. VK ID использует PKCE (code_verifier), а не
      // client_secret; конфиденциальному приложению нужен service_token.
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        client_id: clientId,
        device_id: device_id ?? '', // VK ID возвращает его в callback и требует при обмене
        redirect_uri: redirectUri(req),
        state,
      })
      if (serviceToken) body.set('service_token', serviceToken)

      try {
        // Таймаут на запросы к VK: иначе при недоступности id.vk.ru колбэк
        // висит бесконечно (браузер «крутит»), вместо понятной ошибки.
        const tokenRes = await fetch(VKID_TOKEN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: AbortSignal.timeout(10_000),
        })
        // Ответ содержит access_token, refresh_token, id_token, expires_in, user_id…
        // Нам нужен только профиль при входе — refresh/id-токены не храним
        // (сессия самодостаточна; id-token несёт лишь маскированные данные).
        const token = (await tokenRes.json()) as { access_token?: string; user_id?: string | number; error?: string; error_description?: string }
        if (!token.access_token || token.user_id == null) {
          req.log.error({ status: tokenRes.status, token }, 'vk id: обмен кода не удался')
          return reply.redirect('/?auth=failed&reason=token')
        }

        const infoRes = await fetch(VKID_USERINFO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ access_token: token.access_token, client_id: clientId }),
          signal: AbortSignal.timeout(10_000),
        })
        const info = (await infoRes.json()) as {
          user?: { first_name?: string; last_name?: string; avatar?: string }
        }
        const vkId = BigInt(token.user_id)
        const vkName = [info.user?.first_name, info.user?.last_name].filter(Boolean).join(' ') || null
        const photo = info.user?.avatar || null

        await prisma.seller.upsert({
          where: { vkId },
          update: { ...(vkName ? { vkName } : {}), ...(photo ? { photo } : {}) },
          create: {
            vkId,
            nick: vkName || `Продавец ${vkId}`,
            vkName,
            photo,
            contact: `https://vk.com/id${vkId}`,
            status: 'pending',
          },
        })

        reply.setCookie(SESSION_COOKIE, createSession(vkId), {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: isProd,
          maxAge: 30 * 24 * 60 * 60,
        })
        return reply.redirect('/')
      } catch (e) {
        // Таймаут/сеть до id.vk.ru или неожиданный ответ — не висим, а падаем с логом.
        const reason = e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'exchange'
        req.log.error({ err: e, reason }, 'vk id: ошибка обмена')
        return reply.redirect(`/?auth=failed&reason=${reason}`)
      }
    },
  )

  // Текущий пользователь: сессия → профиль; в dev без сессии — dev-продавец.
  app.get('/api/auth/me', async (req, reply) => {
    const vkId = verifySession(req.cookies[SESSION_COOKIE])
    if (vkId) {
      const seller = await prisma.seller.findUnique({ where: { vkId }, select: sellerSelect })
      if (seller) return { ...seller, vkId: vkId.toString(), isAdmin: isAdminVkId(vkId), dev: false }
    }
    if (!isProd) {
      const dev = await prisma.seller.findUnique({ where: { vkId: 1n }, select: sellerSelect })
      if (dev) return { ...dev, vkId: '1', isAdmin: isAdminVkId(1n), dev: true }
    }
    return reply.code(401).send({ error: 'нужен вход через ВК' })
  })

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  })

  // Тестовый вход по имени. ВЫКЛЮЧЕН по умолчанию (VK ID подключён) — включается
  // только явным ALLOW_TEST_LOGIN=1 (аварийный доступ на время проверки VK).
  // vkId — из дальнего диапазона (9e12+), чтобы не пересечься с реальными VK ID.
  // Повторный вход с тем же именем возвращает тот же тестовый аккаунт.
  app.post('/api/auth/test-login', async (req, reply) => {
    const enabled = process.env.ALLOW_TEST_LOGIN === '1'
    if (!enabled) return reply.code(403).send({ error: 'тестовый вход отключён' })

    const name = String((req.body as { name?: string })?.name ?? '').trim().slice(0, 40)
    if (name.length < 2) return reply.code(400).send({ error: 'укажи имя (мин. 2 символа)' })

    const vkName = `${name} (тест)`
    let seller = await prisma.seller.findFirst({ where: { vkName } })
    if (!seller) {
      const vkId = 9_000_000_000_000n + BigInt(crypto.randomInt(1, 2_000_000_000))
      seller = await prisma.seller.create({
        data: { vkId, nick: name, vkName, photo: null, contact: 'укажи контакт в профиле', status: 'approved' },
      })
    }

    reply.setCookie(SESSION_COOKIE, createSession(seller.vkId), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 30 * 24 * 60 * 60,
    })
    return { ok: true }
  })
}
