import type { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '../db'
import { reattributeSearchLogs } from '../demand'
import { currentVkId, isAdminVkId } from './listings'
import { logAudit } from '../audit'

// Актор-админ текущего запроса (для аудит-журнала). Кладётся в хуке onRequest.
type AdminActor = { id: number; name: string } | null
const actorOf = (req: FastifyRequest): { actorId: number | null; actorName: string | null } => {
  const a = (req as unknown as { adminActor?: AdminActor }).adminActor
  return { actorId: a?.id ?? null, actorName: a?.name ?? null }
}

// Админ-панель: модерация продавцов + пополнение справочника.
// Доступ — по РОЛИ на сессии VK ID (vkId в ADMIN_VK_IDS), не по общему токену.
export async function adminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    const vkId = currentVkId(req)
    if (!vkId) return reply.code(401).send({ error: 'нужен вход через ВК' })
    if (!isAdminVkId(vkId)) return reply.code(403).send({ error: 'нет прав администратора' })
    // Кто именно из админов — для журнала (снимок id+имя).
    const s = await prisma.seller.findUnique({ where: { vkId }, select: { id: true, nick: true, vkName: true } })
    ;(req as unknown as { adminActor?: AdminActor }).adminActor = s ? { id: s.id, name: s.vkName || s.nick } : null
  })

  // Нормализация имени для детектора клонов: регистр, пробелы, только буквы/цифры.
  const normName = (s: string) => s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '')

  // GET /api/admin/sellers — все продавцы (vkId строкой из-за BigInt).
  // Слой 3 (антифейк): помечаем НЕпроверенного продавца, чьё имя совпадает с
  // именем уже проверенного — вероятный клон, поднимаем в начало списка.
  app.get('/api/admin/sellers', async () => {
    const sellers = await prisma.seller.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        vkId: true,
        nick: true,
        vkName: true,
        photo: true,
        contact: true,
        city: true,
        status: true,
        verified: true,
        _count: { select: { listings: true } },
      },
    })

    // Карта нормализованное_имя → отображаемое имя проверенного продавца.
    const verifiedNames = new Map<string, string>()
    for (const s of sellers) {
      if (!s.verified) continue
      const key = normName(s.vkName || s.nick)
      if (key) verifiedNames.set(key, s.vkName || s.nick)
    }

    const rows = sellers.map((s) => {
      const key = normName(s.vkName || s.nick)
      // клон = НЕ проверен сам, но имя совпадает с проверенным
      const similarToVerified = !s.verified && key ? verifiedNames.get(key) ?? null : null
      return { ...s, vkId: s.vkId.toString(), similarToVerified }
    })
    // Подозрительные — в начало (админ увидит сразу).
    rows.sort((a, b) => Number(!!b.similarToVerified) - Number(!!a.similarToVerified))
    return rows
  })

  // PATCH /api/admin/sellers/:id — сменить статус модерации и/или отметку
  // «официальный» (verified). Передаём только меняемые поля.
  app.patch<{ Params: { id: string } }>('/api/admin/sellers/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const b = (req.body ?? {}) as { status?: string; verified?: boolean }
    const data: { status?: 'pending' | 'approved' | 'blocked'; verified?: boolean } = {}

    if (b.status !== undefined) {
      if (!['pending', 'approved', 'blocked'].includes(b.status)) {
        return reply.code(400).send({ error: 'status: pending | approved | blocked' })
      }
      data.status = b.status as 'pending' | 'approved' | 'blocked'
    }
    if (typeof b.verified === 'boolean') data.verified = b.verified
    if (Object.keys(data).length === 0) return reply.code(400).send({ error: 'нечего менять' })

    const updated = await prisma.seller.update({
      where: { id },
      data,
      select: { id: true, nick: true, vkName: true, status: true, verified: true },
    })
    const who = updated.vkName || updated.nick
    if (data.status !== undefined) logAudit(req, { ...actorOf(req), action: 'seller.status', target: `продавец #${id} ${who} → ${data.status}` })
    if (data.verified !== undefined) logAudit(req, { ...actorOf(req), action: 'seller.verify', target: `продавец #${id} ${who} → ${data.verified ? 'официальный' : 'снята отметка'}` })
    return updated
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

  const modelCard = {
    id: true,
    name: true,
    sku: true,
    status: true,
    imageUrl: true,
    colorway: true,
    retailPrice: true,
    releaseYear: true,
    description: true,
    aliases: true,
    categoryId: true,
    brand: { select: { id: true, name: true } },
    category: { select: { id: true, name: true } },
    _count: { select: { listings: true } },
  } as const

  // GET /api/admin/models?status=pending|verified|all&q= — карточки для управления.
  app.get<{ Querystring: { status?: string; q?: string } }>('/api/admin/models', async (req) => {
    const status = req.query.status === 'pending' || req.query.status === 'verified' ? req.query.status : undefined
    const q = (req.query.q ?? '').trim()
    return prisma.model.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }, { brand: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
      },
      orderBy: [{ status: 'asc' }, { id: 'desc' }], // pending (p<v) сверху
      take: 100,
      select: modelCard,
    })
  })

  // PATCH /api/admin/models/:id — правка карточки: имя, артикул, категория,
  // алиасы, фото, статус (verify/pending), паспорт (расцветка/ритейл/год/описание).
  // Передаём только меняемые поля.
  app.patch<{ Params: { id: string } }>('/api/admin/models/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const b = (req.body ?? {}) as {
      name?: string; sku?: string; categoryId?: number; aliases?: string[]; imageUrl?: string; status?: string
      colorway?: string; retailPrice?: number | null; releaseYear?: number | null; description?: string
    }
    const model = await prisma.model.findUnique({ where: { id }, select: { id: true } })
    if (!model) return reply.code(404).send({ error: 'модель не найдена' })

    const data: Record<string, unknown> = {}
    if (b.name !== undefined) {
      const n = b.name.trim()
      if (n.length < 2) return reply.code(400).send({ error: 'название мин. 2 символа' })
      data.name = n
    }
    if (b.sku !== undefined) data.sku = b.sku.trim().slice(0, 40) || null
    if (b.imageUrl !== undefined) data.imageUrl = b.imageUrl.trim().slice(0, 500) || null
    if (b.colorway !== undefined) data.colorway = b.colorway.trim().slice(0, 120) || null
    if (b.description !== undefined) data.description = b.description.trim().slice(0, 2000) || null
    if (b.retailPrice !== undefined) {
      const p = b.retailPrice === null ? null : Math.round(Number(b.retailPrice))
      if (p !== null && (!Number.isFinite(p) || p <= 0 || p > 100_000_000)) return reply.code(400).send({ error: 'ритейл-цена: положительное число в рублях' })
      data.retailPrice = p
    }
    if (b.releaseYear !== undefined) {
      const y = b.releaseYear === null ? null : Math.round(Number(b.releaseYear))
      if (y !== null && (!Number.isFinite(y) || y < 1900 || y > new Date().getFullYear() + 1)) return reply.code(400).send({ error: 'год релиза: 1900…следующий год' })
      data.releaseYear = y
    }
    if (b.categoryId !== undefined) {
      if (!(await prisma.category.count({ where: { id: b.categoryId } }))) return reply.code(400).send({ error: 'категория не найдена' })
      data.categoryId = b.categoryId
    }
    if (b.aliases !== undefined) data.aliases = b.aliases.map((a) => a.toLowerCase().trim()).filter(Boolean)
    if (b.status === 'verified' || b.status === 'pending') data.status = b.status

    try {
      const updated = await prisma.model.update({ where: { id }, data, select: modelCard })
      if (data.aliases || data.name) reattributeSearchLogs(id).catch(() => {}) // расширили алиасы → подхватим спрос
      return updated
    } catch {
      return reply.code(409).send({ error: 'у этого бренда уже есть модель с таким названием' })
    }
  })

  // DELETE /api/admin/models/:id — удалить карточку (только если нет объявлений).
  app.delete<{ Params: { id: string } }>('/api/admin/models/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const model = await prisma.model.findUnique({ where: { id }, select: { name: true, brand: { select: { name: true } } } })
    const cnt = await prisma.listing.count({ where: { modelId: id } })
    if (cnt > 0) return reply.code(400).send({ error: `нельзя удалить: ${cnt} объявлений на этой модели` })
    await prisma.searchLog.updateMany({ where: { modelId: id }, data: { modelId: null } })
    await prisma.request.deleteMany({ where: { modelId: id } })
    await prisma.model.delete({ where: { id } })
    logAudit(req, { ...actorOf(req), action: 'model.delete', target: model ? `карточка ${model.brand.name} ${model.name} (#${id})` : `карточка #${id}` })
    return { ok: true }
  })

  // --- Проверенные гаранты (для безопасной сделки) ---

  // GET /api/admin/guarantors — все (включая скрытые).
  app.get('/api/admin/guarantors', async () => {
    return prisma.guarantor.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, contact: true, note: true, active: true, _count: { select: { deals: true } } },
    })
  })

  // POST /api/admin/guarantors { name, contact, note? }
  app.post('/api/admin/guarantors', async (req, reply) => {
    const b = (req.body ?? {}) as { name?: string; contact?: string; note?: string }
    const name = (b.name ?? '').trim().slice(0, 120)
    const contact = (b.contact ?? '').trim().slice(0, 200)
    if (name.length < 2 || !contact) return reply.code(400).send({ error: 'нужны имя и контакт гаранта' })
    const g = await prisma.guarantor.create({ data: { name, contact, note: (b.note ?? '').trim().slice(0, 200) || null } })
    logAudit(req, { ...actorOf(req), action: 'guarantor.add', target: `гарант «${name}»` })
    return reply.code(201).send(g)
  })

  // PATCH /api/admin/guarantors/:id — правка/скрытие (active).
  app.patch<{ Params: { id: string } }>('/api/admin/guarantors/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const b = (req.body ?? {}) as { name?: string; contact?: string; note?: string; active?: boolean }
    const data: { name?: string; contact?: string; note?: string | null; active?: boolean } = {}
    if (b.name !== undefined) {
      const n = b.name.trim().slice(0, 120)
      if (n.length < 2) return reply.code(400).send({ error: 'имя мин. 2 символа' })
      data.name = n
    }
    if (b.contact !== undefined) {
      const c = b.contact.trim().slice(0, 200)
      if (!c) return reply.code(400).send({ error: 'контакт обязателен' })
      data.contact = c
    }
    if (b.note !== undefined) data.note = b.note.trim().slice(0, 200) || null
    if (typeof b.active === 'boolean') data.active = b.active
    if (Object.keys(data).length === 0) return reply.code(400).send({ error: 'нечего менять' })
    return prisma.guarantor.update({ where: { id }, data })
  })

  // DELETE /api/admin/guarantors/:id — удалить, если не использовался; иначе скрыть.
  app.delete<{ Params: { id: string } }>('/api/admin/guarantors/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const g = await prisma.guarantor.findUnique({ where: { id }, select: { name: true } })
    const used = await prisma.deal.count({ where: { guarantorId: id } })
    if (used > 0) {
      await prisma.guarantor.update({ where: { id }, data: { active: false } })
      logAudit(req, { ...actorOf(req), action: 'guarantor.delete', target: `гарант «${g?.name ?? id}» скрыт (был в сделках)` })
      return { ok: true, hidden: true } // историю сделок не рвём — просто скрыли
    }
    await prisma.guarantor.delete({ where: { id } })
    logAudit(req, { ...actorOf(req), action: 'guarantor.delete', target: `гарант «${g?.name ?? id}» удалён` })
    return { ok: true }
  })

  // GET /api/admin/audit — журнал действий (последние 200), новые сверху.
  app.get('/api/admin/audit', async () => {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, actorName: true, action: true, target: true, ip: true, createdAt: true },
    })
  })
}
