import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { matchModels } from './search'

// Каталог как на StockX: карточка = модель, внутри — офферы по размерам.

const LIVE: Prisma.ListingWhereInput = { inStock: true, reserved: false, seller: { status: 'approved' } }

export async function catalogRoutes(app: FastifyInstance) {
  // GET /api/catalog?q=&categoryId=&sort= — карточки моделей с агрегатами
  // (мин. цена, число офферов). С текстом — релевантный fuzzy-порядок.
  app.get<{ Querystring: { q?: string; categoryId?: string; sort?: string } }>('/api/catalog', async (req) => {
    const q = (req.query.q ?? '').trim()
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined
    const sort = (req.query.sort ?? 'offers').toString()

    let scored: Map<number, number> | null = null
    if (q.length >= 2) {
      scored = await matchModels(q)
      if (scored.size === 0) return { results: [] }
    }

    const catIds = categoryId
      ? [categoryId, ...(await prisma.category.findMany({ where: { parentId: categoryId }, select: { id: true } })).map((c) => c.id)]
      : undefined

    // Агрегаты офферов по моделям.
    const groups = await prisma.listing.groupBy({
      by: ['modelId'],
      where: { ...LIVE, ...(scored ? { modelId: { in: [...scored.keys()] } } : {}), ...(catIds ? { model: { categoryId: { in: catIds } } } : {}) },
      _min: { price: true },
      _count: true,
      _max: { createdAt: true },
    })
    const aggByModel = new Map(groups.map((g) => [g.modelId, g]))

    // С текстовым запросом показываем и модели без офферов (спрос → доска «Ищу»).
    const ids = scored ? [...scored.keys()] : groups.map((g) => g.modelId)
    const models = await prisma.model.findMany({
      where: { id: { in: ids }, ...(catIds ? { categoryId: { in: catIds } } : {}) },
      select: {
        id: true, name: true, sku: true, imageUrl: true,
        brand: { select: { name: true } },
        category: { select: { name: true, slug: true } },
      },
    })

    // Фолбэк фото карточки: если у модели нет каталожного imageUrl — берём
    // фото из любого её живого объявления (продавец приложил своё фото).
    const noImgIds = models.filter((m) => !m.imageUrl).map((m) => m.id)
    const photoByModel = new Map<number, string>()
    if (noImgIds.length) {
      const withPhoto = await prisma.listing.findMany({
        where: { ...LIVE, modelId: { in: noImgIds }, photo: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { modelId: true, photo: true },
      })
      for (const l of withPhoto) if (l.photo && !photoByModel.has(l.modelId)) photoByModel.set(l.modelId, l.photo)
    }

    const items = models.map((m) => {
      const g = aggByModel.get(m.id)
      return {
        model: m,
        photo: m.imageUrl ?? photoByModel.get(m.id) ?? null,
        minPrice: g?._min.price ?? null,
        offersCount: g?._count ?? 0,
        lastAdded: g?._max.createdAt ?? null,
      }
    })

    items.sort((a, b) => {
      if (scored) {
        const d = Math.round(((scored.get(b.model.id) ?? 0) - (scored.get(a.model.id) ?? 0)) * 10)
        if (d !== 0) return d
      }
      if (sort === 'price_asc') return (a.minPrice ?? 1e12) - (b.minPrice ?? 1e12)
      if (sort === 'new') return (b.lastAdded ? +new Date(b.lastAdded) : 0) - (a.lastAdded ? +new Date(a.lastAdded) : 0)
      return b.offersCount - a.offersCount
    })

    return { results: items.slice(0, 60) }
  })

  // GET /api/catalog/:id — страница товара: модель, офферы по размерам, последняя продажа, спрос.
  app.get<{ Params: { id: string } }>('/api/catalog/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const model = await prisma.model.findUnique({
      where: { id },
      select: {
        id: true, name: true, sku: true, imageUrl: true,
        brand: { select: { name: true } },
        category: { select: { name: true, slug: true } },
      },
    })
    if (!model) return reply.code(404).send({ error: 'модель не найдена' })

    const [offers, lastDeal, requestsCount] = await Promise.all([
      prisma.listing.findMany({
        where: { ...LIVE, modelId: id },
        orderBy: { price: 'asc' },
        take: 200,
        select: {
          id: true, sizeUs: true, sizeEu: true, size: true, colorway: true,
          condition: true, hasBox: true, fitting: true, price: true, city: true, photo: true,
          seller: { select: { id: true, nick: true, vkName: true, photo: true, contact: true, status: true } },
        },
      }),
      prisma.deal.findFirst({
        where: { status: 'completed', listing: { modelId: id } },
        orderBy: { closedAt: 'desc' },
        select: { price: true, closedAt: true },
      }),
      prisma.request.count({ where: { modelId: id, status: 'active' } }),
    ])

    // Рейтинги продавцов выдачи — агрегатами.
    const sellerIds = [...new Set(offers.map((o) => o.seller.id))]
    const [ratings, dealCnt] = await Promise.all([
      prisma.review.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds } }, _avg: { rating: true }, _count: true }),
      prisma.deal.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds }, status: 'completed' }, _count: true }),
    ])
    const rByS = new Map(ratings.map((r) => [r.sellerId, { avg: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count }]))
    const dByS = new Map(dealCnt.map((d) => [d.sellerId, d._count]))

    return {
      model,
      // hero: фото модели, иначе первое фото из офферов
      photo: model.imageUrl ?? offers.find((o) => o.photo)?.photo ?? null,
      lastSale: lastDeal ? { price: lastDeal.price, at: lastDeal.closedAt } : null,
      activeRequests: requestsCount,
      offers: offers.map((o) => ({
        ...o,
        seller: {
          ...o.seller,
          rating: rByS.get(o.seller.id)?.avg ?? null,
          reviewsCount: rByS.get(o.seller.id)?.count ?? 0,
          dealsCompleted: dByS.get(o.seller.id) ?? 0,
        },
      })),
    }
  })
}
