import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db'
import { getCurrentSellerId } from './listings'

// Сделки: оффер (цена) в чате → принятие = сделка + резерв позиции →
// оба подтвердили = «продано»; отмена = резерв снят. Всё с системными сообщениями.

async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<number | null> {
  const id = await getCurrentSellerId(req)
  if (!id) {
    reply.code(401).send({ error: 'нужен вход через ВК' })
    return null
  }
  return id
}

const dealInclude = {
  listing: {
    select: {
      id: true,
      sizeUs: true,
      sizeEu: true,
      size: true,
      colorway: true,
      model: { select: { name: true, brand: { select: { name: true } } } },
    },
  },
  buyer: { select: { id: true, nick: true, vkName: true, photo: true } },
  seller: { select: { id: true, nick: true, vkName: true, photo: true } },
  review: { select: { id: true, rating: true } },
} as const

function fmtPrice(p: number): string {
  return `${p.toLocaleString('ru-RU')} ₽`
}

export async function dealRoutes(app: FastifyInstance) {
  // POST /api/chats/:id/offer { price } — предложение цены в диалоге.
  app.post<{ Params: { id: string } }>('/api/chats/:id/offer', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const chatId = Number(req.params.id)
    const price = Math.round(Number((req.body as { price?: number })?.price))
    if (!price || price <= 0) return reply.code(400).send({ error: 'некорректная цена' })

    const conv = await prisma.conversation.findUnique({
      where: { id: chatId },
      select: { buyerId: true, sellerId: true, listingId: true, listing: { select: { inStock: true, reserved: true } } },
    })
    if (!conv || (conv.buyerId !== me && conv.sellerId !== me)) return reply.code(404).send({ error: 'диалог не найден' })
    if (!conv.listing.inStock) return reply.code(400).send({ error: 'позиция уже продана' })

    const openDeal = await prisma.deal.count({ where: { listingId: conv.listingId, status: 'open' } })
    if (openDeal) return reply.code(400).send({ error: 'по этой позиции уже открыта сделка' })

    const [, msg] = await prisma.$transaction([
      // новый оффер отменяет предыдущие активные в этом диалоге
      prisma.message.updateMany({
        where: { conversationId: chatId, kind: 'offer', offerStatus: 'active' },
        data: { offerStatus: 'superseded' },
      }),
      prisma.message.create({
        data: { conversationId: chatId, senderId: me, kind: 'offer', offerPrice: price, offerStatus: 'active', text: `Предложение: ${fmtPrice(price)}` },
      }),
      prisma.conversation.update({ where: { id: chatId }, data: { updatedAt: new Date() } }),
    ])
    return reply.code(201).send(msg)
  })

  // POST /api/chats/:id/offers/:messageId/accept — принять оффер (вторая сторона).
  app.post<{ Params: { id: string; messageId: string } }>('/api/chats/:id/offers/:messageId/accept', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const chatId = Number(req.params.id)
    const messageId = Number(req.params.messageId)

    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        senderId: true,
        kind: true,
        offerPrice: true,
        offerStatus: true,
        conversationId: true,
        conversation: { select: { buyerId: true, sellerId: true, listingId: true, listing: { select: { inStock: true, reserved: true } } } },
      },
    })
    const conv = msg?.conversation
    if (!msg || !conv || msg.conversationId !== chatId || (conv.buyerId !== me && conv.sellerId !== me))
      return reply.code(404).send({ error: 'оффер не найден' })
    if (msg.kind !== 'offer' || msg.offerStatus !== 'active') return reply.code(400).send({ error: 'оффер неактуален' })
    if (msg.senderId === me) return reply.code(400).send({ error: 'нельзя принять свой оффер' })
    if (!conv.listing.inStock) return reply.code(400).send({ error: 'позиция уже продана' })
    if (conv.listing.reserved) return reply.code(400).send({ error: 'позиция уже в сделке' })

    const [deal] = await prisma.$transaction([
      prisma.deal.create({
        data: {
          conversationId: chatId,
          listingId: conv.listingId,
          buyerId: conv.buyerId,
          sellerId: conv.sellerId,
          price: msg.offerPrice!,
        },
        include: dealInclude,
      }),
      prisma.message.update({ where: { id: messageId }, data: { offerStatus: 'accepted' } }),
      prisma.listing.update({ where: { id: conv.listingId }, data: { reserved: true } }),
      prisma.message.create({
        data: {
          conversationId: chatId,
          senderId: me,
          kind: 'system',
          text: `Сделка открыта за ${fmtPrice(msg.offerPrice!)}. Позиция в резерве. Оба участника подтверждают завершение.`,
        },
      }),
      prisma.conversation.update({ where: { id: chatId }, data: { updatedAt: new Date() } }),
    ])
    return reply.code(201).send(deal)
  })

  // POST /api/chats/:id/offers/:messageId/decline — отклонить оффер.
  app.post<{ Params: { id: string; messageId: string } }>('/api/chats/:id/offers/:messageId/decline', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const chatId = Number(req.params.id)
    const messageId = Number(req.params.messageId)
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, kind: true, offerStatus: true, conversationId: true, conversation: { select: { buyerId: true, sellerId: true } } },
    })
    if (!msg || msg.conversationId !== chatId || (msg.conversation.buyerId !== me && msg.conversation.sellerId !== me))
      return reply.code(404).send({ error: 'оффер не найден' })
    if (msg.kind !== 'offer' || msg.offerStatus !== 'active') return reply.code(400).send({ error: 'оффер неактуален' })
    if (msg.senderId === me) return reply.code(400).send({ error: 'нельзя отклонить свой оффер' })

    await prisma.$transaction([
      prisma.message.update({ where: { id: messageId }, data: { offerStatus: 'declined' } }),
      prisma.message.create({ data: { conversationId: chatId, senderId: me, kind: 'system', text: 'Предложение отклонено.' } }),
      prisma.conversation.update({ where: { id: chatId }, data: { updatedAt: new Date() } }),
    ])
    return { ok: true }
  })

  // GET /api/deals — мои сделки (обе роли), новые сверху.
  app.get('/api/deals', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    return prisma.deal.findMany({
      where: { OR: [{ buyerId: me }, { sellerId: me }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: dealInclude,
    })
  })

  // POST /api/deals/:id/confirm — подтвердить завершение (моя сторона).
  app.post<{ Params: { id: string } }>('/api/deals/:id/confirm', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const id = Number(req.params.id)
    const deal = await prisma.deal.findUnique({ where: { id } })
    if (!deal || (deal.buyerId !== me && deal.sellerId !== me)) return reply.code(404).send({ error: 'сделка не найдена' })
    if (deal.status !== 'open') return reply.code(400).send({ error: 'сделка уже закрыта' })

    const isBuyer = deal.buyerId === me
    const buyerConfirmed = deal.buyerConfirmed || isBuyer
    const sellerConfirmed = deal.sellerConfirmed || !isBuyer
    const done = buyerConfirmed && sellerConfirmed

    const ops = [
      prisma.deal.update({
        where: { id },
        data: { buyerConfirmed, sellerConfirmed, ...(done ? { status: 'completed' as const, closedAt: new Date() } : {}) },
        include: dealInclude,
      }),
      prisma.message.create({
        data: {
          conversationId: deal.conversationId,
          senderId: me,
          kind: 'system',
          text: done
            ? `Сделка завершена за ${fmtPrice(deal.price)}. Позиция снята с продажи.`
            : `${isBuyer ? 'Покупатель' : 'Продавец'} подтвердил сделку. Ждём вторую сторону.`,
        },
      }),
      prisma.conversation.update({ where: { id: deal.conversationId }, data: { updatedAt: new Date() } }),
    ]
    if (done) ops.push(prisma.listing.update({ where: { id: deal.listingId }, data: { inStock: false, reserved: false } }) as never)

    const [updated] = await prisma.$transaction(ops)
    return updated
  })

  // POST /api/deals/:id/review { rating, text? } — отзыв покупателя по завершённой сделке.
  app.post<{ Params: { id: string } }>('/api/deals/:id/review', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const id = Number(req.params.id)
    const body = (req.body ?? {}) as { rating?: number; text?: string }
    const rating = Math.round(Number(body.rating))
    if (!rating || rating < 1 || rating > 5) return reply.code(400).send({ error: 'оценка — от 1 до 5' })
    const text = String(body.text ?? '').trim().slice(0, 1000) || null

    const deal = await prisma.deal.findUnique({ where: { id }, select: { buyerId: true, sellerId: true, status: true } })
    if (!deal || deal.buyerId !== me) return reply.code(404).send({ error: 'сделка не найдена' })
    if (deal.status !== 'completed') return reply.code(400).send({ error: 'отзыв — только по завершённой сделке' })
    const exists = await prisma.review.count({ where: { dealId: id } })
    if (exists) return reply.code(400).send({ error: 'отзыв уже оставлен' })

    const review = await prisma.review.create({
      data: { dealId: id, sellerId: deal.sellerId, authorId: me, rating, text },
    })
    return reply.code(201).send(review)
  })

  // POST /api/deals/:id/cancel — отменить открытую сделку (любая сторона).
  app.post<{ Params: { id: string } }>('/api/deals/:id/cancel', async (req, reply) => {
    const me = await requireAuth(req, reply)
    if (!me) return
    const id = Number(req.params.id)
    const deal = await prisma.deal.findUnique({ where: { id } })
    if (!deal || (deal.buyerId !== me && deal.sellerId !== me)) return reply.code(404).send({ error: 'сделка не найдена' })
    if (deal.status !== 'open') return reply.code(400).send({ error: 'сделка уже закрыта' })

    const [updated] = await prisma.$transaction([
      prisma.deal.update({ where: { id }, data: { status: 'cancelled', closedAt: new Date() }, include: dealInclude }),
      prisma.listing.update({ where: { id: deal.listingId }, data: { reserved: false } }),
      prisma.message.create({
        data: { conversationId: deal.conversationId, senderId: me, kind: 'system', text: 'Сделка отменена. Позиция снова в продаже.' },
      }),
      prisma.conversation.update({ where: { id: deal.conversationId }, data: { updatedAt: new Date() } }),
    ])
    return updated
  })
}
