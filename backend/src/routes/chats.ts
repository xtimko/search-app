import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db'
import { getCurrentSellerId } from './listings'

// Встроенные чаты: диалог привязан к товару, обновление — поллингом с фронта.

const peerSelect = { id: true, nick: true, vkName: true, photo: true, status: true, verified: true } as const

const convInclude = (me: number) =>
  ({
    listing: {
      select: {
        id: true,
        price: true,
        sizeUs: true,
        sizeEu: true,
        size: true,
        colorway: true,
        inStock: true,
        reserved: true,
        model: { select: { name: true, brand: { select: { name: true } } } },
      },
    },
    buyer: { select: peerSelect },
    seller: { select: peerSelect },
    messages: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { text: true, senderId: true, createdAt: true } },
    deals: { where: { status: 'open' as const }, take: 1, include: { guarantorRef: { select: { id: true, name: true, contact: true, note: true } } } },
    _count: { select: { messages: { where: { readAt: null, NOT: { senderId: me } } } } },
  }) as const

async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<number | null> {
  const id = await getCurrentSellerId(req)
  if (!id) {
    reply.code(401).send({ error: 'нужен вход через ВК' })
    return null
  }
  return id
}

export async function chatRoutes(app: FastifyInstance) {
  // POST /api/chats { listingId } — открыть (или найти) диалог по товару.
  app.post('/api/chats', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const listingId = Number((req.body as { listingId?: number })?.listingId)
    if (!Number.isInteger(listingId)) return reply.code(400).send({ error: 'listingId обязателен' })

    const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { sellerId: true } })
    if (!listing) return reply.code(404).send({ error: 'товар не найден' })
    if (listing.sellerId === me) return reply.code(400).send({ error: 'это ваш товар' })

    const conv = await prisma.conversation.upsert({
      where: { listingId_buyerId: { listingId, buyerId: me } },
      update: {},
      create: { listingId, buyerId: me, sellerId: listing.sellerId },
      include: convInclude(me),
    })
    return conv
  })

  // GET /api/chats — мои диалоги (как покупатель и как продавец).
  app.get('/api/chats', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    return prisma.conversation.findMany({
      where: { OR: [{ buyerId: me }, { sellerId: me }] },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: convInclude(me),
    })
  })

  // GET /api/chats/unread — суммарный счётчик непрочитанных (для бейджа).
  app.get('/api/chats/unread', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const count = await prisma.message.count({
      where: {
        readAt: null,
        NOT: { senderId: me },
        conversation: { OR: [{ buyerId: me }, { sellerId: me }] },
      },
    })
    return { count }
  })

  // GET /api/chats/:id/messages — сообщения диалога (+ пометить входящие прочитанными).
  app.get<{ Params: { id: string } }>('/api/chats/:id/messages', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const id = Number(req.params.id)
    const conv = await prisma.conversation.findUnique({ where: { id }, select: { buyerId: true, sellerId: true } })
    if (!conv || (conv.buyerId !== me && conv.sellerId !== me)) return reply.code(404).send({ error: 'диалог не найден' })

    await prisma.message.updateMany({
      where: { conversationId: id, readAt: null, NOT: { senderId: me } },
      data: { readAt: new Date() },
    })
    return prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      take: 300,
      select: { id: true, senderId: true, text: true, kind: true, offerPrice: true, offerStatus: true, createdAt: true, readAt: true },
    })
  })

  // POST /api/chats/:id/messages { text } — отправить сообщение.
  app.post<{ Params: { id: string } }>('/api/chats/:id/messages', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const id = Number(req.params.id)
    const text = String((req.body as { text?: string })?.text ?? '').trim()
    if (!text) return reply.code(400).send({ error: 'пустое сообщение' })
    if (text.length > 2000) return reply.code(400).send({ error: 'слишком длинное сообщение (макс 2000)' })

    const conv = await prisma.conversation.findUnique({ where: { id }, select: { buyerId: true, sellerId: true } })
    if (!conv || (conv.buyerId !== me && conv.sellerId !== me)) return reply.code(404).send({ error: 'диалог не найден' })

    const [msg] = await prisma.$transaction([
      prisma.message.create({
        data: { conversationId: id, senderId: me, text },
        select: { id: true, senderId: true, text: true, kind: true, offerPrice: true, offerStatus: true, createdAt: true, readAt: true },
      }),
      prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } }),
    ])
    return reply.code(201).send(msg)
  })
}
