import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { matchModels } from './search'

// Каталог как на StockX: карточка = модель, внутри — офферы по размерам.

const LIVE: Prisma.ListingWhereInput = { inStock: true, reserved: false, seller: { status: 'approved' } }

// Фолбэк фото карточки: если у модели нет каталожного imageUrl — берём фото
// из самого свежего живого объявления (продавец приложил своё фото).
async function photoFallback(modelIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (!modelIds.length) return map
  const withPhoto = await prisma.listing.findMany({
    where: { ...LIVE, modelId: { in: modelIds }, photo: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { modelId: true, photo: true },
  })
  for (const l of withPhoto) if (l.photo && !map.has(l.modelId)) map.set(l.modelId, l.photo)
  return map
}

// Расцветки живых офферов по моделям (уникальные, до 6 на модель) — реселлеры
// различают модели прежде всего по расцветке, карточка обязана её показывать.
// extraWhere — те же офферные фильтры, что применялись к выдаче.
async function colorwaysByModel(modelIds: number[], extraWhere: Prisma.ListingWhereInput = {}): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>()
  if (!modelIds.length) return map
  const rows = await prisma.listing.findMany({
    where: { ...LIVE, ...extraWhere, modelId: { in: modelIds }, colorway: { not: null } },
    select: { modelId: true, colorway: true },
    distinct: ['modelId', 'colorway'],
    orderBy: { createdAt: 'desc' },
  })
  for (const r of rows) {
    if (!r.colorway) continue
    const list = map.get(r.modelId) ?? []
    if (list.length < 6) list.push(r.colorway)
    map.set(r.modelId, list)
  }
  return map
}

// Карточки каталога по списку id: агрегаты живых офферов + фото-фолбэк +
// расцветки; порядок ids сохраняется, модели без живых офферов остаются
// (нулевые агрегаты). Экспорт — для «Слежу» (favorites.ts) и списков карточек.
export async function cardsByIds(ids: number[]) {
  if (!ids.length) return []
  const [groups, models, colors] = await Promise.all([
    prisma.listing.groupBy({
      by: ['modelId'],
      where: { ...LIVE, modelId: { in: ids } },
      _min: { price: true },
      _count: true,
    }),
    prisma.model.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, name: true, sku: true, status: true, imageUrl: true, retailPrice: true, colorway: true,
        brand: { select: { name: true } },
        category: { select: { name: true, slug: true } },
      },
    }),
    colorwaysByModel(ids),
  ])
  const agg = new Map(groups.map((g) => [g.modelId, g]))
  const photos = await photoFallback(models.filter((m) => !m.imageUrl).map((m) => m.id))
  const byId = new Map(
    models.map((m) => [
      m.id,
      {
        model: m,
        photo: m.imageUrl ?? photos.get(m.id) ?? null,
        minPrice: agg.get(m.id)?._min.price ?? null,
        offersCount: agg.get(m.id)?._count ?? 0,
        colorways: colors.get(m.id) ?? [],
      },
    ]),
  )
  return ids.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x)
}

// Топ брендов по числу живых офферов (меню «Бренды», плитки главной, фильтр каталога).
async function topBrands(limit: number) {
  const rows = await prisma.$queryRaw<{ id: number; name: string; cnt: number }[]>`
    SELECT b.id::int, b.name, count(l.id)::int AS cnt
    FROM "Brand" b
    JOIN "Model" m ON m."brandId" = b.id
    JOIN "Listing" l ON l."modelId" = m.id AND l."inStock" AND NOT l.reserved
    JOIN "Seller" s ON s.id = l."sellerId" AND s.status = 'approved'
    GROUP BY b.id, b.name
    ORDER BY cnt DESC
    LIMIT ${limit}
  `
  return rows.map((r) => ({ id: Number(r.id), name: r.name, offersCount: Number(r.cnt) }))
}

