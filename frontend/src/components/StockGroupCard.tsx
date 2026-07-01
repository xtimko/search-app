import { useState } from 'react'
import { Card, Button, Input, Footnote } from '@vkontakte/vkui'
import { updateListing, deleteListing, createListing, type Condition } from '../api/listings'

export interface StockGroup {
  key: string
  modelId: number
  brandName: string
  modelName: string
  categoryName: string
  categorySlug: string
  colorway: string | null
  condition: Condition
  price: number
  city: string | null
  fitting: boolean
  items: { id: number; size: string; inStock: boolean }[]
}

// Одна карточка = один товар (модель+расцветка+состояние+цена). Размеры — чипы.
// Тап по размеру = «продано / в наличии». В режиме правки — цена, добавить/удалить размеры.
export function StockGroupCard({ group, onChanged }: { group: StockGroup; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [price, setPrice] = useState(String(group.price))
  const [sizeInput, setSizeInput] = useState('')

  const inStockCount = group.items.filter((i) => i.inStock).length

  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function savePrice() {
    const p = Number(price)
    if (!p || p <= 0) {
      setError('Цена должна быть больше 0')
      return
    }
    await act(async () => {
      for (const it of group.items) await updateListing(it.id, { price: p })
    })
  }

  async function addSizes() {
    const parts = sizeInput.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
    if (!parts.length) return
    setSizeInput('')
    await act(() =>
      createListing({
        modelId: group.modelId,
        sizes: parts,
        colorway: group.colorway ?? undefined,
        condition: group.condition,
        price: group.price,
        city: group.city ?? undefined,
        fitting: group.fitting,
      }),
    )
  }

  async function removeGroup() {
    if (!window.confirm(`Удалить «${group.brandName} ${group.modelName}» (${group.items.length} поз.)?`)) return
    await act(async () => {
      for (const it of group.items) await deleteListing(it.id)
    })
  }

  return (
    <Card mode="outline" style={{ marginBottom: 8 }}>
      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 600 }}>
          {group.brandName} {group.modelName}
          {group.colorway && <span style={{ fontWeight: 400, color: '#666' }}> · {group.colorway}</span>}
        </div>
        <div style={{ color: '#555', fontSize: 13, marginBottom: 8 }}>
          {group.categoryName} · {group.condition === 'new' ? 'новое' : 'б/у'} · <b>{group.price.toLocaleString('ru-RU')} ₽</b>
          {group.city && ` · ${group.city}`} · в наличии {inStockCount}/{group.items.length}
        </div>

        {/* Размеры-чипы: тап = продано/в наличии */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {group.items.map((it) => (
            <span
              key={it.id}
              onClick={() => !busy && act(() => updateListing(it.id, { inStock: !it.inStock }))}
              title={it.inStock ? 'в наличии — нажми, чтобы «продано»' : 'продано — нажми, чтобы вернуть'}
              style={{
                padding: '5px 11px',
                borderRadius: 16,
                fontSize: 14,
                cursor: 'pointer',
                userSelect: 'none',
                background: it.inStock ? '#e9edf7' : '#f0f0f0',
                color: it.inStock ? '#1c1c1e' : '#b0b0b0',
                textDecoration: it.inStock ? 'none' : 'line-through',
                border: it.inStock ? '1px solid #cdd6ee' : '1px solid #e3e3e3',
              }}
            >
              {it.size}
              {editing && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!busy) act(() => deleteListing(it.id))
                  }}
                  style={{ marginLeft: 6, color: '#c0392b' }}
                  title="удалить размер"
                >
                  ✕
                </span>
              )}
            </span>
          ))}
        </div>

        {editing && (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="цена ₽" />
              <Button mode="secondary" disabled={busy} onClick={savePrice}>
                Цена
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={sizeInput}
                onChange={(e) => setSizeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSizes()}
                placeholder="добавить размеры: 11, 11.5"
              />
              <Button mode="secondary" disabled={busy} onClick={addSizes}>
                + размеры
              </Button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Button size="s" mode="secondary" disabled={busy} onClick={() => setEditing((v) => !v)}>
            {editing ? 'Готово' : 'Изменить'}
          </Button>
          <Button size="s" mode="secondary" appearance="negative" disabled={busy} onClick={removeGroup}>
            Удалить
          </Button>
        </div>

        {error && <Footnote style={{ color: '#c0392b', marginTop: 6 }}>{error}</Footnote>}
      </div>
    </Card>
  )
}
