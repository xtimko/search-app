import { useState } from 'react'
import { retailDiscount, type CatalogItem } from '../api/catalog'
import { useFavoritesVersion, isFavorite, toggleFavorite } from '../favorites'

// Сердечко «Слежу» поверх фото карточки.
export function HeartButton({ modelId, size = 30 }: { modelId: number; size?: number }) {
  useFavoritesVersion()
  const fav = isFavorite(modelId)
  return (
    <button
      aria-pressed={fav}
      aria-label={fav ? 'убрать из «Слежу»' : 'следить за моделью'}
      title={fav ? 'убрать из «Слежу»' : 'следить за моделью'}
      onClick={(e) => {
        e.stopPropagation()
        toggleFavorite(modelId)
      }}
      style={{
        width: size, height: size, borderRadius: '50%', border: '1px solid var(--border-strong)',
        background: 'var(--glass-bg)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
        color: fav ? 'var(--danger)' : 'var(--text-2)', transition: 'color 0.15s, transform 0.15s',
      }}
    >
      <svg width={size * 0.53} height={size * 0.53} viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
        <path d="M12 20.7S4.5 16.3 2.4 11.6C.9 8.2 3 4.8 6.6 4.8c2.2 0 3.7 1.2 4.6 2.6.9-1.4 2.4-2.6 4.6-2.6 3.6 0 5.7 3.4 4.2 6.8C17.9 16.3 12 20.7 12 20.7z" />
      </svg>
    </button>
  )
}

// Карточка модели в каталоге (как на StockX): фото, название, расцветки в
// наличии (главный ориентир реселлера), «от X ₽ · N офферов». Бейдж скидки —
// НА фото, все блоки фиксированной высоты: карточки в ряду строго одинаковые.
export function ProductCard({ item, onOpen }: { item: CatalogItem; onOpen: (modelId: number) => void }) {
  const [imgOk, setImgOk] = useState(true)
  const m = item.model
  const img = item.photo
  const discount = retailDiscount(item.minPrice, m.retailPrice)
  // Расцветки: из живых офферов; если продавцы не указали — паспортная расцветка модели.
  const colors = item.colorways?.length ? item.colorways : m.colorway ? [m.colorway] : []
  const colorLabel = colors.slice(0, 2).join(' · ') + (colors.length > 2 ? ` +${colors.length - 2}` : '')
  return (
    <div className="card card-hover" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }} onClick={() => onOpen(m.id)}>
      <div style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 10, background: 'var(--bg-elev)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        {img && imgOk ? (
          <img src={img} alt={`${m.brand.name} ${m.name}`} onError={() => setImgOk(false)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span className="display text-3" style={{ fontSize: 30 }}>{m.brand.name.slice(0, 1)}</span>
        )}
        {m.status === 'pending' && (
          <span className="badge" style={{ position: 'absolute', top: 8, left: 8, color: 'var(--warn)', borderColor: 'var(--warn)', background: 'var(--bg)' }}>на модерации</span>
        )}
        {discount && (
          <span className="badge tnum" title="мин. цена ниже ритейла" style={{ position: 'absolute', left: 8, bottom: 8, color: 'var(--success)', borderColor: 'var(--success)', background: 'var(--bg-card)' }}>−{discount}%</span>
        )}
        <span style={{ position: 'absolute', top: 8, right: 8 }}>
          <HeartButton modelId={m.id} />
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="text-3" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.brand.name}</div>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
        {/* строка расцветок всегда занимает место — высота карточек не пляшет */}
        <div className="text-2" style={{ fontSize: 12, height: 18, lineHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={colors.join(', ') || undefined}>
          {colorLabel}
        </div>
        {item.offersCount > 0 ? (
          <div style={{ marginTop: 2, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span className="text-3">от </span>
            <b className="tnum">{item.minPrice!.toLocaleString('ru-RU')} ₽</b>
            <span className="text-3"> · {item.offersCount} офф.</span>
          </div>
        ) : (
          <div className="text-3" style={{ marginTop: 2, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>нет в наличии — оставь запрос</div>
        )}
      </div>
    </div>
  )
}
