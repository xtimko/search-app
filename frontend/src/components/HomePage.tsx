import { useEffect, useState } from 'react'
import { fetchCategories, type Category } from '../api/directory'
import { search, type SearchResult } from '../api/search'
import { fetchRequests, type BuyRequest } from '../api/requests'
import { ResultCard } from './ResultCard'

const CATEGORY_ORDER: Record<string, number> = { footwear: 0, apparel: 1 }

// Главная: hero-поиск, категории, горячие предложения, тизер запросов «Ищу».
export function HomePage({
  onSearch,
  onContact,
  onGoRequests,
}: {
  onSearch: (q?: string, categorySlug?: string) => void
  onContact?: (r: SearchResult) => void
  onGoRequests?: () => void
}) {
  const [q, setQ] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [hot, setHot] = useState<SearchResult[]>([])
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
    // «Горячие» — пока свежие поступления; позже здесь будут платные промо-слоты.
    search({ sort: 'new' })
      .then((res) => setHot(res.results.slice(0, 8)))
      .catch(() => {})
    fetchRequests()
      .then((rs) => setRequests(rs.slice(0, 4)))
      .catch(() => {})
  }, [])

  return (
    <div>
      <section className="fade-up" style={{ textAlign: 'center', padding: '52px 8px 8px' }}>
        <h1 className="display" style={{ fontSize: 'clamp(34px, 6vw, 58px)', margin: 0 }}>
          Найди пару.<br />
          <span className="text-accent">Или продай свою.</span>
        </h1>
        <p className="text-2" style={{ margin: '14px auto 24px', fontSize: 16, maxWidth: 440 }}>
          Весь сток реселлеров в одном поиске — вместо сотен чатов
        </p>
        <div style={{ display: 'flex', gap: 8, maxWidth: 560, margin: '0 auto' }}>
          <input
            className="input"
            style={{ flex: 1 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch(q.trim() || undefined)}
            placeholder="Jordan 4 42, nb 2002r, birkin…"
          />
          <button className="btn btn-primary" onClick={() => onSearch(q.trim() || undefined)}>
            Найти
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
          {categories.map((c) => (
            <button key={c.id} className="chip" onClick={() => onSearch(undefined, c.slug)}>
              {c.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title">
          Горячие предложения
          <span className="badge">промо скоро</span>
        </div>
        {hot.length === 0 ? (
          <p className="text-3">пока пусто — сток наполняется</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
            {hot.map((r) => (
              <ResultCard key={r.id} r={r} compact onContact={onContact} />
            ))}
          </div>
        )}
      </section>

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
