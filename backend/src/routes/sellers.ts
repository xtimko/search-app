import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'

// Публичный профиль продавца: метрики из реальных данных (отзывы, сделки,
// скорость ответа) + последние отзывы + товары в наличии.

function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

// Медиана времени первого ответа продавца (в минутах) по его диалогам.
async function medianResponseMinutes(sellerId: number): Promise<number | null> {
  const convs = await prisma.conversation.findMany({
    where: { sellerId },
    take: 200,
    select: {
      buyerId: true,
      messages: { orderBy: { createdAt: 'asc' }, take: 30, select: { senderId: true, createdAt: true } },
    },
  })
  const deltas: number[] = []
  for (const c of convs) {
    const first = c.messages.find((m) => m.senderId === c.buyerId)
    if (!first) continue
    const answer = c.messages.find((m) => m.senderId === sellerId && m.createdAt > first.createdAt)
    if (!answer) continue
    deltas.push(Math.round((answer.createdAt.getTime() - first.createdAt.getTime()) / 60000))
  }
  return median(deltas)
}

export interface SellerStats {
  avgRating: number | null
  reviewsCount: number
  dealsCompleted: number
  completionRate: number | null // 0..100, если закрытых сделок >= 3
  medianResponseMin: number | null
}

export async function computeSellerStats(sellerId: number): Promise<SellerStats> {
  const [agg, completed, cancelled, medianMin] = await Promise.all([
    prisma.review.aggregate({ where: { sellerId }, _avg: { rating: true }, _count: true }),
    prisma.deal.count({ where: { sellerId, status: 'completed' } }),
    prisma.deal.count({ where: { sellerId, status: 'cancelled' } }),
    medianResponseMinutes(sellerId),
  ])
  const closed = completed + cancelled
  return {
    avgRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    reviewsCount: agg._count,
    dealsCompleted: completed,
    completionRate: closed >= 3 ? Math.round((completed / closed) * 100) : null,
    medianResponseMin: medianMin,
  }
}

export async function sellerRoutesPublic(app: FastifyInstance) {
  // GET /api/sellers/:id/profile — публичная карточка продавца.
  app.get<{ Params: { id: string } }>('/api/sellers/:id/profile', async (req, reply) => {
    const id = Number(req.params.id)
    const seller = await prisma.seller.findUnique({
      where: { id },
      select: {
        id: true,
        nick: true,
        vkName: true,
        photo: true,
        city: true,
        experience: true,
        description: true,
        status: true,
        createdAt: true,
      },
    })
    if (!seller) return reply.code(404).send({ error: 'продавец не найден' })

    const [stats, reviews, listings] = await Promise.all([
      computeSellerStats(id),
      prisma.review.findMany({
        where: { sellerId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          rating: true,
          text: true,
          createdAt: true,
          author: { select: { nick: true, vkName: true, photo: true } },
        },
      }),
      prisma.listing.findMany({
        where: { sellerId: id, inStock: true, reserved: false },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          price: true,
          sizeUs: true,
          sizeEu: true,
          size: true,
          colorway: true,
          condition: true,
          model: { select: { name: true, brand: { select: { name: true } } } },
        },
      }),
    ])

    return { seller, stats, reviews, listings }
  })
}
