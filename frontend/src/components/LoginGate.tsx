import { useState } from 'react'
import { loginUrl, testLogin } from '../api/auth'

// Гейт для приватных разделов: вход через VK ID или (временно) тестовый вход по имени.
export function LoginGate({ what }: { what: string }) {
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
    <div className="card" style={{ textAlign: 'center', padding: 36, marginTop: 20, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>Нужен вход</div>
      <div className="text-2" style={{ fontSize: 14, margin: '8px 0 18px' }}>{what} доступен после входа.</div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enter()}
          placeholder="Твоё имя"
        />
        <button className="btn btn-primary" disabled={busy} onClick={enter}>
          Войти
        </button>
      </div>
      <div className="hint" style={{ textAlign: 'left' }}>
        Тестовый режим: аккаунт по имени, без пароля. Повторный вход — с тем же именем.
      </div>
      {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 8 }}>{error}</div>}

      <div className="text-3" style={{ fontSize: 12, margin: '16px 0 10px' }}>или</div>
      <a className="btn btn-vk btn-block" href={loginUrl()}>
        Войти через VK
      </a>
      <div className="hint" style={{ textAlign: 'left' }}>Вход через VK появится после подключения VK ID.</div>
    </div>
  )
}
