import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HomePage } from './components/HomePage'
import { SearchPage } from './components/SearchPage'
import { SellerPage } from './components/SellerPage'
import { ProfilePage } from './components/ProfilePage'
import { AdminPage } from './components/AdminPage'
import { ChatsPage } from './components/ChatsPage'
import { RequestsPage } from './components/RequestsPage'
import { AnalyticsPage } from './components/AnalyticsPage'
import { LoginGate } from './components/LoginGate'
import { fetchAuthMe, logout, type AuthUser } from './api/auth'
import { openChat, fetchUnread } from './api/chats'
import type { SearchResult } from './api/search'

export type Tab = 'home' | 'search' | 'requests' | 'chats' | 'seller' | 'analytics' | 'profile' | 'admin'

const NAV: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Главная' },
  { id: 'search', label: 'Поиск' },
  { id: 'requests', label: 'Запросы' },
  { id: 'chats', label: 'Чаты' },
  { id: 'seller', label: 'Мой сток' },
  { id: 'analytics', label: 'Аналитика' },
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

  // Плавающая активная пилюля нижнего таб-бара: замеряем активную кнопку и
  // анимированно переезжаем к ней. null — если активной вкладки нет в баре.
  const bottomNavRef = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const recalcPill = useCallback(() => {
    const nav = bottomNavRef.current
    if (isDesktop || !nav) return setPill(null)
    const idx = MOBILE_TABS.findIndex((t) => t.id === tab)
    if (idx < 0) return setPill(null)
    const btn = nav.querySelectorAll('button')[idx] as HTMLElement | undefined
    if (!btn) return
    const nr = nav.getBoundingClientRect()
    const br = btn.getBoundingClientRect()
    setPill({ x: br.left - nr.left - nav.clientLeft, y: br.top - nr.top - nav.clientTop, w: br.width, h: br.height })
  }, [tab, isDesktop])
  useLayoutEffect(() => { recalcPill() }, [recalcPill])
  useEffect(() => {
    window.addEventListener('resize', recalcPill)
    return () => window.removeEventListener('resize', recalcPill)
  }, [recalcPill])

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
      <header style={{ borderBottom: '1px solid var(--glass-brd)', position: 'sticky', top: 0, background: 'var(--glass-bg)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', zIndex: 50 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 16, height: 58 }}>
          <div className="display" style={{ fontSize: 23, cursor: 'pointer', flexShrink: 0 }} onClick={() => setTab('home')}>
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

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: `0 16px ${isDesktop ? 48 : 108}px`, width: '100%', flex: 1 }}>
        {tab === 'home' && <HomePage onSearch={goSearch} onContact={contactSeller} onGoRequests={() => setTab('requests')} />}
        {tab === 'search' && (
          <SearchPage key={searchInit.seed} initialQ={searchInit.q} initialCategorySlug={searchInit.categorySlug} onContact={contactSeller} />
        )}
        {tab === 'requests' && <RequestsPage meId={auth?.id ?? null} onOpenChat={goChat} onNeedAuth={() => setTab('profile')} />}
        {tab === 'chats' &&
          (authed ? <ChatsPage key={chatInit.seed} meId={auth.id} initialChatId={chatInit.chatId} /> : <LoginGate what="Раздел «Чаты»" />)}
        {tab === 'seller' && (authed ? <SellerPage /> : <LoginGate what="Раздел «Мой сток»" />)}
        {tab === 'analytics' && (authed ? <AnalyticsPage /> : <LoginGate what="Аналитика спроса" />)}
        {tab === 'profile' && (authed ? <ProfilePage auth={auth} onLogout={onLogout} onOpenChat={goChat} onOpenAnalytics={() => setTab('analytics')} /> : <LoginGate what="Раздел «Профиль»" />)}
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
          ref={bottomNavRef}
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(430px, calc(100% - 24px))',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-strong)',
            borderRadius: 24,
            boxShadow: 'var(--shadow-3)',
            display: 'grid',
            gridTemplateColumns: `repeat(${MOBILE_TABS.length}, 1fr)`,
            padding: 7,
            gap: 2,
            zIndex: 60,
          }}
        >
          {pill && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: pill.w,
                height: pill.h,
                transform: `translate(${pill.x}px, ${pill.y}px)`,
                background: 'var(--accent-dim)',
                borderRadius: 17,
                transition: 'transform 0.34s var(--ease), width 0.34s var(--ease)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
          )}
          {MOBILE_TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                aria-current={active ? 'page' : undefined}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 17,
                  padding: '10px 0 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  cursor: 'pointer',
                  color: active ? 'var(--accent)' : 'var(--text-3)',
                  position: 'relative',
                  zIndex: 1,
                  fontFamily: 'inherit',
                  transition: 'color 0.2s var(--ease)',
                }}
              >
                <TabIcon tab={t.id} />
                <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500 }}>{t.label}</span>
                {t.id === 'chats' && unread > 0 && (
                  <span style={{ position: 'absolute', top: 3, left: 'calc(50% + 7px)', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 10, fontWeight: 700, borderRadius: 9, padding: '0 5px', lineHeight: '15px' }}>
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
