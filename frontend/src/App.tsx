import { useEffect, useState } from 'react'
import { HomePage } from './components/HomePage'
import { SearchPage } from './components/SearchPage'
import { SellerPage } from './components/SellerPage'
import { ProfilePage } from './components/ProfilePage'
import { AdminPage } from './components/AdminPage'
import { ChatsPage } from './components/ChatsPage'
import { RequestsPage } from './components/RequestsPage'
import { LoginGate } from './components/LoginGate'
import { fetchAuthMe, logout, type AuthUser } from './api/auth'
import { openChat, fetchUnread } from './api/chats'
import type { SearchResult } from './api/search'

export type Tab = 'home' | 'search' | 'requests' | 'chats' | 'seller' | 'profile' | 'admin'

const NAV: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Главная' },
  { id: 'search', label: 'Поиск' },
  { id: 'requests', label: 'Запросы' },
  { id: 'chats', label: 'Чаты' },
  { id: 'seller', label: 'Мой сток' },
  { id: 'profile', label: 'Профиль' },
  { id: 'admin', label: 'Админ' },
]

// Иконки нижнего таб-бара (инлайн-SVG, без внешних библиотек).
function TabIcon({ tab }: { tab: Tab }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (tab) {
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4.2-4.2" />
        </svg>
      )
    case 'requests':
      return (
        <svg {...common}>
          <path d="M4 10v4h3l6 4V6l-6 4H4z" />
          <path d="M17 9a4 4 0 0 1 0 6" />
        </svg>
      )
    case 'chats':
      return (
        <svg {...common}>
          <path d="M4 5h16v11H8l-4 4V5z" />
        </svg>
      )
    case 'seller':
      return (
        <svg {...common}>
          <path d="M4 8l8-4 8 4v9l-8 4-8-4V8z" />
          <path d="M4 8l8 4 8-4" />
          <path d="M12 12v9" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 5-5 8-5s6.5 1 8 5" />
        </svg>
      )
  }
}

const MOBILE_TABS: { id: Tab; label: string }[] = [
  { id: 'search', label: 'Поиск' },
  { id: 'requests', label: 'Запросы' },
  { id: 'chats', label: 'Чаты' },
  { id: 'seller', label: 'Сток' },
  { id: 'profile', label: 'Профиль' },
]

function useIsDesktop(): boolean {
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900)
  useEffect(() => {
    const on = () => setD(window.innerWidth >= 900)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return d
}

// Оболочка Search-app: на десктопе — навигация в топбаре, на мобиле — нижний таб-бар.
export default function App() {
  const isDesktop = useIsDesktop()
  const [tab, setTab] = useState<Tab>('home')
  const [searchInit, setSearchInit] = useState<{ q?: string; categorySlug?: string; seed: number }>({ seed: 0 })
  const [chatInit, setChatInit] = useState<{ chatId?: number; seed: number }>({ seed: 0 })
  const [auth, setAuth] = useState<AuthUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    fetchAuthMe()
      .then(setAuth)
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (!auth) return
    let stop = false
    const tick = () => fetchUnread().then((r) => !stop && setUnread(r.count)).catch(() => {})
    tick()
    const t = setInterval(tick, 15000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [auth, tab])

  function goSearch(q?: string, categorySlug?: string) {
    setSearchInit((s) => ({ q, categorySlug, seed: s.seed + 1 }))
    setTab('search')
  }

  function goChat(chatId: number) {
    setChatInit((s) => ({ chatId, seed: s.seed + 1 }))
    setTab('chats')
  }

  async function contactSeller(r: SearchResult) {
    if (!auth) {
      window.open(r.seller.contact, '_blank')
      return
    }
    try {
      const conv = await openChat(r.id)
      goChat(conv.id)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function onLogout() {
    await logout()
    setAuth(null)
    setUnread(0)
    setTab('home')
  }

  const authed = !!auth
  const unreadBadge = (
    <span style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '0 6px' }}>
      {unread}
    </span>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 50 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 16, height: 56 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.5, cursor: 'pointer', flexShrink: 0 }} onClick={() => setTab('home')}>
            <span style={{ color: 'var(--accent)' }}>SEARCH</span>
            <span>APP</span>
          </div>
          {isDesktop && (
            <nav style={{ display: 'flex', gap: 4, overflowX: 'auto', flex: 1 }}>
              {NAV.map((n) => (
                <button
                  key={n.id}
                  className={tab === n.id ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  style={tab === n.id ? { background: 'var(--bg-elev)' } : undefined}
                  onClick={() => setTab(n.id)}
                >
                  {n.label}
                  {n.id === 'chats' && unread > 0 && unreadBadge}
                </button>
              ))}
            </nav>
          )}
          <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
            {authChecked && !authed && (
              <button className="btn btn-vk btn-sm" onClick={() => setTab('profile')}>
                Войти
              </button>
            )}
            {authed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setTab('profile')} title="профиль">
                {auth.photo ? (
                  <img src={auth.photo} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-elev)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--text-2)' }}>
                    {(auth.vkName || auth.nick).slice(0, 1).toUpperCase()}
                  </div>
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

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: `0 16px ${isDesktop ? 48 : 84}px`, width: '100%', flex: 1 }}>
        {tab === 'home' && <HomePage onSearch={goSearch} onContact={contactSeller} onGoRequests={() => setTab('requests')} />}
        {tab === 'search' && (
          <SearchPage key={searchInit.seed} initialQ={searchInit.q} initialCategorySlug={searchInit.categorySlug} onContact={contactSeller} />
        )}
        {tab === 'requests' && <RequestsPage meId={auth?.id ?? null} onOpenChat={goChat} onNeedAuth={() => setTab('profile')} />}
        {tab === 'chats' &&
          (authed ? <ChatsPage key={chatInit.seed} meId={auth.id} initialChatId={chatInit.chatId} /> : <LoginGate what="Раздел «Чаты»" />)}
        {tab === 'seller' && (authed ? <SellerPage /> : <LoginGate what="Раздел «Мой сток»" />)}
        {tab === 'profile' && (authed ? <ProfilePage auth={auth} onLogout={onLogout} onOpenChat={goChat} /> : <LoginGate what="Раздел «Профиль»" />)}
        {tab === 'admin' && <AdminPage />}
      </main>

      {isDesktop && (
        <footer style={{ borderTop: '1px solid var(--border)', padding: '18px 16px', textAlign: 'center' }}>
          <span className="text-3" style={{ fontSize: 12 }}>
            Search-app — агрегатор стока реселлеров. Сделки и оплата — напрямую между пользователями.
          </span>
        </footer>
      )}

      {!isDesktop && (
        <nav
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: `repeat(${MOBILE_TABS.length}, 1fr)`,
            zIndex: 60,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {MOBILE_TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 0 7px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  cursor: 'pointer',
                  color: active ? 'var(--accent)' : 'var(--text-3)',
                  position: 'relative',
                  fontFamily: 'inherit',
                }}
              >
                <TabIcon tab={t.id} />
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{t.label}</span>
                {t.id === 'chats' && unread > 0 && (
                  <span style={{ position: 'absolute', top: 4, right: '50%', marginRight: -20, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '0 5px' }}>
                    {unread}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
