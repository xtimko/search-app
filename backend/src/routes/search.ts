import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'

// Разбор свободного запроса покупателя вида «Jordan 4 42», «nb 2002r 9us».
// Вытаскиваем размер (US/EU), остальное считаем текстом для матчинга бренд/модель.
function parseQuery(raw: string): { text: string; sizeUs: string | null; sizeEu: string | null } {
  let s = ' ' + raw.toLowerCase().replace(/,/g, '.') + ' '
  s = s.replace(/\b(ищу|куплю|ищю)\b/g, ' ')

  let sizeUs: string | null = null
  let sizeEu: string | null = null

  // Явно помеченные размеры.
  s = s.replace(/(\d{1,2}(?:\.5)?)\s*(?:us|usa|сша|юс)\b/g, (_m, n: string) => {
    sizeUs = n
    return ' '
  })
  s = s.replace(/(\d{2}(?:\.5)?)\s*(?:eu|eur|euro|евро|ер)\b/g, (_m, n: string) => {
    sizeEu = n
    return ' '
  })

  // Голое число без юнита трактуем как EU-размер только в диапазоне 35–48.
  // US-размеры и номера моделей («4», «90», «550», «2002») слишком неоднозначны —
  // их оставляем тексту для матчинга модели.
  if (!sizeUs && !sizeEu) {
    const m = s.match(/\b(?:3[5-9]|4[0-8])(?:\.5)?\b/)
    if (m) {
      sizeEu = m[0]
      s = s.replace(m[0], ' ')
    }
  }

  return { text: s.replace(/\s+/g, ' ').trim(), sizeUs, sizeEu }
}

// --- Транслит-нормализация для pg_trgm ---
// Проблема: при локали БД без юникодной классификации (C/alpine musl) pg_trgm
// НЕ строит триграммы из кириллицы → word_similarity('самба','samba…')=0.
// Решение: обе стороны сравнения прогоняем через translate(кириллица→латиница 1:1)
// — строка становится ASCII, триграммы работают при любой локали. Карта 1:1
// не идеальный транслит, но она консистентна для обеих сторон — этого достаточно.
export const TR_FROM = 'абвгдеёжзийклмнопрстуфхцчшщыэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯъьЪЬ'
export const TR_TO = 'abvgdeejziiklmnoprstufhccssyeuaabvgdeejziiklmnoprstufhccssyeua'

// Релевантный подбор моделей под текст запроса (pg_trgm).
// Возвращает Map<modelId, score>: точные/префиксные/алиасные совпадения — выше,
// затем нечёткие (устойчивы к опечаткам и сокращениям). score примерно 0..2.3.
async function matchModels(text: string): Promise<Map<number, number>> {
  const q = text.trim().toLowerCase()
  if (q.length < 2) return new Map()

  // doc = бренд + модель + алиасы (модели и бренда) + артикул — единая строка для похожести.
  const rows = await prisma.$queryRaw<{ id: number; score: number }[]>`
    SELECT m.id::int AS id,
      (
        word_similarity(lower(translate(${q}, ${TR_FROM}, ${TR_TO})), nd.d)
        + CASE WHEN lower(doc.d) LIKE '%' || ${q} || '%' THEN 0.5 ELSE 0 END
        + CASE WHEN lower(m.name) LIKE ${q} || '%' THEN 0.3 ELSE 0 END
        + CASE WHEN ${q} = ANY(m.aliases) OR ${q} = ANY(b.aliases) THEN 0.7 ELSE 0 END
      )::float8 AS score
    FROM "Model" m
    JOIN "Brand" b ON b.id = m."brandId"
    CROSS JOIN LATERAL (
      SELECT b.name || ' ' || m.name || ' '
        || coalesce(array_to_string(m.aliases, ' '), '') || ' '
        || coalesce(array_to_string(b.aliases, ' '), '') || ' '
        || coalesce(m.sku, '') AS d
    ) doc
    CROSS JOIN LATERAL (
      SELECT lower(translate(doc.d, ${TR_FROM}, ${TR_TO})) AS d
    ) nd
    WHERE word_similarity(lower(translate(${q}, ${TR_FROM}, ${TR_TO})), nd.d) > 0.3
       OR lower(doc.d) LIKE '%' || ${q} || '%'
    ORDER BY score DESC
    LIMIT 80
  `
  return new Map(rows.map((r) => [Number(r.id), Number(r.score)]))
}

