import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { getCurrentSellerId } from './listings'
import { cardsByIds } from './catalog'

// «Слежу» — избранные модели пользователя. Сердечко на карточке/PDP,
// раздел в профиле. Фундамент уведомлений «появился оффер по твоей модели».

export async function favoriteRoutes(app: FastifyInstance) {
  // GET /api/favorites/ids — только id моделей (инициализация сердечек, лёгкий).
  app.get('/api/favorites/ids', async (req, reply) => {
    const me = await getCurrentSellerId(req)
    if (!me) return reply.code(401).send({ error: 'нужен вход' })
    const rows = await prisma.favorite.findMany({ where: { sellerId: me }, select: { modelId: true } })
    return { ids: rows.map((r) => r.modelId) }
  })

  // GET /api/favorites — карточки каталога моих избранных (новые сверху).
  app.get('/api/favorites', async (req, reply) => {
    const me = await getCurrentSellerId(req)
    if (!me) return reply.code(401).send({ error: 'нужен вход' })
    const rows = await prisma.favorite.findMany({
      where: { sellerId: me },
      orderBy: { createdAt: 'desc' },
      select: { modelId: true },
    })
    return { results: await cardsByIds(rows.map((r) => r.modelId)) }
  })

  // POST /api/favorites/:modelId — добавить (идемпотентно).
  app.post<{ Params: { modelId: string } }>('/api/favorites/:modelId', async (req, reply) => {
    const me = await getCurrentSellerId(req)
    if (!me) return reply.code(401).send({ error: 'нужен вход' })
    const modelId = Number(req.params.modelId)
    if (!(await prisma.model.count({ where: { id: modelId } }))) return reply.code(404).send({ error: 'модель не найдена' })
    await prisma.favorite.upsert({
      where: { sellerId_modelId: { sellerId: me, modelId } },
      update: {},
      create: { sellerId: me, modelId },
    })
    return reply.code(201).send({ ok: true })
  })

  // DELETE /api/favorites/:modelId — убрать (идемпотентно).
  app.delete<{ Params: { modelId: string } }>('/api/favorites/:modelId', async (req, reply) => {
    const me = await getCurrentSellerId(req)
    if (!me) return reply.code(401).send({ error: 'нужен вход' })
    const modelId = Number(req.params.modelId)
    await prisma.favorite.deleteMany({ where: { sellerId: me, modelId } })
    return { ok: true }
  })
}
