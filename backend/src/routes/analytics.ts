import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { getCurrentSellerId } from './listings'

// Аналитика спроса (PRO). Считается из first-party данных площадки:
// запросы «Ищу», логи поиска, сделки, сток. Окно — неделя/месяц.

// Биграммный коэффициент Дайса — похожесть строк для склейки опечаток
// в «ищут, но не нашли» («туфли челси» ≈ «туфли чилси»).
function bigrams(s: string): Set<string> {
  const t = ` ${s.toLowerCase().replace(/\s+/g, ' ').trim()} `
  const out = new Set<string>()
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2))
  return out
}
function dice(a: string, b: string): number {
  const A = bigrams(a)
  const B = bigrams(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return (2 * inter) / (A.size + B.size)
}

// Жадная кластеризация: похожие запросы сливаются, каноном становится самый частый.
function clusterQueries(rows: { query: string; count: number }[], limit: number) {
  const clusters: { query: string; count: number }[] = []
  for (const r of [...rows].sort((a, b) => b.count - a.count)) {
    const hit = clusters.find((c) => dice(c.query, r.query) >= 0.55)
    if (hit) hit.count += r.count
    else clusters.push({ query: r.query, count: r.count })
  }
  return clusters.sort((a, b) => b.count - a.count).slice(0, limit)
}

async function modelLabels(ids: number[]): Promise<Map<number, { name: string; brand: string; category: string }>> {
  if (ids.length === 0) return new Map()
  const models = await prisma.model.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, brand: { select: { name: true } }, category: { select: { name: true } } },
  })
  return new Map(models.map((m) => [m.id, { name: m.name, brand: m.brand.name, category: m.category.name }]))
}

export async function analyticsRoutes(app: FastifyInstance) {
  // GET /api/analytics/demand?period=week|month — дашборд спроса.
  app.get<{ Querystring: { period?: string } }>('/api/analytics/demand', async (req, reply) => {
    const me = await getCurrentSellerId(req)
    if (!me) return reply.code(401).send({ error: 'нужен вход' })

    const days = req.query.period === 'week' ? 7 : 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [reqGroups, searchGroups, unmatched, saleGroups, stockGroups] = await Promise.all([
      // спрос: запросы «Ищу» по моделям
      prisma.request.groupBy({ by: ['modelId'], where: { createdAt: { gte: since } }, _count: true }),
      // спрос: поиски, где распознали модель
      prisma.searchLog.groupBy({ by: ['modelId'], where: { createdAt: { gte: since }, modelId: { not: null } }, _count: true }),
      // «ищут, но не нашли» — запросы без совпадения (пробелы каталога/спрос вне ассортимента);
      // берём с запасом, ниже склеиваем варианты с опечатками
      prisma.searchLog.groupBy({
        by: ['query'],
        where: { createdAt: { gte: since }, modelId: null },
        _count: true,
        orderBy: { _count: { query: 'desc' } },
        take: 60,
      }),
      // продажи: завершённые сделки по моделям (+ средняя цена)
      prisma.deal.groupBy({ by: ['listingId'], where: { status: 'completed', closedAt: { gte: since } }, _count: true, _avg: { price: true } }),
      // предложение: позиции в наличии по моделям
      prisma.listing.groupBy({ by: ['modelId'], where: { inStock: true, reserved: false, seller: { status: 'approved' } }, _count: true }),
    ])

    // сделки сгруппированы по listingId → развернём в modelId
    const listingIds = saleGroups.map((s) => s.listingId)
    const listingModel = new Map(
      (await prisma.listing.findMany({ where: { id: { in: listingIds } }, select: { id: true, modelId: true } })).map((l) => [l.id, l.modelId]),
    )
    const salesByModel = new Map<number, { count: number; priceSum: number; priceN: number }>()
    for (const s of saleGroups) {
      const mid = listingModel.get(s.listingId)
      if (!mid) continue
      const cur = salesByModel.get(mid) ?? { count: 0, priceSum: 0, priceN: 0 }
      cur.count += s._count
      if (s._avg.price) {
        cur.priceSum += s._avg.price * s._count
        cur.priceN += s._count
      }
      salesByModel.set(mid, cur)
    }

    const requestsByModel = new Map(reqGroups.filter((g) => g.modelId != null).map((g) => [g.modelId as number, g._count]))
    const searchesByModel = new Map(searchGroups.filter((g) => g.modelId != null).map((g) => [g.modelId as number, g._count]))
    const stockByModel = new Map(stockGroups.map((g) => [g.modelId, g._count]))

    // единый набор моделей, по которым есть хоть какой-то сигнал
    const allIds = [...new Set<number>([...requestsByModel.keys(), ...searchesByModel.keys(), ...salesByModel.keys(), ...stockByModel.keys()])]
    const labels = await modelLabels(allIds)
    const label = (id: number) => labels.get(id) ?? { name: `#${id}`, brand: '', category: '' }

    const topRequested = [...requestsByModel.entries()]
      .map(([id, count]) => ({ modelId: id, ...label(id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const topSearched = [...searchesByModel.entries()]
      .map(([id, count]) => ({ modelId: id, ...label(id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const topSales = [...salesByModel.entries()]
      .map(([id, s]) => ({ modelId: id, ...label(id), count: s.count, avgPrice: s.priceN ? Math.round(s.priceSum / s.priceN) : null }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // дефицит: спрос (запросы+поиски) против предложения (сток). Высокий спрос при низком стоке — вверх.
    const gap = allIds
      .map((id) => {
        const demand = (requestsByModel.get(id) ?? 0) + (searchesByModel.get(id) ?? 0)
        const supply = stockByModel.get(id) ?? 0
        return { modelId: id, ...label(id), demand, supply }
      })
      .filter((x) => x.demand > 0)
      .sort((a, b) => b.demand - a.demand || a.supply - b.supply)
      .slice(0, 12)

    // Склеиваем варианты с опечатками и отбрасываем короткий мусор.
    const unmet = clusterQueries(
      unmatched.filter((u) => u.query.trim().length >= 3).map((u) => ({ query: u.query, count: u._count })),
      12,
    )

    return { period: days === 7 ? 'week' : 'month', topRequested, topSearched, topSales, gap, unmet }
  })
}
