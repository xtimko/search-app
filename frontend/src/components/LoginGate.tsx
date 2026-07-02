import { loginUrl } from '../api/auth'

// Гейт для приватных разделов: предлагает войти через VK ID.
export function LoginGate({ what }: { what: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 40, marginTop: 20, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>Войди через ВКонтакте</div>
      <div className="text-2" style={{ fontSize: 14, margin: '8px 0 18px' }}>
        {what} доступен после входа. Один аккаунт — одна страница ВК: имя и фото подтянутся автоматически.
      </div>
      <a className="btn btn-vk btn-lg" href={loginUrl()}>
        Войти через VK
      </a>
    </div>
  )
}
