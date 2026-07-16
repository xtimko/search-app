// Клиент «Слежу» (бэкенд /api/favorites*). Авторизация — httpOnly-cookie сессии.
import type { CatalogItem } from './catalog'

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function fetchFavoriteIds(): Promise<{ ids: number[] }> {
  return req('/api/favorites/ids')
}

export function fetchFavorites(): Promise<{ results: CatalogItem[] }> {
  return req('/api/favorites')
}

export function addFavorite(modelId: number): Promise<{ ok: true }> {
  return req(`/api/favorites/${modelId}`, { method: 'POST' })
}

export function removeFavorite(modelId: number): Promise<{ ok: true }> {
  return req(`/api/favorites/${modelId}`, { method: 'DELETE' })
}
