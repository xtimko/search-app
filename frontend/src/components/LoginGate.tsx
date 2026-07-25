import { useState } from 'react'
import { loginUrl, testLogin } from '../api/auth'

// Тестовый вход по имени — ТОЛЬКО в локальной dev-сборке (в проде его нет:
// бэкенд отвечает 403, а форма не рендерится). Удобно для локальной отладки.
function DevTestLogin() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function enter() {
    const n = name.trim()
    if (n.length < 2) {
      setError('Укажи имя (минимум 2 символа)')
      return
    }
    setBusy(true)
    setError('')
    try {
      await testLogin(n)
      window.location.reload()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <>
      <div className="text-3" style={{ fontSize: 12, margin: '18px 0 10px' }}>dev-режим: тестовый вход</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enter()}
          placeholder="Твоё имя"
        />
        <button className="btn btn-outline" disabled={busy} onClick={enter}>
          Войти
        </button>
      </div>
      {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 8 }}>{error}</div>}
    </>
  )
}

// Гейт приватных разделов: вход через VK ID (серверный OAuth — /api/auth/vk/login).
export function LoginGate({ what }: { what: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 36, marginTop: 20, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>Вход в Search-app</div>
      <div className="text-2" style={{ fontSize: 14, margin: '8px 0 20px' }}>{what} доступен после входа через ВКонтакте.</div>

      <a className="btn btn-vk btn-lg btn-block" href={loginUrl()}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ marginRight: 2 }}>
          <path d="M13.16 18c-5.06 0-8.28-3.53-8.4-9.4h2.6c.08 4.3 2.05 6.13 3.56 6.5V8.6h2.47v3.75c1.46-.16 3-1.9 3.5-3.75h2.44c-.4 2.28-2.05 4.02-3.22 4.73 1.17.58 3.05 2.1 3.77 4.67h-2.69c-.56-1.78-1.96-3.16-3.8-3.35V18h-.3z" />
        </svg>
        Войти через ВКонтакте
      </a>
      <div className="hint" style={{ textAlign: 'left', marginTop: 10 }}>
        Берём только имя и фото профиля — чтобы показать вас покупателям. Пароль не запрашиваем.
      </div>

      {import.meta.env.DEV && <DevTestLogin />}
    </div>
  )
}
