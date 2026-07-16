// Недавно просмотренные модели (localStorage, до 12 id, новые в начале).
// Используется на PDP (ряд «Недавно смотрели»); пригодится главной (фаза 7).

const KEY = 'sa_recent_models'
const LIMIT = 12

export function getRecentIds(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((x): x is number => Number.isInteger(x) && x > 0).slice(0, LIMIT) : []
  } catch {
    return []
  }
}

export function pushRecentId(id: number) {
  const ids = [id, ...getRecentIds().filter((x) => x !== id)].slice(0, LIMIT)
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // приватный режим/квота — просто не запоминаем
  }
}
