import { useEffect, useRef, useState, type ReactNode } from 'react'

interface AutocompleteProps<T> {
  fetcher: (query: string) => Promise<T[]>
  onSelect: (item: T) => void
  getKey: (item: T) => string | number
  getLabel: (item: T) => string
  renderItem?: (item: T) => ReactNode
  placeholder?: string
  minChars?: number
}

// Поле автоподстановки: debounce, навигация клавишами, закрытие по клику вне.
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
    <div ref={boxRef} style={{ position: 'relative', width: '100%' }}>
      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      {open && (
        <ul
          style={{
            position: 'absolute',
            zIndex: 30,
            top: '100%',
            left: 0,
            right: 0,
            margin: '4px 0 0',
            padding: 4,
            listStyle: 'none',
            background: 'var(--bg-elev)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {loading && <li style={{ padding: '8px 10px', color: 'var(--text-3)', fontSize: 13 }}>загрузка…</li>}
          {!loading && items.length === 0 && (
            <li style={{ padding: '8px 10px', color: 'var(--text-3)', fontSize: 13 }}>ничего не найдено</li>
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
                  fontSize: 14,
                  cursor: 'pointer',
                  borderRadius: 6,
                  background: i === active ? 'rgba(163,230,53,0.12)' : 'transparent',
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
