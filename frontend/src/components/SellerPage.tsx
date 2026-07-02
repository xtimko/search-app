import { useEffect, useMemo, useState } from 'react'
import { ListingForm } from './ListingForm'
import { ImportPanel } from './ImportPanel'
import { StockGroupCard, type StockGroup } from './StockGroupCard'
import { fetchMyListings, type MyListing } from '../api/listings'

type Section = 'stock' | 'add' | 'import'

function sizeLabel(l: MyListing): string {
  if (l.sizeUs || l.sizeEu) {
    return [l.sizeUs && `US ${l.sizeUs}`, l.sizeEu && `EU ${l.sizeEu}`].filter(Boolean).join(' / ')
  }
  return l.size || '—'
}

// Мой сток: внутренние разделы «Сток / Добавить / Импорт» — без простыни.
export function SellerPage() {
  const [items, setItems] = useState<MyListing[]>([])
  const [filter, setFilter] = useState('')
  const [section, setSection] = useState<Section>('stock')

  function reload() {
    fetchMyListings().then(setItems).catch(() => setItems([]))
  }

  useEffect(() => {
    reload()
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, StockGroup>()
    for (const l of items) {
      const key = `${l.model.id}|${l.colorway ?? ''}|${l.condition}|${l.price}`
      let g = map.get(key)
      if (!g) {
        g = {
          key,
          modelId: l.model.id,
          brandName: l.model.brand.name,
          modelName: l.model.name,
          categoryName: l.model.category.name,
          categorySlug: l.model.category.slug,
          colorway: l.colorway,
          condition: l.condition,
          price: l.price,
          city: l.city,
          fitting: l.fitting,
          items: [],
        }
        map.set(key, g)
      }
      g.items.push({ id: l.id, size: sizeLabel(l), inStock: l.inStock })
    }
    return [...map.values()]
  }, [items])

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => `${g.brandName} ${g.modelName} ${g.colorway ?? ''}`.toLowerCase().includes(q))
  }, [groups, filter])

  const inStock = items.filter((i) => i.inStock).length

  return (
    <div style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Мой сток</h1>
          {items.length > 0 && (
            <div className="text-3" style={{ fontSize: 13, marginTop: 2 }}>
              {groups.length} товаров · {items.length} позиций · в наличии {inStock}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={section === 'stock' ? 'chip chip-active' : 'chip'} onClick={() => setSection('stock')}>
            Сток
          </button>
          <button className={section === 'add' ? 'chip chip-active' : 'chip'} onClick={() => setSection('add')}>
            + Добавить
          </button>
          <button className={section === 'import' ? 'chip chip-active' : 'chip'} onClick={() => setSection('import')}>
            Импорт из таблицы
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {section === 'stock' && (
          <>
            {items.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontWeight: 700 }}>Пока пусто</div>
                <div className="text-2" style={{ fontSize: 13, margin: '6px 0 14px' }}>
                  Добавь первую позицию вручную или загрузи сразу всё таблицей
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setSection('add')}>+ Добавить</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setSection('import')}>Импорт из таблицы</button>
                </div>
              </div>
            )}
            {items.length > 0 && (
              <>
                <input
                  className="input"
                  style={{ marginBottom: 10 }}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="фильтр по названию…"
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
                  {shown.map((g) => (
                    <StockGroupCard key={g.key} group={g} onChanged={reload} />
                  ))}
                </div>
                {shown.length === 0 && <p className="text-3">ничего не найдено по фильтру</p>}
              </>
            )}
          </>
        )}
        {section === 'add' && <ListingForm onCreated={() => { reload(); setSection('stock') }} />}
        {section === 'import' && <ImportPanel onImported={() => { reload(); setSection('stock') }} />}
      </div>
    </div>
  )
}
