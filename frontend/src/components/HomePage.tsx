import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCategories, type Category } from '../api/directory'
import { fetchHome, fetchCatalogBatch, type HomeData, type CatalogItem } from '../api/catalog'
import { fetchRequests, type BuyRequest } from '../api/requests'
import { getRecentIds } from '../recent'
import { CardRow } from './CardRow'

const CATEGORY_ORDER: Record<string, number> = { footwear: 0, apparel: 1 }

// Ряд-карусель главной с заголовком и «Смотреть все →» (как StockX).
function Row({ title, hint, actionLabel, onAction, items, onOpen }: {
  title: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
  items: CatalogItem[]
  onOpen: (id: number) => void
}) {
  if (items.length === 0) return null
  return (
    <section>
      <div className="section-title" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span>
          {title}
          {hint && <span className="text-3" style={{ fontFamily: 'var(--font)', fontWeight: 400, fontSize: 12.5, marginLeft: 8 }}>{hint}</span>}
        </span>
        {onAction && (
          <button
            onClick={onAction}
            className="text-2"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0, whiteSpace: 'nowrap', transition: 'color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '')}
          >
            {actionLabel ?? 'Смотреть все'} →
          </button>
        )}
      </div>
      <CardRow items={items} onOpen={onOpen} />
    </section>
  )
}

