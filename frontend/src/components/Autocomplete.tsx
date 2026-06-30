import { useEffect, useRef, useState, type ReactNode } from 'react'

interface AutocompleteProps<T> {
  // Функция загрузки подсказок по строке запроса.
  fetcher: (query: string) => Promise<T[]>
  // Что вызвать при выборе элемента.
  onSelect: (item: T) => void
  getKey: (item: T) => string | number
  getLabel: (item: T) => string
  // Опциональный кастомный рендер строки подсказки.
  renderItem?: (item: T) => ReactNode
  placeholder?: string
  minChars?: number
}

// Переиспользуемое поле автоподстановки: debounce, навигация клавишами,
// закрытие по клику вне, состояния загрузки/пустого результата.
export function Autocomplete<T>({
  fetcher,
  onSelect,
  getKey,
  getLabel,
  renderItem,
  placeholder,
  minChars = 1,
}: AutocompleteProps<T>) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<T[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)

  // Держим свежие колбэки в ref, чтобы эффект зависел только от query.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < minChars) {
      setItems([])
      setOpen(false)
      return
    }
    setLoading(true)
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await fetcherRef.current(q)
        if (cancelled) return
        setItems(res)
        setOpen(true)
        setActive(-1)
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, minChars])

  // Закрытие по клику вне компонента.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function choose(item: T) {
    onSelect(item)
    setQuery(getLabel(item))
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + items.length) % items.length)
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      choose(items[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', width: 360, maxWidth: '100%' }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 10px',
          fontSize: 15,
          border: '1px solid #ccc',
          borderRadius: 8,
        }}
      />
      {open && (
        <ul
          style={{
            position: 'absolute',
            zIndex: 10,
            top: '100%',
            left: 0,
            right: 0,
            margin: '4px 0 0',
            padding: 0,
            listStyle: 'none',
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {loading && <li style={{ padding: '8px 10px', color: '#888' }}>загрузка…</li>}
          {!loading && items.length === 0 && (
            <li style={{ padding: '8px 10px', color: '#888' }}>ничего не найдено</li>
          )}
          {!loading &&
            items.map((item, i) => (
              <li
                key={getKey(item)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(item)
                }}
                onMouseEnter={() => setActive(i)}
                style={{
                  padding: '8px 10px',
                  cursor: 'pointer',
                  background: i === active ? '#f0f4ff' : 'transparent',
                }}
              >
                {renderItem ? renderItem(item) : getLabel(item)}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
