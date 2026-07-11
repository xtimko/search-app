import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { reattributeSearchLogs } from '../demand'

// Админ-панель: модерация продавцов + пополнение справочника.
// Доступ по заголовку x-admin-token (в dev = 'dev'; в проде задать ADMIN_TOKEN).
export async function adminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    if (req.headers['x-admin-token'] !== (process.env.ADMIN_TOKEN || 'dev')) {
      return reply.code(401).send({ error: 'нужен админ-доступ' })
    }
  })

  // GET /api/admin/sellers — все продавцы (vkId строкой из-за BigInt).
  app.get('/api/admin/sellers', async () => {
    const sellers = await prisma.seller.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        vkId: true,
        nick: true,
        contact: true,
        city: true,
        status: true,
        _count: { select: { listings: true } },
      },
    })
    return sellers.map((s) => ({ ...s, vkId: s.vkId.toString() }))
  })

  // PATCH /api/admin/sellers/:id — сменить статус модерации.
  app.patch<{ Params: { id: string } }>('/api/admin/sellers/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const status = (req.body as { status?: string })?.status
    if (!['pending', 'approved', 'blocked'].includes(status || '')) {
      return reply.code(400).send({ error: 'status: pending | approved | blocked' })
    }
    return prisma.seller.update({
      where: { id },
      data: { status: status as 'pending' | 'approved' | 'blocked' },
      select: { id: true, nick: true, status: true },
    })
  })

  // POST /api/admin/brands — добавить бренд в справочник.
  app.post('/api/admin/brands', async (req, reply) => {
    const b = (req.body ?? {}) as { name?: string; aliases?: string[] }
    if (!b.name?.trim()) return reply.code(400).send({ error: 'name обязателен' })
    try {
      const brand = await prisma.brand.create({
        data: {
          name: b.name.trim(),
          aliases: (b.aliases || []).map((a) => a.toLowerCase().trim()).filter(Boolean),
        },
      })
      return reply.code(201).send(brand)
    } catch {
      return reply.code(409).send({ error: 'такой бренд уже есть' })
    }
  })

  // POST /api/admin/models — добавить модель в справочник.
  app.post('/api/admin/models', async (req, reply) => {
    const b = (req.body ?? {}) as { brandId?: number; categoryId?: number; name?: string; aliases?: string[]; sku?: string; imageUrl?: string }
    if (!b.name?.trim() || !b.brandId || !b.categoryId) {
      return reply.code(400).send({ error: 'name, brandId, categoryId обязательны' })
    }
    try {
      const model = await prisma.model.create({
        data: {
          brandId: b.brandId,
          categoryId: b.categoryId,
          name: b.name.trim(),
          aliases: (b.aliases || []).map((a) => a.toLowerCase().trim()).filter(Boolean),
          sku: b.sku?.trim() || null,
          imageUrl: b.imageUrl?.trim() || null,
        },
      })
      // Пере-матчим недавние «не нашли»-поиски на новую модель (алиасы учитываются).
      reattributeSearchLogs(model.id).catch(() => {})
      return reply.code(201).send(model)
    } catch {
      return reply.code(409).send({ error: 'такая модель у бренда уже есть' })
    }
  })

  // PATCH /api/admin/models/:id — задать/сменить каталожное фото модели (куратор).
  app.patch<{ Params: { id: string } }>('/api/admin/models/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const imageUrl = String((req.body as { imageUrl?: string })?.imageUrl ?? '').trim().slice(0, 500) || null
    const model = await prisma.model.findUnique({ where: { id }, select: { id: true } })
    if (!model) return reply.code(404).send({ error: 'модель не найдена' })
    return prisma.model.update({
      where: { id },
      data: { imageUrl },
      select: { id: true, name: true, imageUrl: true, brand: { select: { name: true } } },
    })
  })
}
