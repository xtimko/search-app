import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { getCurrentSellerId } from './listings'
import { reattributeSearchLogs } from '../demand'

// Эндпоинты единого справочника: категории, бренды, модели (для автоподстановки).
// Поиск по названию, алиасам и артикулу; без учёта регистра; не более 20 результатов.
export async function directoryRoutes(app: FastifyInstance) {
  // GET /api/categories — дерево категорий (плоско, с parentId).
  app.get('/api/categories', async () => {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, parentId: true },
    })
  })

  // GET /api/brands?q=nb — бренды по названию или алиасу.
  app.get<{ Querystring: { q?: string } }>('/api/brands', async (req) => {
    const q = (req.query.q ?? '').trim()
    const ql = q.toLowerCase()
    return prisma.brand.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { aliases: { has: ql } }] }
        : undefined,
      orderBy: { name: 'asc' },
      take: 20,
      select: { id: true, name: true },
    })
  })

  // POST /api/models — добавить модель, которой нет в справочнике (любой вошедший).
  // Бренд создаётся по имени, если новый. Дубликаты не плодим (регистронезависимо).
  app.post('/api/models', async (req, reply) => {
    const me = await getCurrentSellerId(req)
    if (!me) return reply.code(401).send({ error: 'нужен вход' })

    const b = (req.body ?? {}) as { brandName?: string; name?: string; categoryId?: number; imageUrl?: string; sku?: string }
    const brandName = String(b.brandName ?? '').trim().slice(0, 40)
    const name = String(b.name ?? '').trim().slice(0, 60)
    const imageUrl = String(b.imageUrl ?? '').trim().slice(0, 500) || null
    const sku = String(b.sku ?? '').trim().slice(0, 40) || null
    const categoryId = Number(b.categoryId)
    if (brandName.length < 2) return reply.code(400).send({ error: 'укажи бренд (мин. 2 символа)' })
    if (name.length < 2) return reply.code(400).send({ error: 'укажи название модели (мин. 2 символа)' })
    const category = await prisma.category.count({ where: { id: categoryId } })
    if (!category) return reply.code(400).send({ error: 'выбери категорию' })

    const brand =
      (await prisma.brand.findFirst({ where: { name: { equals: brandName, mode: 'insensitive' } } })) ??
      (await prisma.brand.create({ data: { name: brandName } }))

    const select = {
      id: true,
      name: true,
      sku: true,
      status: true,
      imageUrl: true,
      brandId: true,
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, slug: true } },
    }
    const existing = await prisma.model.findFirst({
      where: { brandId: brand.id, name: { equals: name, mode: 'insensitive' } },
      select,
    })
    // если модель уже есть, но без фото — проставим переданное
    if (existing) {
      if (imageUrl && !existing.imageUrl) return prisma.model.update({ where: { id: existing.id }, data: { imageUrl }, select })
      return existing
    }
    // Создана продавцом → на модерацию (pending). Используется сразу, админ проверит.
    const created = await prisma.model.create({ data: { brandId: brand.id, categoryId, name, sku, imageUrl, status: 'pending' }, select })
    // Пере-матчим недавние «не нашли»-поиски на новую модель (не блокируем ответ).
    reattributeSearchLogs(created.id).catch(() => {})
    return reply.code(201).send(created)
  })

  // GET /api/models?q=&brandId=&categoryId= — модели по названию/алиасу/артикулу,
  // с опциональными фильтрами по бренду и категории.
  app.get<{ Querystring: { q?: string; brandId?: string; categoryId?: string } }>(
    '/api/models',
    async (req) => {
      const q = (req.query.q ?? '').trim()
      const ql = q.toLowerCase()
      const brandId = req.query.brandId ? Number(req.query.brandId) : undefined
      const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined
      return prisma.model.findMany({
        where: {
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { aliases: { has: ql } },
                  { sku: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(brandId ? { brandId } : {}),
          ...(categoryId ? { categoryId } : {}),
        },
        orderBy: { name: 'asc' },
        take: 20,
        select: {
          id: true,
          name: true,
          sku: true,
          brandId: true,
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      })
    },
  )
}
