import { useEffect, useState } from 'react'
import { fetchSellerProfile, responseLabel, type SellerProfile } from '../api/sellers'
import { VerifiedBadge, vkProfileUrl } from './VerifiedBadge'

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>{s.vkName || s.nick}</span>
                  {s.verified && <VerifiedBadge label />}
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

            {/* Неподделываемая страница ВК (Слой 1): её видит покупатель и сам
                отличает настоящего продавца от клона (у клона — пустая новая страница). */}
            <a
              href={vkProfileUrl(s.vkId)}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 12px', background: 'var(--bg-elev)', textDecoration: 'none', color: 'var(--text)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--vk)" aria-hidden style={{ flexShrink: 0 }}>
                <path d="M13.16 18c-5.06 0-8.28-3.53-8.4-9.4h2.6c.08 4.3 2.05 6.13 3.56 6.5V8.6h2.47v3.75c1.46-.16 3-1.9 3.5-3.75h2.44c-.4 2.28-2.05 4.02-3.22 4.73 1.17.58 3.05 2.1 3.77 4.67h-2.69c-.56-1.78-1.96-3.16-3.8-3.35V18h-.3z" />
              </svg>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Страница ВКонтакте</div>
                <div className="text-3" style={{ fontSize: 11 }}>подтверждена входом · открой и проверь, что это настоящий профиль</div>
              </div>
              <span className="text-3" style={{ fontSize: 16, flexShrink: 0 }}>↗</span>
            </a>

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
