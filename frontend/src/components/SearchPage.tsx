import { useEffect, useState } from 'react'
import { Group, Header, FormItem, Input, NativeSelect, Button, Div, Card, Footnote, Spinner } from '@vkontakte/vkui'
import { Autocomplete } from './Autocomplete'
import { fetchBrands, fetchCategories, type Brand, type Category } from '../api/directory'
import { search, type SearchResult, type SearchResponse } from '../api/search'

function sizeLabel(r: SearchResult): string {
  if (r.sizeUs || r.sizeEu) {
    return [r.sizeUs && `US ${r.sizeUs}`, r.sizeEu && `EU ${r.sizeEu}`].filter(Boolean).join(' / ')
  }
  return r.size || '—'
}

export function SearchPage() {
  const [q, setQ] = useState('')
  const [brand, setBrand] = useState<Brand | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState(0)
  const [condition, setCondition] = useState<'' | 'new' | 'used'>('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [city, setCity] = useState('')
  const [sort, setSort] = useState('price_asc')

  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)

  async function doSearch() {
    setLoading(true)
    try {
      setData(
        await search({
          q: q.trim() || undefined,
          brandId: brand?.id,
          categoryId: categoryId || undefined,
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
    fetchCategories().then(setCategories).catch(() => setCategories([]))
    doSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parsed = data?.parsed
  const results = data?.results ?? []

  return (
    <>
      <Group header={<Header>Поиск</Header>}>
        <FormItem top="Запрос">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="Jordan 4 42, nb 2002r 9us, samba…"
          />
        </FormItem>
        <FormItem top="Бренд (необязательно)">
          <Autocomplete<Brand> placeholder="фильтр по бренду" fetcher={fetchBrands} getKey={(b) => b.id} getLabel={(b) => b.name} onSelect={(b) => setBrand(b)} />
          {brand && (
            <Footnote style={{ marginTop: 6 }}>
              выбран: {brand.name}{' '}
              <span style={{ color: '#3b5bdb', cursor: 'pointer' }} onClick={() => setBrand(null)}>
                сбросить
              </span>
            </Footnote>
          )}
        </FormItem>
        <FormItem top="Категория">
          <NativeSelect value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            <option value={0}>Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? '— ' : ''}
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </FormItem>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          <FormItem top="Состояние" style={{ flex: 1 }}>
            <NativeSelect value={condition} onChange={(e) => setCondition(e.target.value as '' | 'new' | 'used')}>
              <option value="">любое</option>
              <option value="new">новое</option>
              <option value="used">б/у</option>
            </NativeSelect>
          </FormItem>
          <FormItem top="Сортировка" style={{ flex: 1 }}>
            <NativeSelect value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="price_asc">сначала дешёвые</option>
              <option value="price_desc">сначала дорогие</option>
              <option value="new">сначала новые</option>
            </NativeSelect>
          </FormItem>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          <FormItem top="Цена от" style={{ flex: 1 }}>
            <Input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
          </FormItem>
          <FormItem top="до" style={{ flex: 1 }}>
            <Input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
          </FormItem>
          <FormItem top="Город" style={{ flex: 1 }}>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </FormItem>
        </div>
        <Div>
          <Button size="l" stretched loading={loading} onClick={doSearch}>
            Найти
          </Button>
        </Div>
        {parsed && (parsed.sizeUs || parsed.sizeEu || parsed.text) && (
          <Div>
            <Footnote>
              поняли запрос: {parsed.text && `«${parsed.text}»`}
              {parsed.sizeUs && ` · US ${parsed.sizeUs}`}
              {parsed.sizeEu && ` · EU ${parsed.sizeEu}`}
            </Footnote>
          </Div>
        )}
      </Group>

      <Group header={<Header>{loading ? 'Ищем…' : `Найдено: ${results.length}`}</Header>}>
        {loading && <Div><Spinner /></Div>}
        {!loading && results.length === 0 && <Div style={{ color: '#888' }}>ничего не нашлось — измените запрос или фильтры</Div>}
        <Div>
          {results.map((r) => (
            <Card key={r.id} mode="outline" style={{ marginBottom: 8 }}>
              <Div style={{ display: 'flex', gap: 12 }}>
                {r.photo ? (
                  <img src={r.photo} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 8, background: '#ebedf0', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {r.model.brand.name} {r.model.name}
                    {r.colorway && <span style={{ fontWeight: 400, color: '#666' }}> · {r.colorway}</span>}
                  </div>
                  <div style={{ color: '#555', fontSize: 14 }}>
                    {r.model.category.name} · {sizeLabel(r)} · {r.condition === 'new' ? 'новое' : 'б/у'}
                    {r.fitting && ' · примерка'} · <b>{r.price.toLocaleString('ru-RU')} ₽</b>
                  </div>
                  <div style={{ color: '#777', fontSize: 13, marginTop: 4 }}>
                    {r.seller.nick}
                    {r.seller.status === 'approved' && <span style={{ color: '#1e8e3e' }}> ✓ проверенный</span>}
                    {(r.city || r.seller.city) && ` · ${r.city || r.seller.city}`}
                    {r.seller.experience && ` · стаж: ${r.seller.experience}`}
                  </div>
                </div>
                <Button size="m" style={{ alignSelf: 'center' }} onClick={() => window.open(r.seller.contact, '_blank')}>
                  Написать
                </Button>
              </Div>
            </Card>
          ))}
        </Div>
      </Group>
    </>
  )
}
