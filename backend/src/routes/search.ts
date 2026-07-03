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

    // Текст → по словам матчим бренд/модель/алиас/артикул (каждое слово должно совпасть).
    for (const w of parsed.text.split(' ').filter((x) => x.length >= 2)) {
      and.push({
        model: {
          OR: [
            { name: { contains: w, mode: 'insensitive' } },
            { aliases: { has: w } },
            { sku: { contains: w, mode: 'insensitive' } },
            {
              brand: {
                OR: [{ name: { contains: w, mode: 'insensitive' } }, { aliases: { has: w } }],
              },
            },
          ],
        },
      })
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

    const results = await prisma.listing.findMany({
      where: { AND: and },
      orderBy,
      take: 100,
      select: {
        id: true,
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
            brand: { select: { name: true } },
            category: { select: { name: true, slug: true } },
          },
        },
        seller: {
          select: { id: true, nick: true, vkName: true, photo: true, contact: true, city: true, experience: true, status: true },
        },
      },
    })

    // Рейтинг продавцов выдачи (агрегатами, чтобы не считать по одному).
    const sellerIds = [...new Set(results.map((r) => r.seller.id))]
    const [ratings, deals] = await Promise.all([
      prisma.review.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds } }, _avg: { rating: true }, _count: true }),
      prisma.deal.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds }, status: 'completed' }, _count: true }),
    ])
    const ratingBySeller = new Map(ratings.map((r) => [r.sellerId, { avg: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count }]))
    const dealsBySeller = new Map(deals.map((d) => [d.sellerId, d._count]))

    const enriched = results.map((r) => ({
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
