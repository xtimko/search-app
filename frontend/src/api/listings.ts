import { authHeaders } from './client'

// Клиент стока (бэкенд /api/listings). В dev — через прокси Vite.

export type Condition = 'new' | 'used'

export interface ListingInput {
  modelId: number
  sizeUs?: string
  sizeEu?: string
  size?: string
  colorway?: string
  condition?: Condition
  hasBox?: boolean
  fitting?: boolean
  price: number
  city?: string
  photo?: string
  comment?: string
}

export interface MyListing {
  id: number
  sizeUs: string | null
  sizeEu: string | null
  size: string | null
  colorway: string | null
  condition: Condition
  hasBox: boolean
  fitting: boolean
  price: number
  city: string | null
  inStock: boolean
  createdAt: string
  model: {
    id: number
    name: string
    brand: { name: string }
    category: { name: string; slug: string }
  }
}

export interface ListingPatch {
  inStock?: boolean
  price?: number
  sizeUs?: string
  sizeEu?: string
  size?: string
  colorway?: string
  condition?: Condition
  hasBox?: boolean
  fitting?: boolean
  city?: string
  photo?: string
  comment?: string
}

export async function createListing(input: ListingInput): Promise<{ id: number }> {
  const res = await fetch('/api/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchMyListings(): Promise<MyListing[]> {
  const res = await fetch('/api/listings', { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function updateListing(id: number, patch: ListingPatch): Promise<MyListing> {
  const res = await fetch(`/api/listings/${id}`, {
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

export async function deleteListing(id: number): Promise<void> {
  const res = await fetch(`/api/listings/${id}`, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}
