import { useEffect, useState } from 'react'
import { fetchTrends } from '../api/catalog'

// Полоска «Сейчас ищут» под хедером (как trending-строка StockX).
// Данные — топ моделей по поискам за 7 дней (фолбэк: топ по офферам).
export function TrendsBar({ onOpenProduct }: { onOpenProduct: (id: number) => void }) {
  const [items, setItems] = useState<{ id: number; label: string }[]>([])

  useEffect(() => {
    fetchTrends().then((r) => setItems(r.results)).catch(() => {})
  }, [])

  if (items.length === 0) return null
  return (
    <div style={{ borderBottom: '1px solid var(--glass-brd)', background: 'var(--bg-1)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, height: 34, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <span className="text-3" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Сейчас ищут</span>
        {items.map((t) => (
          <button
            key={t.id}
            onClick={() => onOpenProduct(t.id)}
            className="text-2"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: '4px 8px', borderRadius: 8, whiteSpace: 'nowrap', transition: 'color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '')}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
