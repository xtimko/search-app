// Клиент доски запросов «Ищу» (бэкенд /api/requests).

export interface RequestMatch {
  id: number
  price: number
  sizeUs: string | null
  sizeEu: string | null
  size: string | null
  colorway: string | null
  condition: 'new' | 'used'
  seller?: { id: number; nick: string; vkName: string | null }
}

export interface BuyRequest {
  id: number
  buyerId: number
  modelId: number
  size: string | null
  maxPrice: number | null
  city: string | null
  comment: string | null
  status: 'active' | 'closed'
  createdAt: string
  buyer: { id: number; nick: string; vkName: string | null; photo: string | null }
  model: { id: number; name: string; brand: { name: string }; category: { name: string; slug: string } }
  _count: { responses: number }
  myMatchCount?: number
  matches?: RequestMatch[]
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function createRequest(input: { modelId: number; size?: string; maxPrice?: number; city?: string; comment?: string }): Promise<BuyRequest> {
  return req<BuyRequest>('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function fetchRequests(mine = false): Promise<BuyRequest[]> {
  return req<BuyRequest[]>(`/api/requests${mine ? '?mine=1' : ''}`)
}

export function fetchRequestMatches(id: number): Promise<RequestMatch[]> {
  return req<RequestMatch[]>(`/api/requests/${id}/matches`)
}

export function fetchMyMatches(id: number): Promise<{ exact: RequestMatch[]; rest: RequestMatch[] }> {
  return req<{ exact: RequestMatch[]; rest: RequestMatch[] }>(`/api/requests/${id}/my-matches`)
}

export function respondToRequest(id: number, listingId: number): Promise<{ conversationId: number }> {
  return req<{ conversationId: number }>(`/api/requests/${id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId }),
  })
}

export function closeRequest(id: number): Promise<BuyRequest> {
  return req<BuyRequest>(`/api/requests/${id}/close`, { method: 'POST' })
}

export function matchSize(m: RequestMatch): string {
  return m.sizeUs || m.sizeEu ? [m.sizeUs && `US ${m.sizeUs}`, m.sizeEu && `EU ${m.sizeEu}`].filter(Boolean).join('/') : m.size || ''
}
