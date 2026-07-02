import { ProfileForm } from './ProfileForm'
import type { AuthUser } from '../api/auth'

const STATUS: Record<AuthUser['status'], { text: string; cls: string }> = {
  pending: { text: 'на модерации', cls: 'text-2' },
  approved: { text: '✓ проверенный', cls: 'text-success' },
  blocked: { text: 'заблокирован', cls: 'text-danger' },
}

// Раздел «Профиль»: VK-аккаунт + данные продавца + задел под рейтинг и отзывы.
export function ProfilePage({ auth, onLogout }: { auth: AuthUser; onLogout: () => void }) {
  const st = STATUS[auth.status]

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

      <div className="section-title">Рейтинг и отзывы <span className="badge">скоро</span></div>
      <div className="card">
        <div className="text-2" style={{ fontSize: 13 }}>
          Здесь появится рейтинг продавца: подтверждённые сделки, отзывы покупателей, скорость ответа и стаж на площадке.
          Также можно будет привязать ссылку на пост с отзывами в ВК.
        </div>
      </div>
    </div>
  )
}
