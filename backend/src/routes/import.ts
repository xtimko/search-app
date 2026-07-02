import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { getCurrentSellerId } from './listings'

// Массовый импорт стока из таблицы. В ячейке «размер» можно указать несколько
// размеров через запятую/пробел → на каждый создаётся отдельная позиция.

type Raw = Record<string, unknown>

const KEYS = {
  brand: ['бренд', 'brand'],
  model: ['модель', 'model'],
  size: ['размер', 'размеры', 'size', 'sizes'],
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
      where: { ...b, OR: [{ name: { contains: text, mode: 'insensitive' } }, { sku: { contains: text, mode: 'insensitive' } }] },
      select: modelSelect,
    }))
  )
}

function parseCondition(text: string): 'new' | 'used' {
  return /(б\s*\/?\s*у|used|ношен)/i.test(text) ? 'used' : 'new'
}

interface ListingData {
  modelId: number
  sizeUs?: string
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
  const sizes = sizeText.split(/[\s,;/]+/).map((s) => s.replace(',', '.').trim()).filter(Boolean)
  const isFootwear = model?.category.slug === 'footwear'

  const datas: ListingData[] =
    model && priceOk
      ? (sizes.length ? sizes : ['']).map((s) => ({
          modelId: model.id,
          sizeUs: isFootwear && s ? s : undefined,
          size: !isFootwear && s ? s : undefined,
          condition,
          price: priceNum,
          photo: photo || null,
          comment: comment || null,
        }))
      : []

  return {
    display: {
      row: index + 1,
      brandText,
      modelText,
      sizes,
      priceText,
      matched: model ? { id: model.id, name: model.name, brand: model.brand.name, category: model.category.name } : null,
      condition,
      price: priceOk ? priceNum : null,
      count: datas.length,
      issues,
      ok: datas.length > 0,
    },
    datas,
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
    const totalItems = resolved.reduce((n, x) => n + x.datas.length, 0)
    return { rows: preview, okCount, errorCount: preview.length - okCount, totalItems }
  })

  // POST /api/import/commit — создать позиции по валидным строкам.
  app.post('/api/import/commit', async (req, reply) => {
    const rows = ((req.body ?? {}) as { rows?: Raw[] }).rows
    if (!Array.isArray(rows) || rows.length === 0) return reply.code(400).send({ error: 'нет строк' })
    if (rows.length > 1000) return reply.code(400).send({ error: 'слишком много строк' })

    const resolved = await Promise.all(rows.map((r, i) => resolveRow(r, i)))
    const sellerId = await getCurrentSellerId(req)
    if (!sellerId) return reply.code(401).send({ error: 'нужен вход через ВК' })
    const toCreate = resolved.flatMap((x) => x.datas).map((d) => ({ sellerId, ...d }))
    if (toCreate.length === 0) return reply.code(400).send({ error: 'нет валидных строк' })

    const res = await prisma.listing.createMany({ data: toCreate })
    const okRows = resolved.filter((x) => x.datas.length > 0).length
    return { created: res.count, skipped: resolved.length - okRows }
  })
}
