// Светлая/тёмная тема. Дефолт — тёмная (бренд Ice Monochrome), выбор пользователя
// хранится в localStorage и применяется атрибутом data-theme на <html>
// (палитры — в styles/theme.css). Ранний анти-FOUC-скрипт живёт в index.html.
import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'sa_theme'
let theme: Theme = 'dark'
const listeners = new Set<() => void>()

function apply(t: Theme) {
  document.documentElement.dataset.theme = t
  // Цвет системной рамки браузера (мобильные вкладки) — под фон темы.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f5f5f7' : '#111114')
}

// Вызывается один раз до рендера (main.tsx).
export function initTheme() {
  try {
    theme = localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    theme = 'dark'
  }
  apply(theme)
}

export function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // приватный режим — тема живёт до перезагрузки
  }
  apply(theme)
  listeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => theme,
  )
}