// Мягкий матч ТОЛЬКО для атрибуции лога спроса (не для выдачи): ловит сильные
// опечатки, которые не дотянули до строгого порога. Возвращает top-1 или null.
async function matchModelLoose(text: string): Promise<number | null> {
  const q = text.trim().toLowerCase()
  if (q.length < 4) return null // короткий мусор не атрибуцируем
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT m.id::int AS id
    FROM "Model" m
    JOIN "Brand" b ON b.id = m."brandId"
    CROSS JOIN LATERAL (
      SELECT lower(translate(
        b.name || ' ' || m.name || ' '
        || coalesce(array_to_string(m.aliases, ' '), '') || ' '
        || coalesce(array_to_string(b.aliases, ' '), '') || ' '
        || coalesce(m.sku, ''), ${TR_FROM}, ${TR_TO})) AS d
    ) doc
    WHERE word_similarity(lower(translate(${q}, ${TR_FROM}, ${TR_TO})), doc.d) > 0.22
    ORDER BY word_similarity(lower(translate(${q}, ${TR_FROM}, ${TR_TO})), doc.d) DESC
    LIMIT 1
  `
  return rows[0] ? Number(rows[0].id) : null
}

export async function searchRoutes(app: FastifyInstance) {
  // GET /api/search — поиск покупателя по стоку (в наличии, продавцы approved).
  app.get<{
    Querystring: {
      q?: string
      brandId?: string
      categoryId?: string
      condition?: string
      priceMin?: string
      priceMax?: string
      city?: string
      sort?: string
    }
  }>('/api/search', async (req) => {
    const parsed = parseQuery((req.query.q ?? '').toString())
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined
    const condition =
      req.query.condition === 'new' || req.query.condition === 'used' ? req.query.condition : undefined
    const priceMin = req.query.priceMin ? Number(req.query.priceMin) : undefined
    const priceMax = req.query.priceMax ? Number(req.query.priceMax) : undefined
    const city = (req.query.city ?? '').toString().trim()
    const sort = (req.query.sort ?? 'price_asc').toString()

    const and: Prisma.ListingWhereInput[] = [
      { inStock: true },
      { reserved: false }, // позиции в открытой сделке скрыты
      { seller: { status: 'approved' } },
    ]

    // Текст → релевантный подбор моделей (pg_trgm): опечатки/сокращения ок, ранжируем ниже.
    let scoreByModel = new Map<number, number>()
    if (parsed.text.length >= 2) {
      scoreByModel = await matchModels(parsed.text)
      // Лог спроса: строгий матч → мягкий фолбэк (ловит сильные опечатки, чтобы
      // реальный товар не попадал в «ищут, но не нашли»). Не блокирует ответ.
      const topModelId = [...scoreByModel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      const logText = parsed.text.slice(0, 100)
      const logCity = city || null
      ;(async () => {
        const modelId = topModelId ?? (await matchModelLoose(logText))
        await prisma.searchLog.create({ data: { query: logText, modelId, city: logCity } })
      })().catch(() => {})
      if (scoreByModel.size === 0) return { parsed, results: [] } // текст задан, но совпадений нет
      and.push({ modelId: { in: [...scoreByModel.keys()] } })
    }

    if (brandId) and.push({ model: { brandId } })
    if (categoryId) {
      // Выбор родительской категории включает её подкатегории (дерево из 2 уровней).
      const children = await prisma.category.findMany({ where: { parentId: categoryId }, select: { id: true } })
      and.push({ model: { categoryId: { in: [categoryId, ...children.map((c) => c.id)] } } })
    }
    if (parsed.sizeUs) and.push({ sizeUs: parsed.sizeUs })
    if (parsed.sizeEu) and.push({ sizeEu: parsed.sizeEu })
    if (condition) and.push({ condition })
    if (priceMin) and.push({ price: { gte: priceMin } })
    if (priceMax) and.push({ price: { lte: priceMax } })
    if (city) and.push({ city: { contains: city, mode: 'insensitive' } })

    const orderBy: Prisma.ListingOrderByWithRelationInput =
      sort === 'price_desc' ? { price: 'desc' } : sort === 'new' ? { createdAt: 'desc' } : { price: 'asc' }

    const hasText = scoreByModel.size > 0
    const results = await prisma.listing.findMany({
      where: { AND: and },
      orderBy,
      // при текстовом поиске берём с запасом и переупорядочиваем по релевантности
      take: hasText ? 300 : 100,
      select: {
        id: true,
        modelId: true,
        sizeUs: true,
        sizeEu: true,
        size: true,
        colorway: true,
        condition: true,
        hasBox: true,
        fitting: true,
        price: true,
        city: true,
        photo: true,
        model: {
          select: {
            name: true,
            imageUrl: true,
            brand: { select: { name: true } },
            category: { select: { name: true, slug: true } },
          },
        },
        seller: {
          select: { id: true, nick: true, vkName: true, photo: true, contact: true, city: true, experience: true, status: true },
        },
      },
    })

    // При текстовом поиске переупорядочиваем по релевантности (бакеты по 0.1),
    // внутри бакета — по выбранной сортировке; затем срез до 100.
    let ordered = results
    if (hasText) {
      const bucket = (id: number) => Math.round((scoreByModel.get(id) ?? 0) * 10)
      const secondary = (a: typeof results[number], b: typeof results[number]) =>
        sort === 'price_desc' ? b.price - a.price : sort === 'new' ? 0 : a.price - b.price
      ordered = [...results]
        .sort((a, b) => bucket(b.modelId) - bucket(a.modelId) || secondary(a, b))
        .slice(0, 100)
    }

    // Рейтинг продавцов выдачи (агрегатами, чтобы не считать по одному).
    const sellerIds = [...new Set(ordered.map((r) => r.seller.id))]
    const [ratings, deals] = await Promise.all([
      prisma.review.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds } }, _avg: { rating: true }, _count: true }),
      prisma.deal.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds }, status: 'completed' }, _count: true }),
    ])
    const ratingBySeller = new Map(ratings.map((r) => [r.sellerId, { avg: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count }]))
    const dealsBySeller = new Map(deals.map((d) => [d.sellerId, d._count]))

    const enriched = ordered.map((r) => ({
      ...r,
      seller: {
        ...r.seller,
        rating: ratingBySeller.get(r.seller.id)?.avg ?? null,
        reviewsCount: ratingBySeller.get(r.seller.id)?.count ?? 0,
        dealsCompleted: dealsBySeller.get(r.seller.id) ?? 0,
      },
    }))

    return { parsed, results: enriched }
  })
}