export async function catalogRoutes(app: FastifyInstance) {
  // GET /api/catalog?q=&categoryId=&sort= — карточки моделей с агрегатами
  // (мин. цена, число офферов). С текстом — релевантный fuzzy-порядок.
  // ?ids=1,2,3 — батч-режим: карточки ровно этих моделей в заданном порядке
  // (recently viewed на PDP; пригодится рядам главной).
  // Фильтры каталога-браузера: ?brands=1,2 (мультивыбор; легаси ?brandId=),
  // ?size= (US/EU/буквенный), ?priceMin=&priceMax=, ?condition=new|used —
  // применяются к ОФФЕРАМ: модель остаётся, только если есть подходящий живой
  // оффер, а мин. цена/счётчик считаются по подходящим. Пагинация: ?offset=,
  // страница 24, в ответе total.
  app.get<{
    Querystring: {
      q?: string; categoryId?: string; brandId?: string; brands?: string; size?: string
      priceMin?: string; priceMax?: string; condition?: string; sort?: string; ids?: string; offset?: string
    }
  }>('/api/catalog', async (req) => {
    const q = (req.query.q ?? '').trim()
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined
    const sort = (req.query.sort ?? 'offers').toString()
    const offset = Math.max(0, Number(req.query.offset) || 0)
    const brandIds = [...(req.query.brands ?? '').split(','), req.query.brandId ?? '']
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
    const size = (req.query.size ?? '').trim()
    const priceMin = Number(req.query.priceMin) > 0 ? Number(req.query.priceMin) : undefined
    const priceMax = Number(req.query.priceMax) > 0 ? Number(req.query.priceMax) : undefined
    const condition = req.query.condition === 'new' || req.query.condition === 'used' ? req.query.condition : undefined
    const byIds = (req.query.ids ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 24)

    const offerWhere: Prisma.ListingWhereInput = {
      ...(size ? { OR: [{ sizeUs: { equals: size, mode: 'insensitive' } }, { sizeEu: { equals: size, mode: 'insensitive' } }, { size: { equals: size, mode: 'insensitive' } }] } : {}),
      ...(priceMin || priceMax ? { price: { ...(priceMin ? { gte: priceMin } : {}), ...(priceMax ? { lte: priceMax } : {}) } } : {}),
      ...(condition ? { condition } : {}),
    }
    const hasOfferFilters = Boolean(size || priceMin || priceMax || condition)

    let scored: Map<number, number> | null = null
    if (!byIds.length && q.length >= 2) {
      scored = await matchModels(q)
      if (scored.size === 0) return { results: [], total: 0 }
    }

    const catIds = categoryId
      ? [categoryId, ...(await prisma.category.findMany({ where: { parentId: categoryId }, select: { id: true } })).map((c) => c.id)]
      : undefined

    // Агрегаты офферов по моделям (с учётом офферных фильтров).
    const groups = await prisma.listing.groupBy({
      by: ['modelId'],
      where: {
        ...LIVE,
        ...offerWhere,
        ...(byIds.length ? { modelId: { in: byIds } } : scored ? { modelId: { in: [...scored.keys()] } } : {}),
        ...(catIds || brandIds.length ? { model: { ...(catIds ? { categoryId: { in: catIds } } : {}), ...(brandIds.length ? { brandId: { in: brandIds } } : {}) } } : {}),
      },
      _min: { price: true },
      _count: true,
      _max: { createdAt: true },
    })
    const aggByModel = new Map(groups.map((g) => [g.modelId, g]))

    // С текстовым запросом (и в батч-режиме) показываем и модели без офферов —
    // но при офферных фильтрах оставляем только модели с подходящим оффером.
    const ids = byIds.length
      ? byIds
      : scored
        ? [...scored.keys()].filter((mid) => !hasOfferFilters || aggByModel.has(mid))
        : groups.map((g) => g.modelId)
    const models = await prisma.model.findMany({
      where: { id: { in: ids }, ...(catIds ? { categoryId: { in: catIds } } : {}), ...(brandIds.length ? { brandId: { in: brandIds } } : {}) },
      select: {
        id: true, name: true, sku: true, status: true, imageUrl: true, retailPrice: true, colorway: true,
        brand: { select: { name: true } },
        category: { select: { name: true, slug: true } },
      },
    })

    const [photoByModel, colorsByModel] = await Promise.all([
      photoFallback(models.filter((m) => !m.imageUrl).map((m) => m.id)),
      // расцветки — по тем же офферным фильтрам, что и выдача (size/цена/состояние)
      colorwaysByModel(models.map((m) => m.id), offerWhere),
    ])

    const items = models.map((m) => {
      const g = aggByModel.get(m.id)
      return {
        model: m,
        photo: m.imageUrl ?? photoByModel.get(m.id) ?? null,
        minPrice: g?._min.price ?? null,
        offersCount: g?._count ?? 0,
        colorways: colorsByModel.get(m.id) ?? [],
        lastAdded: g?._max.createdAt ?? null,
      }
    })

    items.sort((a, b) => {
      if (byIds.length) return byIds.indexOf(a.model.id) - byIds.indexOf(b.model.id) // порядок запроса (recently viewed)
      if (scored) {
        const d = Math.round(((scored.get(b.model.id) ?? 0) - (scored.get(a.model.id) ?? 0)) * 10)
        if (d !== 0) return d
      }
      if (sort === 'price_asc') return (a.minPrice ?? 1e12) - (b.minPrice ?? 1e12)
      if (sort === 'new') return (b.lastAdded ? +new Date(b.lastAdded) : 0) - (a.lastAdded ? +new Date(a.lastAdded) : 0)
      return b.offersCount - a.offersCount
    })

    // Пагинация «Показать ещё»: страница 24 от offset + общий счётчик.
    return { results: items.slice(offset, offset + 24), total: items.length }
  })

  // GET /api/suggest?q= — живые подсказки для глобального поиска (топ-5 моделей).
  app.get<{ Querystring: { q?: string } }>('/api/suggest', async (req) => {
    const q = (req.query.q ?? '').trim()
    if (q.length < 2) return { results: [] }
    const scored = await matchModels(q)
    const ids = [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id)
    if (!ids.length) return { results: [] }
    const [models, groups, photos] = await Promise.all([
      prisma.model.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, imageUrl: true, brand: { select: { name: true } } },
      }),
      prisma.listing.groupBy({ by: ['modelId'], where: { ...LIVE, modelId: { in: ids } }, _min: { price: true }, _count: true }),
      prisma.listing.findMany({ where: { ...LIVE, modelId: { in: ids }, photo: { not: null } }, orderBy: { createdAt: 'desc' }, select: { modelId: true, photo: true } }),
    ])
    const agg = new Map(groups.map((g) => [g.modelId, g]))
    const ph = new Map<number, string>()
    for (const l of photos) if (l.photo && !ph.has(l.modelId)) ph.set(l.modelId, l.photo)
    const byId = new Map(models.map((m) => [m.id, m]))
    return {
      results: ids
        .map((id) => byId.get(id))
        .filter((m): m is NonNullable<typeof m> => !!m)
        .map((m) => ({
          id: m.id,
          name: m.name,
          brand: m.brand.name,
          photo: m.imageUrl ?? ph.get(m.id) ?? null,
          minPrice: agg.get(m.id)?._min.price ?? null,
          offersCount: agg.get(m.id)?._count ?? 0,
        })),
    }
  })

  // GET /api/trends — полоска «сейчас ищут»: топ моделей по поискам за 7 дней;
  // при пустых логах — фолбэк на модели с наибольшим числом офферов.
  app.get('/api/trends', async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const logs = await prisma.searchLog.groupBy({
      by: ['modelId'],
      where: { createdAt: { gte: since }, modelId: { not: null } },
      _count: true,
      orderBy: { _count: { modelId: 'desc' } },
      take: 8,
    })
    let ids = logs.map((l) => l.modelId as number)
    if (ids.length < 4) {
      const top = await prisma.listing.groupBy({ by: ['modelId'], where: LIVE, _count: true, orderBy: { _count: { modelId: 'desc' } }, take: 8 })
      for (const t of top) if (!ids.includes(t.modelId)) ids.push(t.modelId)
      ids = ids.slice(0, 8)
    }
    const models = await prisma.model.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, brand: { select: { name: true } } },
    })
    const byId = new Map(models.map((m) => [m.id, m]))
    return { results: ids.map((id) => byId.get(id)).filter((m): m is NonNullable<typeof m> => !!m).map((m) => ({ id: m.id, label: `${m.brand.name} ${m.name}` })) }
  })

  // GET /api/brands/top?limit= — бренды с живыми офферами по убыванию числа
  // офферов (меню «Бренды» — 12 по умолчанию; фильтр каталога берёт до 100).
  app.get<{ Querystring: { limit?: string } }>('/api/brands/top', async (req) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12))
    return { results: await topBrands(limit) }
  })

  // GET /api/home — данные рядов главной одним запросом (формат карточек =
  // карточка каталога): тренды недели (по поискам, фолбэк — топ офферов),
  // новые поступления, дефицит (спрос за 14 дней > живого предложения),
  // категорийные ряды (обувь/одежда), топ-бренды.
  app.get('/api/home', async () => {
    const since7 = new Date(Date.now() - 7 * 864e5)
    const since14 = new Date(Date.now() - 14 * 864e5)
    const [searchG7, searchG14, reqG, liveG, brands] = await Promise.all([
      prisma.searchLog.groupBy({
        by: ['modelId'],
        where: { createdAt: { gte: since7 }, modelId: { not: null } },
        _count: true,
        orderBy: { _count: { modelId: 'desc' } },
        take: 24,
      }),
      prisma.searchLog.groupBy({ by: ['modelId'], where: { createdAt: { gte: since14 }, modelId: { not: null } }, _count: true }),
      prisma.request.groupBy({ by: ['modelId'], where: { status: 'active' }, _count: true }),
      prisma.listing.groupBy({ by: ['modelId'], where: LIVE, _count: true, _max: { createdAt: true } }),
      topBrands(12),
    ])

    const offersTop = [...liveG].sort((a, b) => b._count - a._count).map((g) => g.modelId)

    // Тренды недели: топ по поискам; при пустых логах добиваем топом офферов.
    const trendIds = searchG7.map((g) => g.modelId as number)
    for (const id of offersTop) {
      if (trendIds.length >= 12) break
      if (!trendIds.includes(id)) trendIds.push(id)
    }

    // Новые поступления: по самому свежему живому офферу модели.
    const freshIds = [...liveG]
      .sort((a, b) => +(b._max.createdAt ?? 0) - +(a._max.createdAt ?? 0))
      .slice(0, 12)
      .map((g) => g.modelId)

    // Дефицит: спрос (поиски 14д + активные запросы «Ищу») больше живого
    // предложения — то, что стоит закупить / оставить запрос.
    const supply = new Map(liveG.map((g) => [g.modelId, g._count]))
    const demand = new Map<number, number>()
    for (const g of searchG14) demand.set(g.modelId as number, (demand.get(g.modelId as number) ?? 0) + g._count)
    for (const g of reqG) demand.set(g.modelId, (demand.get(g.modelId) ?? 0) + g._count)
    const deficitIds = [...demand.entries()]
      .map(([id, d]) => ({ id, d, s: supply.get(id) ?? 0 }))
      .filter((x) => x.d >= 2 && x.d > x.s)
      .sort((a, b) => b.d - a.d || a.s - b.s)
      .slice(0, 12)
      .map((x) => x.id)

    // Одна выборка карточек на все ряды.
    const allIds = [...new Set([...trendIds.slice(0, 12), ...freshIds, ...deficitIds, ...offersTop.slice(0, 60)])]
    const cards = await cardsByIds(allIds)
    const byId = new Map(cards.map((c) => [c.model.id, c]))
    const pick = (ids: number[]) => ids.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x)

    // Категорийные ряды — по числу офферов внутри корневой категории.
    const bySlug = (slug: string) => offersTop.filter((id) => byId.get(id)?.model.category.slug === slug).slice(0, 12)

    return {
      trending: pick(trendIds.slice(0, 12)),
      fresh: pick(freshIds),
      deficit: pick(deficitIds),
      footwear: pick(bySlug('footwear')),
      apparel: pick(bySlug('apparel')),
      brands,
    }
  })

  // GET /api/brands/:id — шапка страницы бренда: имя + счётчики наличия.
  app.get<{ Params: { id: string } }>('/api/brands/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const brand = await prisma.brand.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!brand) return reply.code(404).send({ error: 'бренд не найден' })
    const [offersCount, modelsInStock] = await Promise.all([
      prisma.listing.count({ where: { ...LIVE, model: { brandId: id } } }),
      prisma.model.count({ where: { brandId: id, listings: { some: LIVE } } }),
    ])
    return { id: brand.id, name: brand.name, offersCount, modelsInStock }
  })

  // GET /api/catalog/:id — страница товара: модель, офферы по размерам,
  // история продаж (график), спрос, похожие модели.
  app.get<{ Params: { id: string } }>('/api/catalog/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const model = await prisma.model.findUnique({
      where: { id },
      select: {
        id: true, name: true, sku: true, status: true, imageUrl: true,
        colorway: true, retailPrice: true, releaseYear: true, description: true,
        brandId: true, categoryId: true,
        brand: { select: { id: true, name: true } },
        category: { select: { name: true, slug: true } },
      },
    })
    if (!model) return reply.code(404).send({ error: 'модель не найдена' })

    const [offers, sales, requestsCount] = await Promise.all([
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
      // Все завершённые сделки по модели (для графика цен), старые → новые.
      prisma.deal.findMany({
        where: { status: 'completed', listing: { modelId: id } },
        orderBy: { closedAt: 'asc' },
        take: 500,
        select: { price: true, closedAt: true },
      }),
      prisma.request.count({ where: { modelId: id, status: 'active' } }),
    ])
    const lastDeal = sales.length ? sales[sales.length - 1] : null

    // Рейтинги продавцов выдачи — агрегатами.
    const sellerIds = [...new Set(offers.map((o) => o.seller.id))]
    const [ratings, dealCnt] = await Promise.all([
      prisma.review.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds } }, _avg: { rating: true }, _count: true }),
      prisma.deal.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds }, status: 'completed' }, _count: true }),
    ])
    const rByS = new Map(ratings.map((r) => [r.sellerId, { avg: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count }]))
    const dByS = new Map(dealCnt.map((d) => [d.sellerId, d._count]))

    // Похожие модели: живые офферы того же бренда или категории; приоритет —
    // совпадение бренда, затем число офферов. Формат = карточка каталога.
    const relGroups = await prisma.listing.groupBy({
      by: ['modelId'],
      where: { ...LIVE, modelId: { not: id }, model: { OR: [{ brandId: model.brandId }, { categoryId: model.categoryId }] } },
      _count: true,
    })
    const relAgg = new Map(relGroups.map((g) => [g.modelId, g]))
    const relBrands = await prisma.model.findMany({
      where: { id: { in: relGroups.map((g) => g.modelId) } },
      select: { id: true, brandId: true },
    })
    relBrands.sort((a, b) => {
      const brandDiff = Number(b.brandId === model.brandId) - Number(a.brandId === model.brandId)
      if (brandDiff !== 0) return brandDiff
      return (relAgg.get(b.id)?._count ?? 0) - (relAgg.get(a.id)?._count ?? 0)
    })
    const related = await cardsByIds(relBrands.slice(0, 8).map((m) => m.id))

    return {
      model,
      // hero: фото модели, иначе первое фото из офферов
      photo: model.imageUrl ?? offers.find((o) => o.photo)?.photo ?? null,
      lastSale: lastDeal ? { price: lastDeal.price, at: lastDeal.closedAt } : null,
      // история продаж для графика: [{price, at}], старые → новые
      sales: sales.map((s) => ({ price: s.price, at: s.closedAt })),
      activeRequests: requestsCount,
      related,
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
