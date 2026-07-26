import type { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '../db'
import { verifyVkLaunch } from '../vkAuth'
import { verifySession, SESSION_COOKIE } from '../session'

// Текущий продавец: сессия VK ID (cookie) → launch-параметры Mini App (заголовок
// x-vk-params, подпись проверяется секретом) → в dev-режиме общий dev-продавец.
// В проде без авторизации — null (эндпоинты отвечают 401).
function header(req: FastifyRequest, name: string): string | undefined {
  const v = req.headers[name]
  return Array.isArray(v) ? v[0] : v
}

function vkIdentity(req: FastifyRequest): { vkId: bigint; nick: string } | null {
  const sessionVkId = verifySession(req.cookies?.[SESSION_COOKIE])
  if (sessionVkId) return { vkId: sessionVkId, nick: `Продавец ${sessionVkId}` }

  const params = header(req, 'x-vk-params')
  const uid = params ? verifyVkLaunch(params) : null
  if (uid) {
    const name = header(req, 'x-vk-user-name')
    return { vkId: BigInt(uid), nick: name ? decodeURIComponent(name) : `Продавец ${uid}` }
  }

  if (process.env.NODE_ENV !== 'production') return { vkId: 1n, nick: 'dev-продавец' }
  return null
}

// vkId текущего пользователя из сессии (без записи в БД) — для проверки прав.
export function currentVkId(req: FastifyRequest): bigint | null {
  return vkIdentity(req)?.vkId ?? null
}

// Админ = vkId в списке ADMIN_VK_IDS (env, через запятую). В dev — dev-продавец
// (vkId 1) тоже админ для локальной отладки. Никаких общих токенов.
export function isAdminVkId(vkId: bigint): boolean {
  const ids = (process.env.ADMIN_VK_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (ids.includes(vkId.toString())) return true
  if (process.env.NODE_ENV !== 'production' && vkId === 1n) return true
  return false
}

export async function getCurrentSellerId(req: FastifyRequest): Promise<number | null> {
  const identity = vkIdentity(req)
  if (!identity) return null
  const { vkId, nick } = identity
  const seller = await prisma.seller.upsert({
    where: { vkId },
    update: {},
    create: {
      vkId,
      nick,
      contact: `https://vk.com/id${vkId}`,
      status: vkId === 1n ? 'approved' : 'pending',
    },
  })
  return seller.id
}

interface CreateListingBody {
  modelId?: number
  sizes?: string[] // несколько размеров за раз → по позиции на размер
  sizeUs?: string
  sizeEu?: string
  size?: string
  colorway?: string
  condition?: 'new' | 'used'
  hasBox?: boolean
  fitting?: boolean
  price?: number
  city?: string
  photo?: string
  comment?: string
}

interface UpdateListingBody {
  inStock?: boolean
  price?: number
  sizeUs?: string
  sizeEu?: string
  size?: string
  colorway?: string
  condition?: 'new' | 'used'
  hasBox?: boolean
  fitting?: boolean
  city?: string
  photo?: string
  comment?: string
}

const listingSelect = {
  id: true,
  sizeUs: true,
  sizeEu: true,
  size: true,
  colorway: true,
  condition: true,
  hasBox: true,
  fitting: true,
  price: true,
  city: true,
  inStock: true,
  reserved: true,
  createdAt: true,
  model: {
    select: {
      id: true,
      name: true,
      brand: { select: { name: true } },
      category: { select: { name: true, slug: true } },
    },
  },
} as const

export async function listingRoutes(app: FastifyInstance) {
  // POST /api/listings — добавить позицию в сток (от текущего продавца).
  app.post('/api/listings', async (req, reply) => {
    const b = (req.body ?? {}) as CreateListingBody
    if (typeof b.modelId !== 'number') {
      return reply.code(400).send({ error: 'modelId обязателен' })
    }
    if (typeof b.price !== 'number' || b.price <= 0) {
      return reply.code(400).send({ error: 'price должен быть числом > 0' })
    }
    const model = await prisma.model.findUnique({
      where: { id: b.modelId },
      select: { id: true, category: { select: { slug: true } } },
    })
    if (!model) {
      return reply.code(404).send({ error: 'модель не найдена' })
    }

    const sellerId = await getCurrentSellerId(req)
    if (!sellerId) return reply.code(401).send({ error: 'нужен вход через ВК' })
    const isFootwear = model.category.slug === 'footwear'
    const base = {
      sellerId,
      modelId: b.modelId,
      colorway: b.colorway?.trim() || null,
      condition: (b.condition === 'used' ? 'used' : 'new') as 'new' | 'used',
      hasBox: b.hasBox ?? true,
      fitting: b.fitting ?? false,
      price: Math.round(b.price),
      city: b.city?.trim() || null,
      photo: b.photo?.trim() || null,
      comment: b.comment?.trim() || null,
    }

    // Несколько размеров → по позиции на каждый (обувь → sizeUs, иначе → size).
    const sizes = Array.isArray(b.sizes) ? b.sizes.map((s) => String(s).trim()).filter(Boolean) : []
    if (sizes.length) {
      const data = sizes.map((s) => ({ ...base, sizeUs: isFootwear ? s : null, sizeEu: null, size: isFootwear ? null : s }))
      const res = await prisma.listing.createMany({ data })
      return reply.code(201).send({ created: res.count })
    }

    const listing = await prisma.listing.create({
      data: { ...base, sizeUs: b.sizeUs?.trim() || null, sizeEu: b.sizeEu?.trim() || null, size: b.size?.trim() || null },
      select: listingSelect,
    })
    return reply.code(201).send(listing)
  })

  // GET /api/listings — мои позиции (текущего продавца), новые сверху.
  app.get('/api/listings', async (req, reply) => {
    const sellerId = await getCurrentSellerId(req)
    if (!sellerId) return reply.code(401).send({ error: 'нужен вход через ВК' })
    return prisma.listing.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      select: listingSelect,
    })
  })

  // PATCH /api/listings/:id — частичное обновление (в т.ч. «продано»: inStock).
  app.patch<{ Params: { id: string } }>('/api/listings/:id', async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'некорректный id' })

    const sellerId = await getCurrentSellerId(req)
    if (!sellerId) return reply.code(401).send({ error: 'нужен вход через ВК' })
    const existing = await prisma.listing.findUnique({ where: { id } })
    if (!existing || existing.sellerId !== sellerId) {
      return reply.code(404).send({ error: 'позиция не найдена' })
    }
    if (existing.reserved) return reply.code(400).send({ error: 'позиция в открытой сделке — сначала заверши или отмени её' })

    const b = (req.body ?? {}) as UpdateListingBody
    const data: {
      inStock?: boolean
      price?: number
      sizeUs?: string | null
      sizeEu?: string | null
      size?: string | null
      colorway?: string | null
      condition?: 'new' | 'used'
      hasBox?: boolean
      fitting?: boolean
      city?: string | null
      photo?: string | null
      comment?: string | null
    } = {}

    if (b.inStock !== undefined) data.inStock = b.inStock
    if (b.price !== undefined) {
      if (typeof b.price !== 'number' || b.price <= 0) {
        return reply.code(400).send({ error: 'price должен быть числом > 0' })
      }
      data.price = Math.round(b.price)
    }
    if (b.sizeUs !== undefined) data.sizeUs = b.sizeUs?.trim() || null
    if (b.sizeEu !== undefined) data.sizeEu = b.sizeEu?.trim() || null
    if (b.size !== undefined) data.size = b.size?.trim() || null
    if (b.colorway !== undefined) data.colorway = b.colorway?.trim() || null
    if (b.condition !== undefined) data.condition = b.condition === 'used' ? 'used' : 'new'
    if (b.hasBox !== undefined) data.hasBox = b.hasBox
    if (b.fitting !== undefined) data.fitting = b.fitting
    if (b.city !== undefined) data.city = b.city?.trim() || null
    if (b.photo !== undefined) data.photo = b.photo?.trim() || null
    if (b.comment !== undefined) data.comment = b.comment?.trim() || null

    const updated = await prisma.listing.update({ where: { id }, data, select: listingSelect })
    return updated
  })

  // DELETE /api/listings/:id — удалить позицию.
  app.delete<{ Params: { id: string } }>('/api/listings/:id', async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'некорректный id' })

    const sellerId = await getCurrentSellerId(req)
    if (!sellerId) return reply.code(401).send({ error: 'нужен вход через ВК' })
    const existing = await prisma.listing.findUnique({ where: { id } })
    if (!existing || existing.sellerId !== sellerId) {
      return reply.code(404).send({ error: 'позиция не найдена' })
    }
    if (existing.reserved) return reply.code(400).send({ error: 'позиция в открытой сделке — сначала заверши или отмени её' })
    await prisma.listing.delete({ where: { id } })
    return reply.code(204).send()
  })
}
