// Клиент справочника (бэкенд /api/*). В dev запросы идут через прокси Vite.

export interface Brand {
  id: number
  name: string
}

export interface Category {
  id: number
  name: string
  slug: string
  parentId?: number | null
}

export interface Model {
  id: number
  name: string
  sku: string | null
  brandId: number
  brand: { id: number; name: string }
  category: { id: number; name: string; slug: string }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export function fetchCategories(): Promise<Category[]> {
  return getJson<Category[]>('/api/categories')
}

export function fetchBrands(q: string): Promise<Brand[]> {
  return getJson<Brand[]>(`/api/brands?q=${encodeURIComponent(q)}`)
}

export function fetchModels(q: string, brandId?: number): Promise<Model[]> {
  const params = new URLSearchParams({ q })
  if (brandId) params.set('brandId', String(brandId))
  return getJson<Model[]>(`/api/models?${params.toString()}`)
}
