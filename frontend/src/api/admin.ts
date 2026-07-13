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

export function addModel(payload: { brandId: number; categoryId: number; name: string; aliases: string[]; sku?: string; imageUrl?: string }) {
  return postAdmin('/api/admin/models', payload)
}

// Задать/сменить каталожное фото модели (куратор). imageUrl='' — убрать фото.
export async function setModelImage(id: number, imageUrl: string) {
  const res = await fetch(`/api/admin/models/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ imageUrl }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface AdminModel {
  id: number
  name: string
  sku: string | null
  status: 'verified' | 'pending'
  imageUrl: string | null
  aliases: string[]
  categoryId: number
  brand: { id: number; name: string }
  category: { id: number; name: string }
  _count: { listings: number }
}

export async function fetchAdminModels(params: { status?: 'pending' | 'verified'; q?: string }): Promise<AdminModel[]> {
  const p = new URLSearchParams()
  if (params.status) p.set('status', params.status)
  if (params.q) p.set('q', params.q)
  const res = await fetch(`/api/admin/models?${p.toString()}`, { headers: headers() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function updateModel(id: number, patch: Partial<{ name: string; sku: string; categoryId: number; aliases: string[]; imageUrl: string; status: 'verified' | 'pending' }>) {
  const res = await fetch(`/api/admin/models/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error || `HTTP ${res.status}`) }
  return res.json()
}

export async function deleteModel(id: number) {
  const res = await fetch(`/api/admin/models/${id}`, { method: 'DELETE', headers: headers() })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error || `HTTP ${res.status}`) }
  return res.json()
}
