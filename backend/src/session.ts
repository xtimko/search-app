import crypto from 'node:crypto'

// Подписанные сессии в httpOnly-cookie: "<vkId>.<expiresMs>.<hmac>".
// Секрет — SESSION_SECRET (в dev — предсказуемый фоллбек, в проде задать в env).

const SECRET = process.env.SESSION_SECRET || 'dev-session-secret'
export const SESSION_COOKIE = 'sa_session'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 дней

function hmac(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function createSession(vkId: bigint): string {
  const payload = `${vkId}.${Date.now() + TTL_MS}`
  return `${payload}.${hmac(payload)}`
}

export function verifySession(token: string | undefined): bigint | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [vkIdStr, expStr, sig] = parts
  const payload = `${vkIdStr}.${expStr}`
  const expected = hmac(payload)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  if (Number(expStr) < Date.now()) return null
  if (!/^\d+$/.test(vkIdStr)) return null
  return BigInt(vkIdStr)
}
