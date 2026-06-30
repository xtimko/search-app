import { useEffect, useState } from 'react'
import { Group, Header, Div } from '@vkontakte/vkui'
import { ListingForm } from './ListingForm'
import { ListingCard } from './ListingCard'
import { ImportPanel } from './ImportPanel'
import { ProfileForm } from './ProfileForm'
import { fetchMyListings, type MyListing } from '../api/listings'

// Сторона продавца: профиль + массовая загрузка + ручное добавление + управление стоком.
export function SellerPage() {
  const [items, setItems] = useState<MyListing[]>([])

  function reload() {
    fetchMyListings().then(setItems).catch(() => setItems([]))
  }

  useEffect(() => {
    reload()
  }, [])

  const inStock = items.filter((i) => i.inStock).length

  return (
    <>
      <ProfileForm />
      <ImportPanel onImported={reload} />
      <ListingForm onCreated={reload} />

      <Group header={<Header>{`Мои позиции (${inStock} в наличии / ${items.length} всего)`}</Header>}>
        {items.length === 0 && <Div style={{ color: '#888' }}>пока пусто — добавьте позицию выше</Div>}
        <Div>
          {items.map((l) => (
            <ListingCard key={l.id} listing={l} onChanged={reload} />
          ))}
        </Div>
      </Group>
    </>
  )
}
