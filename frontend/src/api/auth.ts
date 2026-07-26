// Клиент авторизации VK ID (бэкенд /api/auth/*). Сессия — httpOnly-cookie,
// уходит с запросами автоматически (same-origin).

export interface AuthUser {
  id: number
  nick: string
  vkName: string | null
  photo: string | null
  contact: string
  city: string | null
  experience: string | null
  description: string | null
  status: 'pending' | 'approved' | 'blocked'
  verified: boolean // официальный/подтверждённый (Слой 2)
  vkId: string // числовой id страницы ВК (для настройки ADMIN_VK_IDS)
  isAdmin: boolean // доступ к админке (роль по ADMIN_VK_IDS)
  dev: boolean
}

export async function fetchAuthMe(): Promise<AuthUser | null> {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
  return res.json()
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}

export function loginUrl(): string {
  return '/api/auth/vk/login'
}

// Временный тестовый вход по имени (пока VK ID не подключён).
export async function testLogin(name: string): Promise<void> {
  const res = await fetch('/api/auth/test-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
}
