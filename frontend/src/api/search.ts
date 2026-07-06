// Клиент поиска покупателя (бэкенд /api/search).

export interface SearchResult {
  id: number
  sizeUs: string | null
  sizeEu: string | null
  size: string | null
  colorway: string | null
  condition: 'new' | 'used'
  hasBox: boolean
  fitting: boolean
  price: number
  city: string | null
  photo: string | null
  model: { name: string; imageUrl: string | null; brand: { name: string }; category: { name: string; slug: string } }
  seller: {
    id: number
    nick: string
    vkName: string | null
    photo: string | null
    contact: string
    city: string | null
    experience: string | null
    status: string
    rating: number | null
    reviewsCount: number
    dealsCompleted: number
  }
}

export interface SearchResponse {
  parsed: { text: string; sizeUs: string | null; sizeEu: string | null }
  results: SearchResult[]
}

export interface SearchParams {
  q?: string
  brandId?: number
  categoryId?: number
  condition?: 'new' | 'used'
  priceMin?: number
  priceMax?: number
  city?: string
  sort?: string
}

export async function search(p: SearchParams): Promise<SearchResponse> {
  const params = new URLSearchParams()
  if (p.q) params.set('q', p.q)
  if (p.brandId) params.set('brandId', String(p.brandId))
  if (p.categoryId) params.set('categoryId', String(p.categoryId))
  if (p.condition) params.set('condition', p.condition)
  if (p.priceMin) params.set('priceMin', String(p.priceMin))
  if (p.priceMax) params.set('priceMax', String(p.priceMax))
  if (p.city) params.set('city', p.city)
  if (p.sort) params.set('sort', p.sort)
  const res = await fetch(`/api/search?${params.toString()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
