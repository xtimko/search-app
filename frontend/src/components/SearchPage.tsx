import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Group, FormItem, Input, NativeSelect, Button, Div, Card, Footnote, Spinner } from '@vkontakte/vkui'
import { Autocomplete } from './Autocomplete'
import { fetchBrands, fetchCategories, type Brand, type Category } from '../api/directory'
import { search, type SearchResult, type SearchResponse } from '../api/search'

// Десктоп/мобайл по ширине окна.
function useIsDesktop(): boolean {
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900)
  useEffect(() => {
    const on = () => setD(window.innerWidth >= 900)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return d
}

function sizeLabel(r: SearchResult): string {
  if (r.sizeUs || r.sizeEu) {
    return [r.sizeUs && `US ${r.sizeUs}`, r.sizeEu && `EU ${r.sizeEu}`].filter(Boolean).join(' / ')
  }
  return r.size || '—'
}

export function SearchPage() {
  const isDesktop = useIsDesktop()
  const [q, setQ] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [category, setCategory] = useState(0)
  const [ready, setReady] = useState(false)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [condition, setCondition] = useState<'' | 'new' | 'used'>('')
  const [city, setCity] = useState('Москва') // по умолчанию Москва
  const [sort, setSort] = useState('price_asc')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const tops = useMemo(() => categories.filter((c) => !c.parentId), [categories])
  const childrenByParent = useMemo(() => {
    const m: Record<number, Category[]> = {}
    categories.forEach((c) => {
      if (c.parentId) (m[c.parentId] ||= []).push(c)
    })
    return m
  }, [categories])

  // Активный родитель = выбранная категория или её родитель (чтобы подсветить кнопку и показать детей).
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

  // Категории + дефолт «Обувь».
  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats)
        const fw = cats.find((c) => c.slug === 'footwear')
        setCategory(fw ? fw.id : 0)
      })
      .finally(() => setReady(true))
  }, [])

  // Авто-поиск: при готовности и смене категории/сортировки. Текст и расширенные — по кнопке.
  useEffect(() => {
    if (ready) runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, category, sort])

  const parsed = data?.parsed
  const results = data?.results ?? []
  const subChips = childrenByParent[activeTop] ?? []

  const advItem = (top: string, node: ReactNode) => (
    <FormItem top={top} style={{ flex: isDesktop ? '1 1 150px' : '1 1 100%', paddingLeft: 0, paddingRight: 0 }}>
      {node}
    </FormItem>
  )

  return (
    <>
      <Group>
        {/* Поисковая строка */}
        <Div style={{ display: 'flex', gap: 8, flexDirection: isDesktop ? 'row' : 'column' }}>
          <Input
            style={{ flex: 1 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Jordan 4 42, nb 2002r 9us, samba…"
          />
          <Button size="l" stretched={!isDesktop} loading={loading} onClick={runSearch}>
            Найти
          </Button>
        </Div>

        {/* Категории-кнопки */}
        <Div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: subChips.length ? 4 : 12 }}>
          {tops.map((t) => (
            <Button key={t.id} size="s" mode={activeTop === t.id ? 'primary' : 'outline'} onClick={() => setCategory(t.id)}>
              {t.name}
            </Button>
          ))}
        </Div>

        {/* Подкатегории активного раздела — только если есть */}
        {subChips.length > 0 && (
          <Div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 0 }}>
            <Button
              size="s"
              mode={category === activeTop ? 'primary' : 'tertiary'}
              onClick={() => setCategory(activeTop)}
            >
              Все
            </Button>
            {subChips.map((ch) => (
              <Button key={ch.id} size="s" mode={category === ch.id ? 'primary' : 'tertiary'} onClick={() => setCategory(ch.id)}>
                {ch.name}
              </Button>
            ))}
          </Div>
        )}

        {/* Расширенный фильтр */}
        <Div style={{ paddingTop: 0 }}>
          <Button size="s" mode="tertiary" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? '▲ Скрыть фильтры' : '▼ Расширенный фильтр'}
          </Button>
        </Div>
        {showAdvanced && (
          <Div style={{ paddingTop: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
              {advItem(
                'Бренд',
                <Autocomplete<Brand>
                  placeholder="любой"
                  fetcher={fetchBrands}
                  getKey={(b) => b.id}
                  getLabel={(b) => b.name}
                  onSelect={(b) => setBrand(b)}
                />,
              )}
              {advItem('Цена от', <Input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />)}
              {advItem('до', <Input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />)}
              {advItem(
                'Состояние',
                <NativeSelect value={condition} onChange={(e) => setCondition(e.target.value as '' | 'new' | 'used')}>
                  <option value="">любое</option>
                  <option value="new">новое</option>
                  <option value="used">б/у</option>
                </NativeSelect>,
              )}
              {advItem('Город', <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="любой" />)}
            </div>
            {brand && (
              <Footnote style={{ marginTop: 4 }}>
                бренд: {brand.name}{' '}
                <span style={{ color: '#3b5bdb', cursor: 'pointer' }} onClick={() => setBrand(null)}>
                  сбросить
                </span>
              </Footnote>
            )}
            <Button size="m" stretched={!isDesktop} style={{ marginTop: 10 }} onClick={runSearch}>
              Применить
            </Button>
          </Div>
        )}
      </Group>

      <Group>
        {/* Заголовок результатов + сортировка */}
        <Div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{loading ? 'Ищем…' : `Найдено: ${results.length}`}</div>
          <NativeSelect value={sort} onChange={(e) => setSort(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="price_asc">сначала дешевле</option>
            <option value="price_desc">сначала дороже</option>
            <option value="new">сначала новые</option>
          </NativeSelect>
        </Div>

        {parsed && (parsed.sizeUs || parsed.sizeEu || parsed.text) && (
          <Div style={{ paddingTop: 0 }}>
            <Footnote>
              поняли запрос: {parsed.text && `«${parsed.text}»`}
              {parsed.sizeUs && ` · US ${parsed.sizeUs}`}
              {parsed.sizeEu && ` · EU ${parsed.sizeEu}`}
            </Footnote>
          </Div>
        )}

        {loading && (
          <Div>
            <Spinner />
          </Div>
        )}
        {!loading && results.length === 0 && (
          <Div style={{ color: '#888' }}>ничего не нашлось — измени запрос или фильтры</Div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
            gap: 8,
            padding: '0 16px 12px',
          }}
        >
          {results.map((r) => (
            <Card key={r.id} mode="outline">
              <div style={{ padding: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {r.photo ? (
                    <img src={r.photo} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 8, background: '#ebedf0', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.model.brand.name} {r.model.name}
                    </div>
                    <div style={{ color: '#555', fontSize: 13 }}>
                      {sizeLabel(r)} · {r.condition === 'new' ? 'новое' : 'б/у'}
                      {r.fitting && ' · примерка'} · <b>{r.price.toLocaleString('ru-RU')} ₽</b>
                    </div>
                    <div style={{ color: '#777', fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.colorway ? `${r.colorway} · ` : ''}
                      {r.seller.nick}
                      {r.seller.status === 'approved' && <span style={{ color: '#1e8e3e' }}> ✓</span>}
                      {(r.city || r.seller.city) && ` · ${r.city || r.seller.city}`}
                    </div>
                  </div>
                </div>
                <Button size="m" stretched style={{ marginTop: 10 }} onClick={() => window.open(r.seller.contact, '_blank')}>
                  Написать
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Group>
    </>
  )
}
