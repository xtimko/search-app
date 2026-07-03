import { useState } from 'react'
import type { SearchResult } from '../api/search'
import { SellerModal } from './SellerModal'

function sizeLabel(r: SearchResult): string {
  if (r.sizeUs || r.sizeEu) {
    return [r.sizeUs && `US ${r.sizeUs}`, r.sizeEu && `EU ${r.sizeEu}`].filter(Boolean).join(' / ')
  }
  return r.size || '—'
}

// Карточка товара в выдаче (поиск, главная). Клик по продавцу — его мини-профиль.
export function ResultCard({ r, compact, onContact }: { r: SearchResult; compact?: boolean; onContact?: (r: SearchResult) => void }) {
  const [showSeller, setShowSeller] = useState(false)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {r.photo ? (
          <img src={r.photo} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--bg-elev)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 20, fontWeight: 700 }}>
            {r.model.brand.name.slice(0, 1)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {r.model.brand.name} {r.model.name}
          </div>
          <div className="text-2" style={{ fontSize: 13 }}>
            {sizeLabel(r)} · {r.condition === 'new' ? 'новое' : 'б/у'}
            {r.fitting && ' · примерка'}
          </div>
          <div className="text-accent" style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
            {r.price.toLocaleString('ru-RU')} ₽
          </div>
          {!compact && (
            <div
              className="text-3"
              style={{ fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
              onClick={() => setShowSeller(true)}
              title="профиль продавца"
            >
              {r.colorway ? `${r.colorway} · ` : ''}
              <span style={{ textDecoration: 'underline dotted' }}>{r.seller.vkName || r.seller.nick}</span>
              {r.seller.status === 'approved' && <span className="text-success"> ✓</span>}
              {r.seller.rating != null && (
                <span className="text-accent"> ★{r.seller.rating}{r.seller.reviewsCount ? ` (${r.seller.reviewsCount})` : ''}</span>
              )}
              {r.seller.dealsCompleted > 0 && ` · ${r.seller.dealsCompleted} сд.`}
              {(r.city || r.seller.city) && ` · ${r.city || r.seller.city}`}
            </div>
          )}
        </div>
      </div>
      <button
        className="btn btn-accent-outline btn-sm btn-block"
        onClick={() => (onContact ? onContact(r) : window.open(r.seller.contact, '_blank'))}
      >
        Написать продавцу
      </button>
      {showSeller && <SellerModal sellerId={r.seller.id} onClose={() => setShowSeller(false)} />}
    </div>
  )
}
