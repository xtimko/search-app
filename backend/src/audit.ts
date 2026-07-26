import type { FastifyRequest } from 'fastify'
import { prisma } from './db'

// Запись в аудит-журнал безопасности. Fire-and-forget: не блокирует и не роняет
// основной запрос (ошибка записи журнала не должна ломать вход/действие).
// IP берётся из req.ip (за nginx корректен благодаря trustProxy).
export function logAudit(
  req: FastifyRequest | null,
  e: { actorId?: number | null; actorName?: string | null; action: string; target?: string | null },
): void {
  const ip = req?.ip || null
  const ua = req ? String(req.headers['user-agent'] ?? '').slice(0, 200) || null : null
  prisma.auditLog
    .create({
      data: {
        actorId: e.actorId ?? null,
        actorName: e.actorName ?? null,
        action: e.action,
        target: e.target ?? null,
        ip,
        userAgent: ua,
      },
    })
    .catch(() => {})
}
