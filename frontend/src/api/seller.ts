import { authHeaders } from './client'

// Клиент профиля продавца (бэкенд /api/seller/me).

export interface SellerProfile {
  id: number
  nick: string
  contact: string
  city: string | null
  experience: string | null
  description: string | null
  status: 'pending' | 'approved' | 'blocked'
}

export type SellerProfilePatch = Partial<Pick<SellerProfile, 'nick' | 'contact' | 'city' | 'experience' | 'description'>>

export async function fetchMe(): Promise<SellerProfile> {
  const res = await fetch('/api/seller/me', { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function updateMe(patch: SellerProfilePatch): Promise<SellerProfile> {
  const res = await fetch('/api/seller/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json()
}
