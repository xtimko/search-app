import { useEffect, useMemo, useState } from 'react'
import { fetchCategories, type Category } from '../api/directory'
import { fetchCatalog, fetchTopBrands, type CatalogItem, type CatalogParams } from '../api/catalog'
import { ProductCard } from './ProductCard'
import { CatalogFilters, EMPTY_FILTERS, countActiveFilters, type CatalogFiltersState } from './CatalogFilters'

const CATEGORY_ORDER: Record<string, number> = { footwear: 0, apparel: 1 }

interface Props {
  initialQ?: string
  initialCategorySlug?: string
  initialSort?: string // 'offers' | 'price_asc' | 'new' (из ?sort= — «Смотреть все» с главной)
  initialBrand?: { id: number; name: string } // стартовый бренд-фильтр (можно снять)
  lockedBrand?: { id: number; name: string } // страница бренда: зафиксирован, секция брендов скрыта
  onOpenProduct: (modelId: number) => void
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

// Каталог-браузер (как StockX): сайдбар фильтров (десктоп) / bottom sheet
// (мобайл), активные фильтры-чипы, счётчик и пагинация «Показать ещё».
export function SearchPage({ initialQ, initialCategorySlug, initialSort, initialBrand, lockedBrand, onOpenProduct }: Props) {
  const isDesktop = useIsDesktop()
  const [q, setQ] = useState(initialQ ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [category, setCategory] = useState(0)
  const [ready, setReady] = useState(false)
  const [sort, setSort] = useState(initialSort === 'price_asc' || initialSort === 'new' ? initialSort : 'offers')
  const [filters, setFilters] = useState<CatalogFiltersState>({ ...EMPTY_FILTERS, brands: initialBrand ? [initialBrand] : [] })
  const [brandOptions, setBrandOptions] = useState<{ id: number; name: string; offersCount: number }[]>([])
  const [items, setItems] = useState<CatalogItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sheet, setSheet] = useState(false)

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

  function params(): CatalogParams {
    return {
      q: q.trim() || undefined,
      categoryId: category || undefined,
      brands: lockedBrand ? [lockedBrand.id] : filters.brands.map((b) => b.id),
      size: filters.size || undefined,
      priceMin: Number(filters.priceMin) > 0 ? Number(filters.priceMin) : undefined,
      priceMax: Number(filters.priceMax) > 0 ? Number(filters.priceMax) : undefined,
      condition: filters.condition || undefined,
      sort,
    }
  }

  async function run() {
    setLoading(true)
    try {
      const res = await fetchCatalog({ ...params(), offset: 0 })
      setItems(res.results)
      setTotal(res.total)
    } catch {
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    setLoadingMore(true)
    try {
      const res = await fetchCatalog({ ...params(), offset: items.length })
      setItems((cur) => [...cur, ...res.results])
      setTotal(res.total)
    } catch {
      // страница не догрузилась — кнопка остаётся, можно повторить
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats)
        if (initialCategorySlug) {
          const found = cats.find((c) => c.slug === initialCategorySlug)
          setCategory(found ? found.id : 0)
        }
      })
      .finally(() => setReady(true))
    fetchTopBrands(100).then((r) => setBrandOptions(r.results)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ready) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, category, sort, filters])

  // Активные фильтры-чипы над выдачей.
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (!lockedBrand) for (const b of filters.brands) chips.push({ key: `b${b.id}`, label: b.name, clear: () => setFilters({ ...filters, brands: filters.brands.filter((x) => x.id !== b.id) }) })
  if (filters.size) chips.push({ key: 'size', label: `размер ${filters.size}`, clear: () => setFilters({ ...filters, size: '' }) })
  if (filters.priceMin || filters.priceMax) {
    const label = filters.priceMin && filters.priceMax ? `${filters.priceMin}–${filters.priceMax} ₽` : filters.priceMin ? `от ${filters.priceMin} ₽` : `до ${filters.priceMax} ₽`
    chips.push({ key: 'price', label, clear: () => setFilters({ ...filters, priceMin: '', priceMax: '' }) })
  }
  if (filters.condition) chips.push({ key: 'cond', label: filters.condition === 'new' ? 'новое' : 'б/у', clear: () => setFilters({ ...filters, condition: '' }) })
  const activeCount = countActiveFilters(filters, !lockedBrand)

  const filtersPanel = (
    <CatalogFilters
      tops={tops}
      childrenByParent={childrenByParent}
      activeTop={activeTop}
      category={category}
      onCategory={setCategory}
      brandOptions={brandOptions}
      value={filters}
      onChange={setFilters}
      hideBrands={Boolean(lockedBrand)}
    />
  )

  return (
    <div style={{ paddingTop: lockedBrand ? 8 : 20 }}>
      <div className="search-hero">
        <span className="search-ico" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder={lockedBrand ? `Поиск в ${lockedBrand.name}…` : 'Jordan 4, самба, birkin…'}
          aria-label="Поиск по каталогу"
        />
        <button className="btn btn-primary" disabled={loading} onClick={run}>Найти</button>
      </div>

      <div style={isDesktop ? { display: 'grid', gridTemplateColumns: '232px 1fr', gap: 24, marginTop: 18, alignItems: 'start' } : { marginTop: 14 }}>
        {isDesktop && (
          <aside className="card" style={{ padding: 16, position: 'sticky', top: 132, maxHeight: 'calc(100vh - 148px)', overflowY: 'auto' }}>
            {filtersPanel}
          </aside>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{loading ? 'Ищем…' : `Моделей: ${total}`}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isDesktop && (
                <button className="btn btn-outline btn-sm" onClick={() => setSheet(true)}>
                  Фильтры{activeCount > 0 ? ` · ${activeCount}` : ''}
                </button>
              )}
              <select className="select" style={{ width: isDesktop ? 200 : 168, fontSize: 13 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
                <option value="offers">больше предложений</option>
                <option value="price_asc">сначала дешевле</option>
                <option value="new">новые поступления</option>
              </select>
            </div>
          </div>

          {chips.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {chips.map((c) => (
                <button key={c.key} className="chip chip-active" onClick={c.clear} title="убрать фильтр">
                  {c.label} ✕
                </button>
              ))}
              <button className="chip" onClick={() => setFilters({ ...EMPTY_FILTERS, brands: lockedBrand ? filters.brands : [] })}>
                сбросить всё
              </button>
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-3">ничего не нашлось — попробуй другой запрос{activeCount > 0 ? ' или сними фильтры' : ''}</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
            {items.map((it) => (
              <ProductCard key={it.model.id} item={it} onOpen={onOpenProduct} />
            ))}
          </div>

          {items.length < total && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
              <button className="btn btn-outline" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? 'Загружаем…' : `Показать ещё (${total - items.length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Мобайл: фильтры в bottom sheet; изменения применяются сразу, счётчик на кнопке живой */}
      {sheet && !isDesktop && (
        <div onClick={() => setSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100 }} aria-modal="true" role="dialog">
          <div
            onClick={(e) => e.stopPropagation()}
            className="fade-up"
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82vh', overflowY: 'auto',
              background: 'var(--bg-card)', borderTop: '1px solid var(--border-strong)', borderRadius: '18px 18px 0 0',
              padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Фильтры</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSheet(false)} aria-label="закрыть">✕</button>
            </div>
            {filtersPanel}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              {activeCount > 0 && (
                <button className="btn btn-outline" onClick={() => setFilters({ ...EMPTY_FILTERS, brands: lockedBrand ? filters.brands : [] })}>
                  Сбросить
                </button>
              )}
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setSheet(false)}>
                Показать{loading ? '…' : ` ${total}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
