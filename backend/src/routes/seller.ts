import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { getCurrentSellerId } from './listings'

// Профиль текущего продавца (пока — dev-продавец; при VK-авторизации станет реальным).
interface UpdateSellerBody {
  nick?: string
  contact?: string
  city?: string
  experience?: string
  description?: string
}

const sellerSelect = {
  id: true,
  nick: true,
  contact: true,
  city: true,
  experience: true,
  description: true,
  status: true,
} as const

export async function sellerRoutes(app: FastifyInstance) {
  // GET /api/seller/me — мой профиль.
  app.get('/api/seller/me', async (req) => {
    const id = await getCurrentSellerId(req)
    return prisma.seller.findUnique({ where: { id }, select: sellerSelect })
  })

  // PATCH /api/seller/me — обновить профиль.
  app.patch('/api/seller/me', async (req, reply) => {
    const b = (req.body ?? {}) as UpdateSellerBody
    const data: { nick?: string; contact?: string; city?: string; experience?: string; description?: string } = {}

    if (b.nick !== undefined) {
      if (!b.nick.trim()) return reply.code(400).send({ error: 'ник не может быть пустым' })
      data.nick = b.nick.trim()
    }
    if (b.contact !== undefined) {
      if (!b.contact.trim()) return reply.code(400).send({ error: 'контакт не может быть пустым' })
      data.contact = b.contact.trim()
    }
    if (b.city !== undefined) data.city = b.city.trim()
    if (b.experience !== undefined) data.experience = b.experience.trim()
    if (b.description !== undefined) data.description = b.description.trim()

    const id = await getCurrentSellerId(req)
    return prisma.seller.update({ where: { id }, data, select: sellerSelect })
  })
}
