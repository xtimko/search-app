// Клиент каталога (модельные карточки + страница товара, как StockX).

export interface CatalogModel {
  id: number
  name: string
  sku: string | null
  status?: 'verified' | 'pending'
  imageUrl: string | null
  retailPrice?: number | null // паспорт: есть в списке и на PDP (бейдж «−N% от ритейла»)
  colorway?: string | null // паспорт: только на PDP
  releaseYear?: number | null // паспорт: только на PDP
  description?: string | null // паспорт: только на PDP
  brand: { name: string }
  category: { name: string; slug: string }
}

// Скидка от ритейла в % (целое ≥1), если мин. цена ниже ритейла; иначе null.
export function retailDiscount(minPrice: number | null | undefined, retailPrice: number | null | undefined): number | null {
  if (minPrice == null || retailPrice == null || retailPrice <= 0 || minPrice >= retailPrice) return null
  const d = Math.round((1 - minPrice / retailPrice) * 100)
  return d >= 1 ? d : null
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
  model: CatalogModel & { brand: { id: number; name: string } } // id — для крошки на каталог бренда
  photo: string | null
  lastSale: { price: number; at: string } | null
  sales: { price: number; at: string }[] // завершённые сделки, старые → новые (график цен)
  activeRequests: number
  related: CatalogItem[] // похожие модели (тот же бренд/категория, живые офферы)
  offers: Offer[]
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export interface CatalogParams {
  q?: string
  categoryId?: number
  brands?: number[] // мультивыбор брендов
  size?: string // US/EU/буквенный — точное совпадение с оффером
  priceMin?: number
  priceMax?: number
  condition?: 'new' | 'used'
  sort?: string
  offset?: number // пагинация «Показать ещё» (страница 24)
}

export function fetchCatalog(params: CatalogParams): Promise<{ results: CatalogItem[]; total: number }> {
  const p = new URLSearchParams()
  if (params.q) p.set('q', params.q)
  if (params.categoryId) p.set('categoryId', String(params.categoryId))
  if (params.brands?.length) p.set('brands', params.brands.join(','))
  if (params.size) p.set('size', params.size)
  if (params.priceMin) p.set('priceMin', String(params.priceMin))
  if (params.priceMax) p.set('priceMax', String(params.priceMax))
  if (params.condition) p.set('condition', params.condition)
  if (params.sort) p.set('sort', params.sort)
  if (params.offset) p.set('offset', String(params.offset))
  return getJson(`/api/catalog?${p.toString()}`)
}

export function fetchProduct(id: number): Promise<ProductData> {
  return getJson(`/api/catalog/${id}`)
}

// Карточки конкретных моделей в заданном порядке (recently viewed, ряды главной).
export function fetchCatalogBatch(ids: number[]): Promise<{ results: CatalogItem[] }> {
  if (!ids.length) return Promise.resolve({ results: [] })
  return getJson(`/api/catalog?ids=${ids.join(',')}`)
}

export function offerSize(o: { sizeUs: string | null; sizeEu: string | null; size: string | null }): string {
  if (o.sizeUs || o.sizeEu) return [o.sizeUs && `US ${o.sizeUs}`, o.sizeEu && `EU ${o.sizeEu}`].filter(Boolean).join(' / ')
  return o.size || 'один размер'
}

export interface Suggestion {
  id: number
  name: string
  brand: string
  photo: string | null
  minPrice: number | null
  offersCount: number
}

export function fetchSuggest(q: string): Promise<{ results: Suggestion[] }> {
  return getJson(`/api/suggest?q=${encodeURIComponent(q)}`)
}

export function fetchTrends(): Promise<{ results: { id: number; label: string }[] }> {
  return getJson('/api/trends')
}

export function fetchTopBrands(limit?: number): Promise<{ results: { id: number; name: string; offersCount: number }[] }> {
  return getJson(`/api/brands/top${limit ? `?limit=${limit}` : ''}`)
}

export interface BrandInfo {
  id: number
  name: string
  offersCount: number
  modelsInStock: number
}

export function fetchBrandInfo(id: number): Promise<BrandInfo> {
  return getJson(`/api/brands/${id}`)
}

// Ряды главной (как StockX) — один запрос на все карусели + топ-бренды.
export interface HomeData {
  trending: CatalogItem[]
  fresh: CatalogItem[]
  deficit: CatalogItem[]
  footwear: CatalogItem[]
  apparel: CatalogItem[]
  brands: { id: number; name: string; offersCount: number }[]
}

export function fetchHome(): Promise<HomeData> {
  return getJson('/api/home')
}
