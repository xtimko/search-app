import { useState } from 'react'
import type { CatalogItem } from '../api/catalog'

// Карточка модели в каталоге (как на StockX): фото, название, «от X ₽ · N офферов».
export function ProductCard({ item, onOpen }: { item: CatalogItem; onOpen: (modelId: number) => void }) {
  const [imgOk, setImgOk] = useState(true)
  const m = item.model
  return (
    <div className="card card-hover" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }} onClick={() => onOpen(m.id)}>
      <div style={{ aspectRatio: '4 / 3', borderRadius: 10, background: 'var(--bg-elev)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {m.imageUrl && imgOk ? (
          <img src={m.imageUrl} alt={`${m.brand.name} ${m.name}`} onError={() => setImgOk(false)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span className="display text-3" style={{ fontSize: 30 }}>{m.brand.name.slice(0, 1)}</span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="text-3" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.brand.name}</div>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
        {item.offersCount > 0 ? (
          <div style={{ marginTop: 4, fontSize: 13 }}>
            <span className="text-3">от </span>
            <b className="tnum">{item.minPrice!.toLocaleString('ru-RU')} ₽</b>
            <span className="text-3"> · {item.offersCount} офф.</span>
          </div>
        ) : (
          <div className="text-3" style={{ marginTop: 4, fontSize: 13 }}>нет в наличии — оставь запрос</div>
        )}
      </div>
    </div>
  )
}
