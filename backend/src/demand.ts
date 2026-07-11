import { prisma } from './db'
import { TR_FROM, TR_TO } from './routes/search'

// Ретро-атрибуция спроса: когда в справочнике появляется новая модель (или алиасы),
// пере-матчим недавние «не нашли»-поиски (SearchLog.modelId IS NULL) на неё.
// Так спрос, случившийся ДО появления товара в каталоге, не висит вечным пробелом.
// Сравнение — через транслит-нормализацию (см. search.ts), работает при любой локали БД.
export async function reattributeSearchLogs(modelId: number): Promise<number> {
  try {
    const m = await prisma.model.findUnique({
      where: { id: modelId },
      select: { name: true, aliases: true, brand: { select: { name: true, aliases: true } } },
    })
    if (!m) return 0
    const doc = [m.brand.name, m.name, ...m.aliases, ...m.brand.aliases].join(' ').toLowerCase()

    const res = await prisma.$executeRaw`
      UPDATE "SearchLog"
      SET "modelId" = ${modelId}
      WHERE "modelId" IS NULL
        AND "createdAt" > now() - interval '90 days'
        AND (
          word_similarity(
            lower(translate(query, ${TR_FROM}, ${TR_TO})),
            lower(translate(${doc}, ${TR_FROM}, ${TR_TO}))
          ) > 0.3
          OR ${doc} LIKE '%' || lower(query) || '%'
        )
    `
    return Number(res)
  } catch {
    return 0 // атрибуция — best effort, не мешаем основному сценарию
  }
}
