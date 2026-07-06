import { useEffect, useMemo, useState } from 'react'
import { Autocomplete } from './Autocomplete'
import { fetchBrands, fetchCategories, type Brand, type Category } from '../api/directory'
import { search, type SearchResponse } from '../api/search'
import { ResultCard } from './ResultCard'

const CATEGORY_ORDER: Record<string, number> = { footwear: 0, apparel: 1 }

interface Props {
  initialQ?: string
  initialCategorySlug?: string
  onContact?: (r: import('../api/search').SearchResult) => void
}

// Поиск покупателя: строка, категории-кнопки (подкатегории по клику),
// расширенный фильтр (свёрнут), сортировка в шапке результатов.
export function SearchPage({ initialQ, initialCategorySlug, onContact }: Props) {
  const [q, setQ] = useState(initialQ ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [category, setCategory] = useState(0)
  const [ready, setReady] = useState(false)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [condition, setCondition] = useState<'' | 'new' | 'used'>('')
  const [city, setCity] = useState('') // по умолчанию — все города (иначе прячет товары без города)
  const [sort, setSort] = useState('price_asc')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [data, setData] = useState<SearchResponse | null>(null)
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

  async function runSearch() {
    setLoading(true)
    try {
      setData(
        await search({
          q: q.trim() || undefined,
          brandId: brand?.id,
          categoryId: category || undefined,
          condition: condition || undefined,
          priceMin: priceMin ? Number(priceMin) : undefined,
          priceMax: priceMax ? Number(priceMax) : undefined,
          city: city.trim() || undefined,
          sort,
        }),
      )
    } catch {
      setData({ parsed: { text: '', sizeUs: null, sizeEu: null }, results: [] })
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
    if (ready) runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, category, sort])

  const parsed = data?.parsed
  const results = data?.results ?? []
  const subChips = childrenByParent[activeTop] ?? []

  return (
    <div style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Jordan 4 42, nb 2002r 9us, samba…"
        />
        <button className="btn btn-primary" disabled={loading} onClick={runSearch}>
          Найти
        </button>
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
          <button className={category === activeTop ? 'chip chip-active' : 'chip'} onClick={() => setCategory(activeTop)}>
            Все
          </button>
          {subChips.map((ch) => (
            <button key={ch.id} className={category === ch.id ? 'chip chip-active' : 'chip'} onClick={() => setCategory(ch.id)}>
              {ch.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? 'Скрыть фильтры' : 'Все фильтры'}
        </button>
      </div>

      {showAdvanced && (
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <div>
              <span className="label" style={{ marginTop: 0 }}>Бренд</span>
              <Autocomplete<Brand>
                placeholder="любой"
                fetcher={fetchBrands}
                getKey={(b) => b.id}
                getLabel={(b) => b.name}
                onSelect={(b) => setBrand(b)}
              />
            </div>
            <div>
              <span className="label" style={{ marginTop: 0 }}>Цена от</span>
              <input className="input" type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
            </div>
            <div>
              <span className="label" style={{ marginTop: 0 }}>до</span>
              <input className="input" type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
            </div>
            <div>
              <span className="label" style={{ marginTop: 0 }}>Состояние</span>
              <select className="select" value={condition} onChange={(e) => setCondition(e.target.value as '' | 'new' | 'used')}>
                <option value="">любое</option>
                <option value="new">новое</option>
                <option value="used">б/у</option>
              </select>
            </div>
            <div>
              <span className="label" style={{ marginTop: 0 }}>Город</span>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="любой" />
            </div>
          </div>
          {brand && (
            <div className="hint">
              бренд: <b>{brand.name}</b>{' '}
              <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setBrand(null)}>
                сбросить
              </span>
            </div>
          )}
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={runSearch}>
            Применить
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '22px 0 12px' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{loading ? 'Ищем…' : `Найдено: ${results.length}`}</div>
        <select className="select" style={{ width: 190 }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="price_asc">сначала дешевле</option>
          <option value="price_desc">сначала дороже</option>
          <option value="new">сначала новые</option>
        </select>
      </div>

      {parsed && (parsed.sizeUs || parsed.sizeEu || parsed.text) && (
        <div className="hint" style={{ margin: '0 0 10px' }}>
          поняли запрос: {parsed.text && `«${parsed.text}»`}
          {parsed.sizeUs && ` · US ${parsed.sizeUs}`}
          {parsed.sizeEu && ` · EU ${parsed.sizeEu}`}
        </div>
      )}

      {!loading && results.length === 0 && <p className="text-3">ничего не нашлось — измени запрос или фильтры</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
        {results.map((r) => (
          <ResultCard key={r.id} r={r} onContact={onContact} />
        ))}
      </div>
    </div>
  )
}
