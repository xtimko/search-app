import { useEffect, useState } from 'react'
import { ProfileForm } from './ProfileForm'
import type { AuthUser } from '../api/auth'
import { fetchSellerProfile, responseLabel, type SellerProfile } from '../api/sellers'

const STATUS: Record<AuthUser['status'], { text: string; cls: string }> = {
  pending: { text: 'на модерации', cls: 'text-2' },
  approved: { text: '✓ проверенный', cls: 'text-success' },
  blocked: { text: 'заблокирован', cls: 'text-danger' },
}

// Раздел «Профиль»: VK-аккаунт + данные продавца + задел под рейтинг и отзывы.
export function ProfilePage({ auth, onLogout }: { auth: AuthUser; onLogout: () => void }) {
  const st = STATUS[auth.status]
  const [pub, setPub] = useState<SellerProfile | null>(null)

  useEffect(() => {
    fetchSellerProfile(auth.id).then(setPub).catch(() => {})
  }, [auth.id])

  const stats = pub?.stats
  const resp = stats ? responseLabel(stats.medianResponseMin) : null

  return (
    <div style={{ paddingTop: 20, maxWidth: 640 }}>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        {auth.photo ? (
          <img src={auth.photo} alt="" style={{ width: 56, height: 56, borderRadius: '50%' }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-elev)' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {auth.vkName || auth.nick}
            {auth.dev && <span className="text-3" style={{ fontWeight: 400 }}> (dev-режим)</span>}
          </div>
          <div className="text-3" style={{ fontSize: 12 }}>
            аккаунт ВКонтакте · <span className={st.cls} style={{ fontWeight: 600 }}>{st.text}</span>
          </div>
        </div>
        {!auth.dev && (
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>
            Выйти
          </button>
        )}
      </div>

      <ProfileForm />

      <div className="section-title">Рейтинг и отзывы</div>
      <div className="card">
        {!stats && <div className="text-3" style={{ fontSize: 13 }}>считаем…</div>}
        {stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
              <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 12px' }}>
                <div className="text-accent" style={{ fontWeight: 800, fontSize: 16 }}>
                  {stats.avgRating != null ? `★ ${stats.avgRating}` : '—'}
                </div>
                <div className="text-3" style={{ fontSize: 11 }}>оценка · {stats.reviewsCount} отз.</div>
              </div>
              <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{stats.dealsCompleted}</div>
                <div className="text-3" style={{ fontSize: 11 }}>сделок завершено</div>
              </div>
              <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{stats.completionRate != null ? `${stats.completionRate}%` : '—'}</div>
                <div className="text-3" style={{ fontSize: 11 }}>доводит до конца</div>
              </div>
              <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{resp ?? '—'}</div>
                <div className="text-3" style={{ fontSize: 11 }}>скорость ответа</div>
              </div>
            </div>
            {pub && pub.reviews.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {pub.reviews.map((r) => (
                  <div key={r.id} style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="text-accent" style={{ fontSize: 13, fontWeight: 700 }}>
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </span>
                      <span className="text-3" style={{ fontSize: 11 }}>
                        {r.author.vkName || r.author.nick} · {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    {r.text && <div style={{ fontSize: 13, marginTop: 4 }}>{r.text}</div>}
                  </div>
                ))}
              </div>
            )}
            {stats.reviewsCount === 0 && (
              <div className="hint">Отзывы появятся после завершённых сделок: покупатель оценивает сделку в разделе «Чаты → Сделки».</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
