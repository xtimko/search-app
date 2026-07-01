import { useEffect, useMemo, useState } from 'react'
import { Group, Header, Div, Search } from '@vkontakte/vkui'
import { ListingForm } from './ListingForm'
import { ImportPanel } from './ImportPanel'
import { ProfileForm } from './ProfileForm'
import { StockGroupCard, type StockGroup } from './StockGroupCard'
import { fetchMyListings, type MyListing } from '../api/listings'

function sizeLabel(l: MyListing): string {
  if (l.sizeUs || l.sizeEu) {
    return [l.sizeUs && `US ${l.sizeUs}`, l.sizeEu && `EU ${l.sizeEu}`].filter(Boolean).join(' / ')
  }
  return l.size || '—'
}

// Сторона продавца: профиль + массовая загрузка + ручное добавление + управление стоком (сгруппировано).
export function SellerPage() {
  const [items, setItems] = useState<MyListing[]>([])
  const [filter, setFilter] = useState('')

  function reload() {
    fetchMyListings().then(setItems).catch(() => setItems([]))
  }

  useEffect(() => {
    reload()
  }, [])

  // Группировка: одинаковый товар (модель+расцветка+состояние+цена) — одна карточка, размеры внутри.
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
    <>
      <ProfileForm />
      <ImportPanel onImported={reload} />
      <ListingForm onCreated={reload} />

      <Group
        header={
          <Header
            subtitle={items.length ? `${groups.length} товаров · ${items.length} позиций · в наличии ${inStock}` : undefined}
          >
            Мои позиции
          </Header>
        }
      >
        {items.length === 0 && <Div style={{ color: '#888' }}>пока пусто — добавьте позицию выше</Div>}

        {items.length > 0 && (
          <Search value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="фильтр по названию" />
        )}

        <Div>
          {shown.map((g) => (
            <StockGroupCard key={g.key} group={g} onChanged={reload} />
          ))}
          {items.length > 0 && shown.length === 0 && <div style={{ color: '#888' }}>ничего не найдено по фильтру</div>}
        </Div>
      </Group>
    </>
  )
}
