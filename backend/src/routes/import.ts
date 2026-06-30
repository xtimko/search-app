import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { getCurrentSellerId } from './listings'

// Массовый импорт стока из таблицы. Фронт парсит файл (SheetJS) и шлёт строки сюда:
// preview — сверяем со справочником и показываем, что распозналось;
// commit — заново сверяем и создаём листинги по валидным строкам.

type Raw = Record<string, unknown>

// Допустимые заголовки колонок (нормализуем к нижнему регистру).
const KEYS = {
  brand: ['бренд', 'brand'],
  model: ['модель', 'model'],
  size: ['размер', 'size'],
  condition: ['состояние', 'condition'],
  price: ['цена', 'price'],
  photo: ['фото', 'photo', 'ссылка'],
  comment: ['комментарий', 'comment', 'коммент'],
}

function pick(row: Raw, names: string[]): string {
  for (const key of Object.keys(row)) {
    if (names.includes(key.trim().toLowerCase())) {
      const v = row[key]
      return v === null || v === undefined ? '' : String(v).trim()
    }
  }
  return ''
}

const modelSelect = {
  id: true,
  name: true,
  brand: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, slug: true } },
} as const

async function findBrand(text: string) {
  if (!text) return null
  const t = text.toLowerCase()
  return (
    (await prisma.brand.findFirst({ where: { name: { equals: text, mode: 'insensitive' } } })) ||
    (await prisma.brand.findFirst({ where: { aliases: { has: t } } })) ||
    (await prisma.brand.findFirst({ where: { name: { contains: text, mode: 'insensitive' } } }))
  )
}

async function findModel(text: string, brandId?: number) {
  if (!text) return null
  const t = text.toLowerCase()
  const b = brandId ? { brandId } : {}
  return (
    (await prisma.model.findFirst({ where: { ...b, name: { equals: text, mode: 'insensitive' } }, select: modelSelect })) ||
    (await prisma.model.findFirst({ where: { ...b, aliases: { has: t } }, select: modelSelect })) ||
    (await prisma.model.findFirst({
      where: {
        ...b,
        OR: [{ name: { contains: text, mode: 'insensitive' } }, { sku: { contains: text, mode: 'insensitive' } }],
      },
      select: modelSelect,
    }))
  )
}

function parseCondition(text: string): 'new' | 'used' {
  return /(б\s*\/?\s*у|used|ношен)/i.test(text) ? 'used' : 'new'
}

// Размер: для обуви раскладываем в US/EU, для прочего — общий size.
function classifySize(sizeText: string, categorySlug: string): { sizeUs?: string; sizeEu?: string; size?: string } {
  const s = sizeText.replace(',', '.').trim()
  if (!s) return {}
  if (categorySlug === 'footwear') {
    const num = s.replace(/[^\d.]/g, '')
    if (/us|сша|юс/i.test(s)) return { sizeUs: num }
    if (/eu|евро|ер/i.test(s)) return { sizeEu: num }
    const v = parseFloat(num)
    return v >= 35 && v <= 48 ? { sizeEu: num } : { sizeUs: num }
  }
  return { size: s }
}

interface ListingData {
  modelId: number
  sizeUs?: string
  sizeEu?: string
  size?: string
  condition: 'new' | 'used'
  price: number
  photo: string | null
  comment: string | null
}

async function resolveRow(raw: Raw, index: number) {
  const brandText = pick(raw, KEYS.brand)
  const modelText = pick(raw, KEYS.model)
  const sizeText = pick(raw, KEYS.size)
  const priceText = pick(raw, KEYS.price)
  const photo = pick(raw, KEYS.photo)
  const comment = pick(raw, KEYS.comment)

  const issues: string[] = []
  const brand = await findBrand(brandText)
  const model = await findModel(modelText, brand?.id)
  if (!modelText) issues.push('пустая модель')
  else if (!model) issues.push('модель не распознана')

  const priceNum = Math.round(Number(priceText.replace(/[^\d.]/g, '')))
  const priceOk = priceNum > 0
  if (!priceText) issues.push('пустая цена')
  else if (!priceOk) issues.push('некорректная цена')

  const condition = parseCondition(pick(raw, KEYS.condition))
  const ok = !!model && priceOk
  const data: ListingData | null =
    model && priceOk
      ? { modelId: model.id, ...classifySize(sizeText, model.category.slug), condition, price: priceNum, photo: photo || null, comment: comment || null }
      : null

  return {
    display: {
      row: index + 1,
      brandText,
      modelText,
      sizeText,
      priceText,
      matched: model ? { id: model.id, name: model.name, brand: model.brand.name, category: model.category.name } : null,
      condition,
      price: priceOk ? priceNum : null,
      issues,
      ok,
    },
    data,
  }
}

export async function importRoutes(app: FastifyInstance) {
  // POST /api/import/preview — сверка строк со справочником (без записи).
  app.post('/api/import/preview', async (req, reply) => {
    const rows = ((req.body ?? {}) as { rows?: Raw[] }).rows
    if (!Array.isArray(rows) || rows.length === 0) return reply.code(400).send({ error: 'нет строк' })
    if (rows.length > 1000) return reply.code(400).send({ error: 'слишком много строк (макс 1000)' })

    const resolved = await Promise.all(rows.map((r, i) => resolveRow(r, i)))
    const preview = resolved.map((x) => x.display)
    const okCount = preview.filter((p) => p.ok).length
    return { rows: preview, okCount, errorCount: preview.length - okCount }
  })

  // POST /api/import/commit — создать листинги по валидным строкам.
  app.post('/api/import/commit', async (req, reply) => {
    const rows = ((req.body ?? {}) as { rows?: Raw[] }).rows
    if (!Array.isArray(rows) || rows.length === 0) return reply.code(400).send({ error: 'нет строк' })
    if (rows.length > 1000) return reply.code(400).send({ error: 'слишком много строк (макс 1000)' })

    const resolved = await Promise.all(rows.map((r, i) => resolveRow(r, i)))
    const sellerId = await getCurrentSellerId(req)
    const toCreate = resolved.filter((x) => x.data).map((x) => ({ sellerId, ...(x.data as ListingData) }))
    if (toCreate.length === 0) return reply.code(400).send({ error: 'нет валидных строк' })

    const res = await prisma.listing.createMany({ data: toCreate })
    return { created: res.count, skipped: resolved.length - toCreate.length }
  })
}
