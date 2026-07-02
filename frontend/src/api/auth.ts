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
