// Клиент админ-панели (бэкенд /api/admin/*). Доступ по заголовку x-admin-token.
// В dev токен = 'dev'; при деплое заменить на реальный механизм.
const ADMIN_TOKEN = 'dev'

function headers(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN }
}

export interface AdminSeller {
  id: number
  vkId: string
  nick: string
  contact: string
  city: string | null
  status: 'pending' | 'approved' | 'blocked'
  _count: { listings: number }
}

export async function fetchSellers(): Promise<AdminSeller[]> {
  const res = await fetch('/api/admin/sellers', { headers: headers() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function setSellerStatus(id: number, status: 'pending' | 'approved' | 'blocked') {
  const res = await fetch(`/api/admin/sellers/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function postAdmin(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function addBrand(name: string, aliases: string[]) {
  return postAdmin('/api/admin/brands', { name, aliases })
}

export function addModel(payload: { brandId: number; categoryId: number; name: string; aliases: string[]; sku?: string }) {
  return postAdmin('/api/admin/models', payload)
}
