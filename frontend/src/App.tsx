import { useState } from 'react'
import { HomePage } from './components/HomePage'
import { SearchPage } from './components/SearchPage'
import { SellerPage } from './components/SellerPage'
import { ProfilePage } from './components/ProfilePage'
import { AdminPage } from './components/AdminPage'

export type Tab = 'home' | 'search' | 'requests' | 'seller' | 'profile' | 'admin'

const NAV: { id: Tab; label: string; soon?: boolean }[] = [
  { id: 'home', label: 'Главная' },
  { id: 'search', label: 'Поиск' },
  { id: 'requests', label: 'Запросы', soon: true },
  { id: 'seller', label: 'Мой сток' },
  { id: 'profile', label: 'Профиль' },
  { id: 'admin', label: 'Админ' },
]

// Оболочка Search-app: тёмный street-стиль, топбар с навигацией, контент по центру.
export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  // Стартовые параметры для страницы поиска (прокидываются с главной).
  const [searchInit, setSearchInit] = useState<{ q?: string; categorySlug?: string; seed: number }>({ seed: 0 })

  function goSearch(q?: string, categorySlug?: string) {
    setSearchInit((s) => ({ q, categorySlug, seed: s.seed + 1 }))
    setTab('search')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 50 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 20, height: 56 }}>
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
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px 48px', width: '100%', flex: 1 }}>
        {tab === 'home' && <HomePage onSearch={goSearch} />}
        {tab === 'search' && <SearchPage key={searchInit.seed} initialQ={searchInit.q} initialCategorySlug={searchInit.categorySlug} />}
        {tab === 'seller' && <SellerPage />}
        {tab === 'profile' && <ProfilePage />}
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
