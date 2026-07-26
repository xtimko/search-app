// Клиент админ-панели (бэкенд /api/admin/*). Доступ — по сессии VK ID (роль
// ADMIN_VK_IDS), cookie уходит автоматически (same-origin). Общего токена нет.
function headers(): HeadersInit {
  return { 'Content-Type': 'application/json' }
}

export interface AdminSeller {
  id: number
  vkId: string
  nick: string
  vkName: string | null
  photo: string | null
  contact: string
  city: string | null
  status: 'pending' | 'approved' | 'blocked'
  verified: boolean
  similarToVerified: string | null // имя проверенного продавца, на которого похож (вероятный клон)
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

// Отметка «официальный/подтверждённый» (Слой 2) — независимо от статуса модерации.
export async function setSellerVerified(id: number, verified: boolean) {
  const res = await fetch(`/api/admin/sellers/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ verified }),
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
  colorway: string | null
  retailPrice: number | null
  releaseYear: number | null
  description: string | null
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

export async function updateModel(
  id: number,
  patch: Partial<{
    name: string; sku: string; categoryId: number; aliases: string[]; imageUrl: string; status: 'verified' | 'pending'
    colorway: string; retailPrice: number | null; releaseYear: number | null; description: string
  }>,
) {
  const res = await fetch(`/api/admin/models/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error || `HTTP ${res.status}`) }
  return res.json()
}

export async function deleteModel(id: number) {
  const res = await fetch(`/api/admin/models/${id}`, { method: 'DELETE', headers: headers() })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error || `HTTP ${res.status}`) }
  return res.json()
}

// --- Проверенные гаранты ---
export interface AdminGuarantor {
  id: number
  name: string
  contact: string
  note: string | null
  active: boolean
  _count: { deals: number }
}

export async function fetchAdminGuarantors(): Promise<AdminGuarantor[]> {
  const res = await fetch('/api/admin/guarantors', { headers: headers() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function addGuarantor(payload: { name: string; contact: string; note?: string }) {
  return postAdmin('/api/admin/guarantors', payload)
}

export async function updateGuarantor(id: number, patch: Partial<{ name: string; contact: string; note: string; active: boolean }>) {
  const res = await fetch(`/api/admin/guarantors/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error || `HTTP ${res.status}`) }
  return res.json()
}

export async function deleteGuarantor(id: number) {
  const res = await fetch(`/api/admin/guarantors/${id}`, { method: 'DELETE', headers: headers() })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error || `HTTP ${res.status}`) }
  return res.json()
}

// --- Аудит-журнал ---
export interface AuditEntry {
  id: number
  actorName: string | null
  action: string
  target: string | null
  ip: string | null
  createdAt: string
}

export async function fetchAudit(): Promise<AuditEntry[]> {
  const res = await fetch('/api/admin/audit', { headers: headers() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
