import { useEffect, useMemo, useState } from 'react'
import { fetchCategories, type Category } from '../api/directory'
import { fetchCatalog, type CatalogItem } from '../api/catalog'
import { ProductCard } from './ProductCard'

const CATEGORY_ORDER: Record<string, number> = { footwear: 0, apparel: 1 }

interface Props {
  initialQ?: string
  initialCategorySlug?: string
  onOpenProduct: (modelId: number) => void
}

// Каталог (как StockX): поиск → карточки моделей; клик — страница товара с офферами.
export function SearchPage({ initialQ, initialCategorySlug, onOpenProduct }: Props) {
  const [q, setQ] = useState(initialQ ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [category, setCategory] = useState(0)
  const [ready, setReady] = useState(false)
  const [sort, setSort] = useState('offers')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)

  const tops = useMemo(
    () =>
      categories
        .filter((c) => !c.parentId)
        .sort((a, b) => (CATEGORY_ORDER[a.slug] ?? 9) - (CATEGORY_ORDER[b.slug] ?? 9) || a.name.localeCompare(b.name)),
    [categories],
  )
  const childrenByParent = useMemo(() => {
    const m: Record<number, Category[]> = {}
    categories.forEach((c) => {
      if (c.parentId) (m[c.parentId] ||= []).push(c)
    })
    return m
  }, [categories])
  const activeTop = useMemo(() => {
    if (tops.some((t) => t.id === category)) return category
    return categories.find((c) => c.id === category)?.parentId ?? 0
  }, [category, tops, categories])

  async function run() {
    setLoading(true)
    try {
      const res = await fetchCatalog({ q: q.trim() || undefined, categoryId: category || undefined, sort })
      setItems(res.results)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats)
        const wanted = initialCategorySlug ?? 'footwear'
        const found = cats.find((c) => c.slug === wanted)
        setCategory(found ? found.id : 0)
      })
      .finally(() => setReady(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ready) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, category, sort])

  const subChips = childrenByParent[activeTop] ?? []

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="search-hero">
        <span className="search-ico" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
        </span>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="Jordan 4, самба, birkin…" aria-label="Поиск по каталогу" />
        <button className="btn btn-primary" disabled={loading} onClick={run}>Найти</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {tops.map((t) => (
          <button key={t.id} className={activeTop === t.id ? 'chip chip-active' : 'chip'} onClick={() => setCategory(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      {subChips.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button className={category === activeTop ? 'chip chip-active' : 'chip'} onClick={() => setCategory(activeTop)}>Все</button>
          {subChips.map((ch) => (
            <button key={ch.id} className={category === ch.id ? 'chip chip-active' : 'chip'} onClick={() => setCategory(ch.id)}>
              {ch.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '20px 0 12px' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{loading ? 'Ищем…' : `Моделей: ${items.length}`}</div>
        <select className="select" style={{ width: 200 }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="offers">больше предложений</option>
          <option value="price_asc">сначала дешевле</option>
          <option value="new">новые поступления</option>
        </select>
      </div>

      {!loading && items.length === 0 && <p className="text-3">ничего не нашлось — попробуй другой запрос</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        {items.map((it) => (
          <ProductCard key={it.model.id} item={it} onOpen={onOpenProduct} />
        ))}
      </div>
    </div>
  )
}
