import { useEffect, useRef, useState } from 'react'
import { fetchSuggest, type Suggestion } from '../api/catalog'

// Глобальный поиск в хедере (как на StockX): живые подсказки — мини-фото,
// бренд+модель, «от X ₽». Клик — на товар, Enter — в каталог.
export function HeaderSearch({
  onOpenProduct,
  onSearch,
  autoFocus,
  onClose,
}: {
  onOpenProduct: (id: number) => void
  onSearch: (q: string) => void
  autoFocus?: boolean
  onClose?: () => void
}) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) {
      setItems([])
      setOpen(false)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      fetchSuggest(t)
        .then((r) => {
          if (cancelled) return
          setItems(r.results)
          setOpen(true)
          setActive(-1)
        })
        .catch(() => {})
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [q])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function submit() {
    const t = q.trim()
    if (!t) return
    setOpen(false)
    onClose?.()
    onSearch(t)
  }

  function choose(s: Suggestion) {
    setOpen(false)
    setQ('')
    onClose?.()
    onOpenProduct(s.id)
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0 6px 0 12px', transition: 'border-color 0.2s var(--ease), box-shadow 0.2s var(--ease)' }}
        onFocusCapture={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--focus-brd)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 18px var(--focus-glow)' }}
        onBlurCapture={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4.2-4.2" />
        </svg>
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); setActive((a) => (a + 1) % items.length) }
            else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length) }
            else if (e.key === 'Enter') { active >= 0 && items[active] ? choose(items[active]) : submit() }
            else if (e.key === 'Escape') { setOpen(false); onClose?.() }
          }}
          onFocus={() => items.length > 0 && setOpen(true)}
          placeholder="Поиск: jordan 4, самба, birkin…"
          aria-label="Поиск по каталогу"
          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, padding: '9px 0' }}
        />
        {q && (
          <button className="btn btn-ghost btn-sm" style={{ minHeight: 28, padding: '2px 8px' }} onClick={() => { setQ(''); setOpen(false) }} aria-label="очистить">✕</button>
        )}
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: 'var(--shadow-3)', overflow: 'hidden', zIndex: 80 }}>
          {items.length === 0 && <div className="text-3" style={{ padding: '10px 14px', fontSize: 13 }}>ничего не найдено</div>}
          {items.map((s, i) => (
            <div
              key={s.id}
              onMouseDown={(e) => { e.preventDefault(); choose(s) }}
              onMouseEnter={() => setActive(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', background: i === active ? 'var(--accent-dim)' : 'transparent' }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--bg-elev)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.photo ? (
                  <img src={s.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span className="text-3" style={{ fontWeight: 700, fontSize: 15 }}>{s.brand.slice(0, 1)}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span className="text-3">{s.brand}</span> {s.name}
                </div>
                <div className="text-3" style={{ fontSize: 12 }}>
                  {s.offersCount > 0 && s.minPrice != null ? (
                    <>от <b className="tnum" style={{ color: 'var(--text)' }}>{s.minPrice.toLocaleString('ru-RU')} ₽</b> · {s.offersCount} в наличии</>
                  ) : (
                    'нет в наличии — можно оставить запрос'
                  )}
                </div>
              </div>
            </div>
          ))}
          {q.trim().length >= 2 && (
            <div onMouseDown={(e) => { e.preventDefault(); submit() }} style={{ padding: '9px 14px', cursor: 'pointer', borderTop: '1px solid var(--border)', fontSize: 13 }} className="text-2">
              Искать «{q.trim()}» в каталоге →
            </div>
          )}
        </div>
      )}
    </div>
  )
}
