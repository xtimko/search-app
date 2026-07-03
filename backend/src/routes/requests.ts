import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db'
import { getCurrentSellerId } from './listings'

// Доска запросов «Ищу»: покупатель постит запрос → продавцы с подходящим стоком
// откликаются (отклик = чат с оффером). Матчинг: модель + размер + бюджет.

async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<number | null> {
  const id = await getCurrentSellerId(req)
  if (!id) {
    reply.code(401).send({ error: 'нужен вход через ВК' })
    return null
  }
  return id
}

const requestInclude = {
  buyer: { select: { id: true, nick: true, vkName: true, photo: true } },
  model: { select: { id: true, name: true, brand: { select: { name: true } }, category: { select: { name: true, slug: true } } } },
  _count: { select: { responses: true } },
} as const

// Подходит ли позиция под запрос по размеру (любое из полей размера).
function sizeMatches(l: { sizeUs: string | null; sizeEu: string | null; size: string | null }, wanted: string | null): boolean {
  if (!wanted) return true
  const w = wanted.trim().toLowerCase().replace(',', '.')
  return [l.sizeUs, l.sizeEu, l.size].some((s) => s != null && s.trim().toLowerCase().replace(',', '.') === w)
}

// Публичные матчи по запросу: что прямо сейчас есть в стоке у одобренных продавцов.
async function findMatches(request: { modelId: number; size: string | null; maxPrice: number | null }, limit = 10) {
  const candidates = await prisma.listing.findMany({
    where: {
      modelId: request.modelId,
      inStock: true,
      reserved: false,
      seller: { status: 'approved' },
      ...(request.maxPrice ? { price: { lte: request.maxPrice } } : {}),
    },
    orderBy: { price: 'asc' },
    take: 60,
    select: {
      id: true,
      price: true,
      sizeUs: true,
      sizeEu: true,
      size: true,
      colorway: true,
      condition: true,
      seller: { select: { id: true, nick: true, vkName: true } },
    },
  })
  return candidates.filter((l) => sizeMatches(l, request.size)).slice(0, limit)
}

