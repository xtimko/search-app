import { useEffect, useState } from 'react'
import { fetchSellerProfile, responseLabel, type SellerProfile } from '../api/sellers'

function stars(n: number): string {
  return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n))
}

function sizeOf(l: { sizeUs: string | null; sizeEu: string | null; size: string | null }): string {
  return l.sizeUs || l.sizeEu ? [l.sizeUs && `US ${l.sizeUs}`, l.sizeEu && `EU ${l.sizeEu}`].filter(Boolean).join('/') : l.size || ''
}

// Мини-профиль продавца поверх страницы: метрики, отзывы, товары в наличии.
export function SellerModal({ sellerId, onClose }: { sellerId: number; onClose: () => void }) {
  const [data, setData] = useState<SellerProfile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSellerProfile(sellerId)
      .then(setData)
      .catch(() => setError('не удалось загрузить профиль'))
  }, [sellerId])

  const s = data?.seller
  const st = data?.stats
  const resp = st ? responseLabel(st.medianResponseMin) : null

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px' }}
    >
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '100%', background: 'var(--bg-card)' }}>
        {error && <div className="text-danger">{error}</div>}
        {!data && !error && <div className="text-3">загружаем…</div>}
        {s && st && (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {s.photo ? (
                <img src={s.photo} alt="" style={{ width: 52, height: 52, borderRadius: '50%' }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-elev)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, color: 'var(--text-2)' }}>
                  {(s.vkName || s.nick).slice(0, 1).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {s.vkName || s.nick}
                  {s.status === 'approved' && <span className="text-success" style={{ fontSize: 13 }}> ✓ проверенный</span>}
                </div>
                <div className="text-3" style={{ fontSize: 12 }}>
                  {s.city && `${s.city} · `}
                  {s.experience && `стаж: ${s.experience} · `}
                  на площадке с {new Date(s.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>
                Закрыть
              </button>
            </div>

            {s.description && <div className="text-2" style={{ fontSize: 13, marginTop: 10 }}>{s.description}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginTop: 14 }}>
              <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 12px' }}>
                <div className="text-accent" style={{ fontWeight: 800, fontSize: 16 }}>
                  {st.avgRating != null ? `${stars(st.avgRating)} ${st.avgRating}` : '—'}
                </div>
                <div className="text-3" style={{ fontSize: 11 }}>оценка · {st.reviewsCount} отз.</div>
              </div>
              <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{st.dealsCompleted}</div>
                <div className="text-3" style={{ fontSize: 11 }}>сделок завершено</div>
              </div>
              {st.completionRate != null && (
                <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{st.completionRate}%</div>
                  <div className="text-3" style={{ fontSize: 11 }}>доводит до конца</div>
                </div>
              )}
              {resp && (
                <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{resp}</div>
                  <div className="text-3" style={{ fontSize: 11 }}>отвечает</div>
                </div>
              )}
            </div>

            {data.reviews.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 14, margin: '16px 0 8px' }}>Отзывы</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {data.reviews.map((r) => (
                    <div key={r.id} style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span className="text-accent" style={{ fontSize: 13, fontWeight: 700 }}>{stars(r.rating)}</span>
                        <span className="text-3" style={{ fontSize: 11 }}>
                          {r.author.vkName || r.author.nick} · {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      {r.text && <div style={{ fontSize: 13, marginTop: 4 }}>{r.text}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {data.listings.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 14, margin: '16px 0 8px' }}>В наличии ({data.listings.length})</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {data.listings.map((l) => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.model.brand.name} {l.model.name}
                        <span className="text-3"> {sizeOf(l)}{l.colorway ? ` · ${l.colorway}` : ''}</span>
                      </span>
                      <span className="text-accent" style={{ fontWeight: 700, flexShrink: 0 }}>{l.price.toLocaleString('ru-RU')} ₽</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
