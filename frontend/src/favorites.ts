// Общее состояние «Слежу» (избранные модели) для сердечек по всему приложению:
// один Set id + подписка через useSyncExternalStore, оптимистичный toggle.
// App инициализирует стор при входе/выходе и задаёт обработчик «гость нажал сердце».
import { useSyncExternalStore } from 'react'
import { fetchFavoriteIds, addFavorite, removeFavorite } from './api/favorites'

let ids = new Set<number>()
let authed = false
let version = 0
const listeners = new Set<() => void>()

function emit() {
  version++
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Ре-рендер компонента при любом изменении избранного.
export function useFavoritesVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

export function isFavorite(modelId: number): boolean {
  return ids.has(modelId)
}

// Вызывается App'ом при смене авторизации (вход/выход/старт).
export async function initFavorites(isAuthed: boolean) {
  authed = isAuthed
  if (!isAuthed) {
    ids = new Set()
    emit()
    return
  }
  try {
    ids = new Set((await fetchFavoriteIds()).ids)
  } catch {
    ids = new Set()
  }
  emit()
}

let onUnauthorized: (() => void) | null = null
export function setFavoritesUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

// Оптимистичное переключение: сердце меняется сразу, при ошибке — откат.
export async function toggleFavorite(modelId: number) {
  if (!authed) {
    onUnauthorized?.()
    return
  }
  const had = ids.has(modelId)
  if (had) ids.delete(modelId)
  else ids.add(modelId)
  emit()
  try {
    if (had) await removeFavorite(modelId)
    else await addFavorite(modelId)
  } catch {
    if (had) ids.add(modelId)
    else ids.delete(modelId)
    emit()
  }
}
