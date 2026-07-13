// Клиент каталога (модельные карточки + страница товара, как StockX).

export interface CatalogModel {
  id: number
  name: string
  sku: string | null
  status?: 'verified' | 'pending'
  imageUrl: string | null
  brand: { name: string }
  category: { name: string; slug: string }
}

export interface CatalogItem {
  model: CatalogModel
  photo: string | null // фото модели или фолбэк из объявления
  minPrice: number | null
  offersCount: number
}

export interface Offer {
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
  seller: {
    id: number
    nick: string
    vkName: string | null
    photo: string | null
    contact: string
    status: string
    rating: number | null
    reviewsCount: number
    dealsCompleted: number
  }
}

export interface ProductData {
  model: CatalogModel
  photo: string | null
  lastSale: { price: number; at: string } | null
  activeRequests: number
  offers: Offer[]
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function fetchCatalog(params: { q?: string; categoryId?: number; sort?: string }): Promise<{ results: CatalogItem[] }> {
  const p = new URLSearchParams()
  if (params.q) p.set('q', params.q)
  if (params.categoryId) p.set('categoryId', String(params.categoryId))
  if (params.sort) p.set('sort', params.sort)
  return getJson(`/api/catalog?${p.toString()}`)
}

export function fetchProduct(id: number): Promise<ProductData> {
  return getJson(`/api/catalog/${id}`)
}

export function offerSize(o: { sizeUs: string | null; sizeEu: string | null; size: string | null }): string {
  if (o.sizeUs || o.sizeEu) return [o.sizeUs && `US ${o.sizeUs}`, o.sizeEu && `EU ${o.sizeEu}`].filter(Boolean).join(' / ')
  return o.size || 'один размер'
}
