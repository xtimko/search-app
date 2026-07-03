import { useEffect, useState } from 'react'
import { fetchCategories, type Category } from '../api/directory'
import { search, type SearchResult } from '../api/search'
import { ResultCard } from './ResultCard'

const CATEGORY_ORDER: Record<string, number> = { footwear: 0, apparel: 1 }

// Главная: hero-поиск, категории, горячие предложения, тизер запросов «Ищу».
export function HomePage({
  onSearch,
  onContact,
}: {
  onSearch: (q?: string, categorySlug?: string) => void
  onContact?: (r: SearchResult) => void
}) {
  const [q, setQ] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [hot, setHot] = useState<SearchResult[]>([])

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
  }, [])

  return (
    <div>
      <section style={{ textAlign: 'center', padding: '48px 8px 8px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, lineHeight: 1.25 }}>
          Найди пару. <span className="text-accent">Или продай свою.</span>
        </h1>
        <p className="text-2" style={{ margin: '10px 0 22px', fontSize: 15 }}>
          Весь сток реселлеров в одном поиске — вместо чатов
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
        <div className="section-title">
          Запросы «Ищу»
          <span className="badge badge-accent">скоро</span>
        </div>
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Не нашёл нужную пару?</div>
            <div className="text-2" style={{ fontSize: 13, marginTop: 4 }}>
              Скоро: оставь запрос «Ищу» — продавцы с подходящим стоком сами предложат цену. Как в чатах, только без чатов.
            </div>
          </div>
          <button className="btn btn-outline" disabled>
            Оставить запрос
          </button>
        </div>
      </section>
    </div>
  )
}