// Главная (как StockX): hero-поиск → промо-слот → ряды-карусели (тренды,
// новинки, дефицит, категории) → плитки брендов → тизер запросов «Ищу».
export function HomePage({
  onSearch,
  onOpenProduct,
  onGoRequests,
}: {
  onSearch: (q?: string, categorySlug?: string) => void
  onOpenProduct: (modelId: number) => void
  onGoRequests?: () => void
}) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [home, setHome] = useState<HomeData | null>(null)
  const [recent, setRecent] = useState<CatalogItem[]>([])
  const [requests, setRequests] = useState<BuyRequest[]>([])

  useEffect(() => {
    fetchCategories()
      .then((cats) =>
        setCategories(
          cats
            .filter((c) => !c.parentId)
            .sort((a, b) => (CATEGORY_ORDER[a.slug] ?? 9) - (CATEGORY_ORDER[b.slug] ?? 9) || a.name.localeCompare(b.name)),
        ),
      )
      .catch(() => {})
    fetchHome().then(setHome).catch(() => {})
    fetchCatalogBatch(getRecentIds().slice(0, 8)).then((r) => setRecent(r.results)).catch(() => {})
    fetchRequests()
      .then((rs) => setRequests(rs.slice(0, 4)))
      .catch(() => {})
  }, [])

  return (
    <div>
      <section className="fade-up" style={{ textAlign: 'center', padding: '46px 8px 8px' }}>
        <h1 className="display" style={{ fontSize: 'clamp(20px, 3.4vw, 30px)', margin: 0 }}>
          Найди пару. <span className="text-3">Или продай свою.</span>
        </h1>
        <p className="text-2" style={{ margin: '10px auto 26px', fontSize: 15, maxWidth: 430 }}>
          Весь сток реселлеров в одном поиске — вместо сотен чатов
        </p>

        <div className="search-hero" style={{ maxWidth: 620, margin: '0 auto' }}>
          <span className="search-ico" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4.2-4.2" />
            </svg>
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch(q.trim() || undefined)}
            placeholder="Jordan 4 42, nb 2002r, birkin…"
            aria-label="Поиск по стоку"
          />
          <button className="btn btn-primary" onClick={() => onSearch(q.trim() || undefined)}>
            Найти
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
          <span className="text-3" style={{ fontSize: 12, alignSelf: 'center' }}>популярное:</span>
          {['jordan 4', 'samba', '2002r', 'dunk low'].map((p) => (
            <button key={p} className="chip" style={{ minHeight: 30, padding: '4px 12px' }} onClick={() => onSearch(p)}>
              {p}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
          {categories.map((c) => (
            <button key={c.id} className="chip" onClick={() => onSearch(undefined, c.slug)}>
              {c.name}
            </button>
          ))}
        </div>
      </section>

      {/* Hero-промо слот: задел под платное промо продавцов (монетизация);
          пока его никто не купил — самопромо площадки для продавцов. */}
      <section style={{ marginTop: 26 }}>
        <div
          className="card"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
            background: 'linear-gradient(120deg, var(--bg-card) 0%, var(--bg-elev) 100%)', border: '1px solid var(--border-strong)',
          }}
        >
          <div style={{ minWidth: 240, flex: 1 }}>
            <div className="badge" style={{ marginBottom: 8 }}>промо-слот</div>
            <div className="display" style={{ fontSize: 18 }}>Продаёшь сток? Выложи его за минуту.</div>
            <div className="text-2" style={{ fontSize: 13, marginTop: 6 }}>
              Загрузка таблицей, отметка «продано» в один тап — покупатели найдут тебя сами.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/seller')}>Разместить сток</button>
        </div>
      </section>

      {home && (
        <>
          <Row
            title="Тренды недели"
            hint="по поискам покупателей"
            actionLabel="Смотреть все"
            onAction={() => navigate('/catalog')}
            items={home.trending}
            onOpen={onOpenProduct}
          />
          <Row
            title="Новые поступления"
            actionLabel="Смотреть все"
            onAction={() => navigate('/catalog?sort=new')}
            items={home.fresh}
            onOpen={onOpenProduct}
          />
          <Row
            title="Дефицит"
            hint="ищут чаще, чем есть в наличии"
            actionLabel="Аналитика спроса"
            onAction={() => navigate('/analytics')}
            items={home.deficit}
            onOpen={onOpenProduct}
          />
          <Row
            title="Обувь"
            actionLabel="Смотреть все"
            onAction={() => onSearch(undefined, 'footwear')}
            items={home.footwear}
            onOpen={onOpenProduct}
          />
          <Row
            title="Одежда"
            actionLabel="Смотреть все"
            onAction={() => onSearch(undefined, 'apparel')}
            items={home.apparel}
            onOpen={onOpenProduct}
          />

          <Row title="Недавно смотрели" items={recent} onOpen={onOpenProduct} />

          {home.brands.length > 0 && (
            <section>
              <div className="section-title">Топ-бренды</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                {home.brands.map((b) => (
                  <button
                    key={b.id}
                    className="card card-hover"
                    onClick={() => navigate(`/brand/${b.id}`)}
                    style={{ cursor: 'pointer', textAlign: 'center', padding: '16px 10px', border: '1px solid var(--border)', fontFamily: 'inherit' }}
                  >
                    <div className="display text-3" style={{ fontSize: 22 }}>{b.name.slice(0, 1)}</div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                    <div className="text-3 tnum" style={{ fontSize: 11.5, marginTop: 2 }}>{b.offersCount} офф.</div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section>
        <div className="section-title">Свежие запросы «Ищу»</div>
        {requests.length === 0 ? (
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
            <div style={{ minWidth: 240, flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Не нашёл нужную пару?</div>
              <div className="text-2" style={{ fontSize: 13, marginTop: 4 }}>
                Оставь запрос — продавцы с подходящим стоком сами предложат цену в чате.
              </div>
            </div>
            <button className="btn btn-primary" onClick={onGoRequests}>
              Оставить запрос
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              {requests.map((r) => (
                <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      Ищу {r.model.brand.name} {r.model.name}
                      {r.size ? ` · ${r.size}` : ''}
                    </span>
                    <span className="text-3" style={{ fontSize: 12 }}>
                      {' '}
                      {r.maxPrice ? `· до ${r.maxPrice.toLocaleString('ru-RU')} ₽ ` : ''}
                      {r.city ? `· ${r.city} ` : ''}· откликов: {r._count.responses}
                    </span>
                  </div>
                  <button className="btn btn-accent-outline btn-sm" style={{ flexShrink: 0 }} onClick={onGoRequests}>
                    Предложить
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={onGoRequests}>
                Все запросы
              </button>
              <button className="btn btn-primary btn-sm" onClick={onGoRequests}>
                + Оставить запрос
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
