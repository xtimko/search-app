import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { HomePage } from './components/HomePage'
import { SearchPage } from './components/SearchPage'
import { LoginGate } from './components/LoginGate'
import { fetchAuthMe, logout, type AuthUser } from './api/auth'
import { openChat, fetchUnread } from './api/chats'
import { HeaderSearch } from './components/HeaderSearch'
import { TrendsBar } from './components/TrendsBar'
import { fetchCategories, type Category } from './api/directory'
import { fetchTopBrands } from './api/catalog'

// Тяжёлые страницы — по требованию (code-splitting по маршрутам).
const ProductPage = lazy(() => import('./components/ProductPage').then((m) => ({ default: m.ProductPage })))
const SellerPage = lazy(() => import('./components/SellerPage').then((m) => ({ default: m.SellerPage })))
const ProfilePage = lazy(() => import('./components/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const AdminPage = lazy(() => import('./components/AdminPage').then((m) => ({ default: m.AdminPage })))
const ChatsPage = lazy(() => import('./components/ChatsPage').then((m) => ({ default: m.ChatsPage })))
const RequestsPage = lazy(() => import('./components/RequestsPage').then((m) => ({ default: m.RequestsPage })))
const AnalyticsPage = lazy(() => import('./components/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })))

export type Tab = 'home' | 'search' | 'requests' | 'chats' | 'seller' | 'analytics' | 'profile' | 'admin'

const NAV: { id: Tab; label: string; path: string }[] = [
  { id: 'requests', label: 'Запросы', path: '/requests' },
  { id: 'chats', label: 'Чаты', path: '/chats' },
  { id: 'seller', label: 'Сток', path: '/seller' },
  { id: 'analytics', label: 'Аналитика', path: '/analytics' },
  { id: 'admin', label: 'Админ', path: '/admin' },
]

const CATEGORY_ORDER: Record<string, number> = { footwear: 0, apparel: 1 }

const MOBILE_TABS: { id: Tab; label: string; path: string }[] = [
  { id: 'search', label: 'Поиск', path: '/catalog' },
  { id: 'requests', label: 'Запросы', path: '/requests' },
  { id: 'chats', label: 'Чаты', path: '/chats' },
  { id: 'seller', label: 'Сток', path: '/seller' },
  { id: 'profile', label: 'Профиль', path: '/profile' },
]

// Заголовки вкладок браузера по маршруту (product переопределяет сам).
const TITLES: Record<string, string> = {
  '/': 'Search-app — весь сток реселлеров в одном поиске',
  '/catalog': 'Каталог — Search-app',
  '/requests': 'Запросы «Ищу» — Search-app',
  '/chats': 'Чаты — Search-app',
  '/seller': 'Мой сток — Search-app',
  '/analytics': 'Аналитика спроса — Search-app',
  '/profile': 'Профиль — Search-app',
  '/admin': 'Админ — Search-app',
}

// Текущая «вкладка» из пути (для подсветки навигации и пилюли).
function tabFromPath(pathname: string): Tab | null {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/catalog')) return 'search'
  if (pathname.startsWith('/requests')) return 'requests'
  if (pathname.startsWith('/chats')) return 'chats'
  if (pathname.startsWith('/seller')) return 'seller'
  if (pathname.startsWith('/analytics')) return 'analytics'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname.startsWith('/admin')) return 'admin'
  return null // /product/:id и прочее — без подсветки
}

function TabIcon({ tab }: { tab: Tab }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (tab) {
    case 'search':
      return (<svg {...common}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" /></svg>)
    case 'requests':
      return (<svg {...common}><path d="M4 10v4h3l6 4V6l-6 4H4z" /><path d="M17 9a4 4 0 0 1 0 6" /></svg>)
    case 'chats':
      return (<svg {...common}><path d="M4 5h16v11H8l-4 4V5z" /></svg>)
    case 'seller':
      return (<svg {...common}><path d="M4 8l8-4 8 4v9l-8 4-8-4V8z" /><path d="M4 8l8 4 8-4" /><path d="M12 12v9" /></svg>)
    default:
      return (<svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-5 8-5s6.5 1 8 5" /></svg>)
  }
}

function useIsDesktop(): boolean {
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900)
  useEffect(() => {
    const on = () => setD(window.innerWidth >= 900)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return d
}

const PageFallback = (
  <div style={{ paddingTop: 24, display: 'grid', gap: 12 }}>
    <div className="skeleton" style={{ height: 40, maxWidth: 320 }} />
    <div className="skeleton" style={{ height: 180 }} />
  </div>
)

// Гейт приватных разделов: пока идёт проверка авторизации — скелетон, иначе гейт входа.
function Gate({ authed, authChecked, what, children }: { authed: boolean; authChecked: boolean; what: string; children: React.ReactNode }) {
  if (!authChecked) return PageFallback
  return authed ? <>{children}</> : <LoginGate what={what} />
}

export default function App() {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const location = useLocation()
  const tab = tabFromPath(location.pathname)

  const [auth, setAuth] = useState<AuthUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [unread, setUnread] = useState(0)
  const [cats, setCats] = useState<Category[]>([])
  const [brandsOpen, setBrandsOpen] = useState(false)
  const [topBrands, setTopBrands] = useState<{ id: number; name: string }[]>([])
  const [mobileSearch, setMobileSearch] = useState(false)
  const brandsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchCategories()
      .then((c) => setCats(c.filter((x) => !x.parentId).sort((x, y) => (CATEGORY_ORDER[x.slug] ?? 9) - (CATEGORY_ORDER[y.slug] ?? 9) || x.name.localeCompare(y.name))))
      .catch(() => {})
    fetchTopBrands().then((r) => setTopBrands(r.results)).catch(() => {})
  }, [])

  // Закрытие меню «Бренды» по клику вне.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (brandsRef.current && !brandsRef.current.contains(e.target as Node)) setBrandsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Заголовок вкладки браузера по маршруту.
  useEffect(() => {
    const t = TITLES[location.pathname]
    if (t) document.title = t
  }, [location.pathname])

  // Плавающая активная пилюля нижнего таб-бара.
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
    fetchAuthMe().then(setAuth).finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (!auth) return
    let stop = false
    const tick = () => fetchUnread().then((r) => !stop && setUnread(r.count)).catch(() => {})
    tick()
    const t = setInterval(tick, 15000)
    return () => { stop = true; clearInterval(t) }
  }, [auth, location.pathname])

  function goSearch(q?: string, categorySlug?: string) {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (categorySlug) p.set('cat', categorySlug)
    navigate(`/catalog${p.toString() ? `?${p}` : ''}`)
  }
  function openProduct(modelId: number) {
    navigate(`/product/${modelId}`)
  }
  function goChat(chatId: number) {
    navigate(`/chats?open=${chatId}`)
  }
  // «Написать» по офферу: авторизован → внутренний чат; нет — внешний контакт.
  async function contactByListing(listingId: number, fallbackContact: string) {
    if (!auth) { window.open(fallbackContact, '_blank'); return }
    try {
      const conv = await openChat(listingId)
      goChat(conv.id)
    } catch (e) { alert((e as Error).message) }
  }
  async function onLogout() {
    await logout()
    setAuth(null)
    setUnread(0)
    navigate('/')
  }

  const authed = !!auth
  const unreadBadge = (
    <span style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '0 6px' }}>{unread}</span>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ position: 'sticky', top: 0, background: 'var(--glass-bg)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', zIndex: 50, borderBottom: '1px solid var(--glass-brd)' }}>
        {/* строка 1: лого · глобальный поиск · разделы · аватар */}
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 14, height: 58 }}>
          <div className="display" style={{ fontSize: 15, cursor: 'pointer', flexShrink: 0, letterSpacing: '0.02em' }} onClick={() => navigate('/')}>
            <span>SEARCH</span>
            <span style={{ color: 'var(--text-3)' }}>APP</span>
          </div>

          {isDesktop && (
            <div style={{ flex: 1, maxWidth: 430 }}>
              <HeaderSearch onOpenProduct={openProduct} onSearch={(q) => goSearch(q)} />
            </div>
          )}

          {isDesktop && (
            <nav style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
              {NAV.map((n) => (
                <button
                  key={n.id}
                  className={tab === n.id ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  style={tab === n.id ? { background: 'var(--bg-elev)' } : undefined}
                  onClick={() => navigate(n.path)}
                >
                  {n.label}
                  {n.id === 'chats' && unread > 0 && unreadBadge}
                </button>
              ))}
            </nav>
          )}

          {!isDesktop && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto' }}
              aria-label="поиск"
              onClick={() => setMobileSearch(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" /></svg>
            </button>
          )}

          <div style={{ flexShrink: 0 }}>
            {authChecked && !authed && (
              <button className="btn btn-vk btn-sm" onClick={() => navigate('/profile')}>Войти</button>
            )}
            {authed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/profile')} title="профиль">
                {auth.photo ? (
                  <img src={auth.photo} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-elev)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--text-2)' }}>
                    {(auth.vkName || auth.nick).slice(0, 1).toUpperCase()}
                  </div>
                )}
                {isDesktop && (
                  <span style={{ fontSize: 13, fontWeight: 600, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {auth.vkName || auth.nick}
                    {auth.dev && <span className="text-3"> (dev)</span>}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* мобильный поиск-оверлей поверх строки хедера */}
          {!isDesktop && mobileSearch && (
            <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', zIndex: 5 }}>
              <div style={{ flex: 1 }}>
                <HeaderSearch autoFocus onOpenProduct={openProduct} onSearch={(q) => goSearch(q)} onClose={() => setMobileSearch(false)} />
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setMobileSearch(false)}>Отмена</button>
            </div>
          )}
        </div>

        {/* строка 2 (десктоп): категории + Бренды */}
        {isDesktop && (
          <div style={{ borderTop: '1px solid var(--glass-brd)' }}>
            <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 4, height: 40 }}>
              {cats.map((c) => (
                <button
                  key={c.id}
                  className="btn btn-sm btn-ghost"
                  style={{ minHeight: 30, fontSize: 13 }}
                  onClick={() => goSearch(undefined, c.slug)}
                >
                  {c.name}
                </button>
              ))}
              <div ref={brandsRef} style={{ position: 'relative' }}>
                <button className="btn btn-sm btn-ghost" style={{ minHeight: 30, fontSize: 13 }} onClick={() => setBrandsOpen((v) => !v)} aria-expanded={brandsOpen}>
                  Бренды <span style={{ fontSize: 10, opacity: 0.7 }}>{brandsOpen ? '▲' : '▼'}</span>
                </button>
                {brandsOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 230, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: 'var(--shadow-3)', padding: 6, zIndex: 80, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    {topBrands.map((b) => (
                      <button
                        key={b.id}
                        className="btn btn-sm btn-ghost"
                        style={{ justifyContent: 'flex-start', minHeight: 32, fontSize: 13 }}
                        onClick={() => { setBrandsOpen(false); navigate(`/catalog?brand=${b.id}&bn=${encodeURIComponent(b.name)}`) }}
                      >
                        {b.name}
                      </button>
                    ))}
                    {topBrands.length === 0 && <span className="text-3" style={{ fontSize: 12, padding: 8 }}>пока пусто</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* полоска трендов (все устройства) */}
      <TrendsBar onOpenProduct={openProduct} />

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: `0 16px ${isDesktop ? 48 : 108}px`, width: '100%', flex: 1 }}>
        <Suspense fallback={PageFallback}>
          <Routes>
            <Route path="/" element={<HomePage onSearch={goSearch} onOpenProduct={openProduct} onGoRequests={() => navigate('/requests')} />} />
            <Route path="/catalog" element={<CatalogRoute onOpenProduct={openProduct} />} />
            <Route path="/product/:id" element={<ProductRoute onContact={contactByListing} />} />
            <Route path="/requests" element={<RequestsPage meId={auth?.id ?? null} onOpenChat={goChat} onNeedAuth={() => navigate('/profile')} />} />
            <Route path="/chats" element={<Gate authed={authed} authChecked={authChecked} what="Раздел «Чаты»">{auth && <ChatsRoute meId={auth.id} />}</Gate>} />
            <Route path="/seller" element={<Gate authed={authed} authChecked={authChecked} what="Раздел «Мой сток»"><SellerPage /></Gate>} />
            <Route path="/analytics" element={<Gate authed={authed} authChecked={authChecked} what="Аналитика спроса"><AnalyticsPage /></Gate>} />
            <Route path="/profile" element={<Gate authed={authed} authChecked={authChecked} what="Раздел «Профиль»">{auth && <ProfilePage auth={auth} onLogout={onLogout} onOpenChat={goChat} onOpenAnalytics={() => navigate('/analytics')} />}</Gate>} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {isDesktop && (
        <footer style={{ borderTop: '1px solid var(--border)', padding: '18px 16px', textAlign: 'center' }}>
          <span className="text-3" style={{ fontSize: 12 }}>Search-app — агрегатор стока реселлеров. Сделки и оплата — напрямую между пользователями.</span>
        </footer>
      )}

      {!isDesktop && (
        <nav
          ref={bottomNavRef}
          style={{
            position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)', left: '50%', transform: 'translateX(-50%)',
            width: 'min(430px, calc(100% - 24px))', background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-strong)', borderRadius: 24, boxShadow: 'var(--shadow-3)', display: 'grid',
            gridTemplateColumns: `repeat(${MOBILE_TABS.length}, 1fr)`, padding: 7, gap: 2, zIndex: 60,
          }}
        >
          {pill && (
            <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: pill.w, height: pill.h, transform: `translate(${pill.x}px, ${pill.y}px)`, background: 'var(--accent-dim)', borderRadius: 17, transition: 'transform 0.34s var(--ease), width 0.34s var(--ease)', pointerEvents: 'none', zIndex: 0 }} />
          )}
          {MOBILE_TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => navigate(t.path)}
                aria-label={t.label}
                aria-current={active ? 'page' : undefined}
                style={{ background: 'transparent', border: 'none', borderRadius: 17, padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--text-3)', position: 'relative', zIndex: 1, fontFamily: 'inherit', transition: 'color 0.2s var(--ease)' }}
              >
                <TabIcon tab={t.id} />
                <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500 }}>{t.label}</span>
                {t.id === 'chats' && unread > 0 && (
                  <span style={{ position: 'absolute', top: 3, left: 'calc(50% + 7px)', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 10, fontWeight: 700, borderRadius: 9, padding: '0 5px', lineHeight: '15px' }}>{unread}</span>
                )}
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}

// Каталог: q/cat из URL (seed для начального состояния SearchPage).
function CatalogRoute({ onOpenProduct }: { onOpenProduct: (id: number) => void }) {
  const [sp] = useSearchParams()
  const brand = sp.get('brand')
  return (
    <SearchPage
      key={sp.toString()}
      initialQ={sp.get('q') || undefined}
      initialCategorySlug={sp.get('cat') || undefined}
      initialBrand={brand ? { id: Number(brand), name: sp.get('bn') || `бренд #${brand}` } : undefined}
      onOpenProduct={onOpenProduct}
    />
  )
}

// Страница товара: id из URL; «назад» — history back.
function ProductRoute({ onContact }: { onContact: (listingId: number, contact: string) => void }) {
  const { id } = useParams()
  const navigate = useNavigate()
  return <ProductPage modelId={Number(id)} onBack={() => navigate(-1)} onContact={onContact} onLeaveRequest={() => navigate('/requests')} />
}

// Чаты: открытый диалог из ?open=.
function ChatsRoute({ meId }: { meId: number }) {
  const [sp] = useSearchParams()
  const open = sp.get('open')
  return <ChatsPage key={open || 'list'} meId={meId} initialChatId={open ? Number(open) : undefined} />
}
