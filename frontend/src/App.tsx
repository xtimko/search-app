import { useEffect, useState } from 'react'
import { HomePage } from './components/HomePage'
import { SearchPage } from './components/SearchPage'
import { SellerPage } from './components/SellerPage'
import { ProfilePage } from './components/ProfilePage'
import { AdminPage } from './components/AdminPage'
import { LoginGate } from './components/LoginGate'
import { fetchAuthMe, logout, loginUrl, type AuthUser } from './api/auth'

export type Tab = 'home' | 'search' | 'requests' | 'seller' | 'profile' | 'admin'

const NAV: { id: Tab; label: string; soon?: boolean }[] = [
  { id: 'home', label: 'Главная' },
  { id: 'search', label: 'Поиск' },
  { id: 'requests', label: 'Запросы', soon: true },
  { id: 'seller', label: 'Мой сток' },
  { id: 'profile', label: 'Профиль' },
  { id: 'admin', label: 'Админ' },
]

// Оболочка Search-app: топбар с навигацией и входом через VK ID, контент по центру.
export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [searchInit, setSearchInit] = useState<{ q?: string; categorySlug?: string; seed: number }>({ seed: 0 })
  const [auth, setAuth] = useState<AuthUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    fetchAuthMe()
      .then(setAuth)
      .finally(() => setAuthChecked(true))
  }, [])

  function goSearch(q?: string, categorySlug?: string) {
    setSearchInit((s) => ({ q, categorySlug, seed: s.seed + 1 }))
    setTab('search')
  }

  async function onLogout() {
    await logout()
    setAuth(null)
    setTab('home')
  }

  const authed = !!auth

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 50 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 16, height: 56 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.5, cursor: 'pointer', flexShrink: 0 }} onClick={() => setTab('home')}>
            <span style={{ color: 'var(--accent)' }}>SEARCH</span>
            <span>APP</span>
          </div>
          <nav style={{ display: 'flex', gap: 4, overflowX: 'auto', flex: 1 }}>
            {NAV.map((n) => (
              <button
                key={n.id}
                className={tab === n.id ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                style={tab === n.id ? { background: 'var(--bg-elev)' } : undefined}
                onClick={() => !n.soon && setTab(n.id)}
                title={n.soon ? 'скоро' : undefined}
              >
                {n.label}
                {n.soon && <span className="badge" style={{ fontSize: 10 }}>скоро</span>}
              </button>
            ))}
          </nav>
          <div style={{ flexShrink: 0 }}>
            {authChecked && !authed && (
              <a className="btn btn-vk btn-sm" href={loginUrl()}>
                Войти через VK
              </a>
            )}
            {authed && (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                onClick={() => setTab('profile')}
                title="профиль"
              >
                {auth.photo ? (
                  <img src={auth.photo} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-elev)' }} />
                )}
                <span style={{ fontSize: 13, fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {auth.vkName || auth.nick}
                  {auth.dev && <span className="text-3"> (dev)</span>}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px 48px', width: '100%', flex: 1 }}>
        {tab === 'home' && <HomePage onSearch={goSearch} />}
        {tab === 'search' && <SearchPage key={searchInit.seed} initialQ={searchInit.q} initialCategorySlug={searchInit.categorySlug} />}
        {tab === 'seller' && (authed ? <SellerPage /> : <LoginGate what="Раздел «Мой сток»" />)}
        {tab === 'profile' && (authed ? <ProfilePage auth={auth} onLogout={onLogout} /> : <LoginGate what="Раздел «Профиль»" />)}
        {tab === 'admin' && <AdminPage />}
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '18px 16px', textAlign: 'center' }}>
        <span className="text-3" style={{ fontSize: 12 }}>
          Search-app — агрегатор стока реселлеров. Сделки и оплата — напрямую между пользователями.
        </span>
      </footer>
    </div>
  )
}
