import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { prisma } from '../db'
import { createSession, verifySession, SESSION_COOKIE } from '../session'

// VK ID OAuth 2.1 (PKCE): /login → id.vk.com → /callback → сессия в httpOnly-cookie.
// Настройка в кабинете VK ID: redirect URL = https://<домен>/api/auth/vk/callback.

const VKID_AUTH = 'https://id.vk.com/authorize'
const VKID_TOKEN = 'https://id.vk.com/oauth2/auth'
const VKID_USERINFO = 'https://id.vk.com/oauth2/user_info'
const PKCE_COOKIE = 'sa_pkce'

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

const isProd = process.env.NODE_ENV === 'production'

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
} as const

export async function authRoutes(app: FastifyInstance) {
  // Шаг 1: редирект на VK ID с PKCE.
  app.get('/api/auth/vk/login', async (req, reply) => {
    const clientId = process.env.VK_APP_ID
    if (!clientId) return reply.code(500).send({ error: 'VK_APP_ID не задан' })

    const verifier = b64url(crypto.randomBytes(32))
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
    const state = b64url(crypto.randomBytes(16))
    const redirectUri = `${req.protocol}://${req.host}/api/auth/vk/callback`

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
      redirect_uri: redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: 's256',
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
      if (!verifier || savedState !== state) return reply.redirect('/?auth=failed')

      const redirectUri = `${req.protocol}://${req.host}/api/auth/vk/callback`
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        client_id: clientId,
        device_id: device_id ?? '',
        redirect_uri: redirectUri,
        state,
      })
      if (process.env.VK_APP_SECRET) body.set('client_secret', process.env.VK_APP_SECRET)

      try {
        const tokenRes = await fetch(VKID_TOKEN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        })
        const token = (await tokenRes.json()) as { access_token?: string; user_id?: number; error?: string }
        if (!token.access_token || !token.user_id) {
          req.log.error({ token }, 'vk id: обмен кода не удался')
          return reply.redirect('/?auth=failed')
        }

        const infoRes = await fetch(VKID_USERINFO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ access_token: token.access_token, client_id: clientId }),
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
        req.log.error(e, 'vk id: ошибка обмена')
        return reply.redirect('/?auth=failed')
      }
    },
  )

  // Текущий пользователь: сессия → профиль; в dev без сессии — dev-продавец.
  app.get('/api/auth/me', async (req, reply) => {
    const vkId = verifySession(req.cookies[SESSION_COOKIE])
    if (vkId) {
      const seller = await prisma.seller.findUnique({ where: { vkId }, select: sellerSelect })
      if (seller) return { ...seller, dev: false }
    }
    if (!isProd) {
      const dev = await prisma.seller.findUnique({ where: { vkId: 1n }, select: sellerSelect })
      if (dev) return { ...dev, dev: true }
    }
    return reply.code(401).send({ error: 'нужен вход через ВК' })
  })

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  })

  // ВРЕМЕННО (до подключения VK ID): тестовый вход по имени. Включён по умолчанию;
  // выключение — ALLOW_TEST_LOGIN=0 (сделать при запуске VK ID). vkId — из дальнего
  // диапазона (9e12+), чтобы не пересечься с реальными VK ID. Повторный вход
  // с тем же именем возвращает тот же тестовый аккаунт.
  app.post('/api/auth/test-login', async (req, reply) => {
    const enabled = process.env.ALLOW_TEST_LOGIN !== '0'
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
