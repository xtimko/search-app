import { useState } from 'react'
import { Card, Div, FormItem, Input, Button, Radio, Checkbox, Footnote } from '@vkontakte/vkui'
import { updateListing, deleteListing, type MyListing, type Condition } from '../api/listings'

function sizeLabel(l: MyListing): string {
  if (l.sizeUs || l.sizeEu) {
    return [l.sizeUs && `US ${l.sizeUs}`, l.sizeEu && `EU ${l.sizeEu}`].filter(Boolean).join(' / ')
  }
  return l.size || '—'
}

// Карточка позиции продавца: просмотр + действия (продано/в наличии, изменить, удалить)
// и инлайн-редактирование.
export function ListingCard({ listing, onChanged }: { listing: MyListing; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isFootwear = listing.model.category.slug === 'footwear'

  const [sizeUs, setSizeUs] = useState(listing.sizeUs ?? '')
  const [sizeEu, setSizeEu] = useState(listing.sizeEu ?? '')
  const [size, setSize] = useState(listing.size ?? '')
  const [colorway, setColorway] = useState(listing.colorway ?? '')
  const [condition, setCondition] = useState<Condition>(listing.condition)
  const [hasBox, setHasBox] = useState(listing.hasBox)
  const [fitting, setFitting] = useState(listing.fitting)
  const [price, setPrice] = useState(String(listing.price))
  const [city, setCity] = useState(listing.city ?? '')

  async function act(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    setError('')
    try {
      await fn()
      onChanged()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    const priceNum = Number(price)
    if (!priceNum || priceNum <= 0) {
      setError('Цена должна быть числом больше 0')
      return
    }
    const ok = await act(() =>
      updateListing(listing.id, {
        price: priceNum,
        sizeUs: isFootwear ? sizeUs : undefined,
        sizeEu: isFootwear ? sizeEu : undefined,
        size: isFootwear ? undefined : size,
        colorway,
        condition,
        hasBox,
        fitting,
        city,
      }),
    )
    if (ok) setEditing(false)
  }

  return (
    <Card mode="outline" style={{ marginBottom: 8, opacity: listing.inStock ? 1 : 0.6 }}>
      <Div>
        <div style={{ fontWeight: 600 }}>
          {listing.model.brand.name} {listing.model.name}
          {listing.colorway && <span style={{ fontWeight: 400, color: '#666' }}> · {listing.colorway}</span>}
        </div>

        {!editing ? (
          <>
            <div style={{ color: '#555', fontSize: 14, margin: '2px 0 10px' }}>
              {listing.model.category.name} · {sizeLabel(listing)} · {listing.condition === 'new' ? 'новое' : 'б/у'}
              {listing.fitting && ' · примерка'} · <b>{listing.price.toLocaleString('ru-RU')} ₽</b>
              {listing.city && ` · ${listing.city}`}
              {!listing.inStock && <span style={{ color: '#c0392b' }}> · ПРОДАНО</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button size="s" mode="secondary" disabled={busy} onClick={() => act(() => updateListing(listing.id, { inStock: !listing.inStock }))}>
                {listing.inStock ? 'Отметить продано' : 'Вернуть в наличие'}
              </Button>
              <Button size="s" mode="secondary" disabled={busy} onClick={() => setEditing(true)}>
                Изменить
              </Button>
              <Button
                size="s"
                mode="secondary"
                appearance="negative"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Удалить позицию?')) act(() => deleteListing(listing.id))
                }}
              >
                Удалить
              </Button>
            </div>
          </>
        ) : (
          <>
            {isFootwear ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <FormItem top="US" style={{ flex: 1, padding: 0 }}>
                  <Input value={sizeUs} onChange={(e) => setSizeUs(e.target.value)} />
                </FormItem>
                <FormItem top="EU" style={{ flex: 1, padding: 0 }}>
                  <Input value={sizeEu} onChange={(e) => setSizeEu(e.target.value)} />
                </FormItem>
              </div>
            ) : (
              <FormItem top="Размер" style={{ padding: 0 }}>
                <Input value={size} onChange={(e) => setSize(e.target.value)} />
              </FormItem>
            )}
            <FormItem top="Расцветка" style={{ padding: 0 }}>
              <Input value={colorway} onChange={(e) => setColorway(e.target.value)} />
            </FormItem>
            <FormItem top="Состояние" style={{ padding: 0 }}>
              <Radio name={`cond-${listing.id}`} checked={condition === 'new'} onChange={() => setCondition('new')}>
                новое
              </Radio>
              <Radio name={`cond-${listing.id}`} checked={condition === 'used'} onChange={() => setCondition('used')}>
                б/у
              </Radio>
            </FormItem>
            <FormItem style={{ padding: 0 }}>
              <Checkbox checked={hasBox} onChange={(e) => setHasBox(e.target.checked)}>
                коробка
              </Checkbox>
              <Checkbox checked={fitting} onChange={(e) => setFitting(e.target.checked)}>
                примерка
              </Checkbox>
            </FormItem>
            <FormItem top="Цена, ₽" style={{ padding: 0 }}>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </FormItem>
            <FormItem top="Город" style={{ padding: 0 }}>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </FormItem>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button size="s" loading={busy} onClick={save}>
                Сохранить
              </Button>
              <Button size="s" mode="secondary" onClick={() => setEditing(false)}>
                Отмена
              </Button>
            </div>
          </>
        )}

        {error && <Footnote style={{ color: '#c0392b', marginTop: 6 }}>{error}</Footnote>}
      </Div>
    </Card>
  )
}