export async function requestRoutes(app: FastifyInstance) {
  // POST /api/requests — создать запрос «Ищу». Сразу возвращает текущие матчи.
  app.post('/api/requests', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const b = (req.body ?? {}) as { modelId?: number; size?: string; maxPrice?: number; city?: string; comment?: string }
    if (!Number.isInteger(b.modelId)) return reply.code(400).send({ error: 'выбери модель из справочника' })
    const model = await prisma.model.count({ where: { id: b.modelId } })
    if (!model) return reply.code(404).send({ error: 'модель не найдена' })

    const active = await prisma.request.count({ where: { buyerId: me, status: 'active' } })
    if (active >= 10) return reply.code(400).send({ error: 'не больше 10 активных запросов' })

    const request = await prisma.request.create({
      data: {
        buyerId: me,
        modelId: b.modelId!,
        size: b.size?.trim() || null,
        maxPrice: b.maxPrice ? Math.round(Number(b.maxPrice)) : null,
        city: b.city?.trim() || null,
        comment: b.comment?.trim().slice(0, 500) || null,
      },
      include: requestInclude,
    })
    const matches = await findMatches(request)
    return reply.code(201).send({ ...request, matches })
  })

  // GET /api/requests?mine=1 — лента активных запросов (или мои все).
  // Для авторизованного продавца добавляет myMatchCount — сколько его позиций подходит.
  app.get<{ Querystring: { mine?: string } }>('/api/requests', async (req) => {
    const me = await getCurrentSellerId(req).catch(() => null)
    const mine = req.query.mine === '1'
    const requests = await prisma.request.findMany({
      where: mine && me ? { buyerId: me } : { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: requestInclude,
    })
    if (!me || requests.length === 0) return requests.map((r) => ({ ...r, myMatchCount: 0 }))

    // Мои позиции в наличии по моделям из ленты — матчим в памяти.
    const myListings = await prisma.listing.findMany({
      where: { sellerId: me, inStock: true, reserved: false, modelId: { in: [...new Set(requests.map((r) => r.modelId))] } },
      select: { id: true, modelId: true, sizeUs: true, sizeEu: true, size: true, price: true },
    })
    return requests.map((r) => ({
      ...r,
      myMatchCount:
        r.buyerId === me
          ? 0
          : myListings.filter(
              (l) => l.modelId === r.modelId && sizeMatches(l, r.size) && (!r.maxPrice || l.price <= r.maxPrice),
            ).length,
    }))
  })

  // GET /api/requests/:id/matches — публичные матчи (для автора запроса).
  app.get<{ Params: { id: string } }>('/api/requests/:id/matches', async (req, reply) => {
    const id = Number(req.params.id)
    const request = await prisma.request.findUnique({ where: { id }, select: { modelId: true, size: true, maxPrice: true } })
    if (!request) return reply.code(404).send({ error: 'запрос не найден' })
    return findMatches(request)
  })

  // GET /api/requests/:id/my-matches — мои подходящие позиции (для отклика продавца).
  app.get<{ Params: { id: string } }>('/api/requests/:id/my-matches', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const id = Number(req.params.id)
    const request = await prisma.request.findUnique({ where: { id }, select: { modelId: true, size: true, maxPrice: true } })
    if (!request) return reply.code(404).send({ error: 'запрос не найден' })
    const mine = await prisma.listing.findMany({
      where: { sellerId: me, modelId: request.modelId, inStock: true, reserved: false },
      select: { id: true, price: true, sizeUs: true, sizeEu: true, size: true, colorway: true, condition: true },
      orderBy: { price: 'asc' },
    })
    // сначала точные матчи по размеру, потом остальные позиции этой модели
    const exact = mine.filter((l) => sizeMatches(l, request.size))
    const rest = mine.filter((l) => !exact.includes(l))
    return { exact, rest }
  })

  // POST /api/requests/:id/respond { listingId } — отклик: чат с покупателем + оффер.
  app.post<{ Params: { id: string } }>('/api/requests/:id/respond', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const id = Number(req.params.id)
    const listingId = Number((req.body as { listingId?: number })?.listingId)
    if (!Number.isInteger(listingId)) return reply.code(400).send({ error: 'выбери позицию' })

    const request = await prisma.request.findUnique({ where: { id }, include: { model: { select: { name: true, brand: { select: { name: true } } } } } })
    if (!request || request.status !== 'active') return reply.code(404).send({ error: 'запрос не найден или закрыт' })
    if (request.buyerId === me) return reply.code(400).send({ error: 'это ваш запрос' })

    const listing = await prisma.listing.findUnique({ where: { id: listingId } })
    if (!listing || listing.sellerId !== me) return reply.code(404).send({ error: 'позиция не найдена' })
    if (listing.modelId !== request.modelId) return reply.code(400).send({ error: 'позиция другой модели' })
    if (!listing.inStock || listing.reserved) return reply.code(400).send({ error: 'позиция недоступна' })

    const dup = await prisma.requestResponse.count({ where: { requestId: id, listingId } })
    if (dup) return reply.code(400).send({ error: 'вы уже предлагали эту позицию' })

    // Чат по позиции с автором запроса + системное сообщение + оффер с ценой позиции.
    const conv = await prisma.conversation.upsert({
      where: { listingId_buyerId: { listingId, buyerId: request.buyerId } },
      update: {},
      create: { listingId, buyerId: request.buyerId, sellerId: me },
    })
    const size = listing.sizeUs ? `US ${listing.sizeUs}` : listing.sizeEu ? `EU ${listing.sizeEu}` : listing.size || ''
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: me,
          kind: 'system',
          text: `Отклик на запрос «${request.model.brand.name} ${request.model.name}${request.size ? ` · ${request.size}` : ''}»`,
        },
      }),
      prisma.message.updateMany({
        where: { conversationId: conv.id, kind: 'offer', offerStatus: 'active' },
        data: { offerStatus: 'superseded' },
      }),
      prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: me,
          kind: 'offer',
          offerPrice: listing.price,
          offerStatus: 'active',
          text: `Предложение: ${listing.price.toLocaleString('ru-RU')} ₽${size ? ` (${size})` : ''}`,
        },
      }),
      prisma.conversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } }),
      prisma.requestResponse.create({ data: { requestId: id, sellerId: me, listingId, conversationId: conv.id } }),
    ])
    return reply.code(201).send({ conversationId: conv.id })
  })

  // POST /api/requests/:id/close — закрыть свой запрос.
  app.post<{ Params: { id: string } }>('/api/requests/:id/close', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const id = Number(req.params.id)
    const request = await prisma.request.findUnique({ where: { id }, select: { buyerId: true, status: true } })
    if (!request || request.buyerId !== me) return reply.code(404).send({ error: 'запрос не найден' })
    if (request.status !== 'active') return reply.code(400).send({ error: 'запрос уже закрыт' })
    return prisma.request.update({ where: { id }, data: { status: 'closed' }, include: requestInclude })
  })
}
