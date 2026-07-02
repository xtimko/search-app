import { ProfileForm } from './ProfileForm'
import { vkProfile } from '../api/client'

// Раздел «Профиль»: данные продавца + задел под рейтинг и отзывы.
export function ProfilePage() {
  const vk = vkProfile()

  return (
    <div style={{ paddingTop: 20, maxWidth: 640 }}>
      {vk.name && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          {vk.photo ? (
            <img src={vk.photo} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-elev)' }} />
          )}
          <div>
            <div style={{ fontWeight: 700 }}>{vk.name}</div>
            <div className="text-3" style={{ fontSize: 12 }}>аккаунт ВКонтакте</div>
          </div>
        </div>
      )}

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
