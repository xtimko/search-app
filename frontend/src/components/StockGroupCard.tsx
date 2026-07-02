import { useState } from 'react'
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

// Карточка группы: один товар, размеры — чипы (тап = продано/в наличии).
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
    <div className="card">
      <div style={{ fontWeight: 700 }}>
        {group.brandName} {group.modelName}
        {group.colorway && <span className="text-2" style={{ fontWeight: 400 }}> · {group.colorway}</span>}
      </div>
      <div className="text-2" style={{ fontSize: 13, margin: '2px 0 10px' }}>
        {group.categoryName} · {group.condition === 'new' ? 'новое' : 'б/у'} ·{' '}
        <span className="text-accent" style={{ fontWeight: 700 }}>{group.price.toLocaleString('ru-RU')} ₽</span>
        {group.city && ` · ${group.city}`} · в наличии {inStockCount}/{group.items.length}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {group.items.map((it) => (
          <span
            key={it.id}
            className={it.inStock ? 'size-chip' : 'size-chip size-chip-sold'}
            onClick={() => !busy && act(() => updateListing(it.id, { inStock: !it.inStock }))}
            title={it.inStock ? 'в наличии — нажми, чтобы «продано»' : 'продано — нажми, чтобы вернуть'}
          >
            {it.size}
            {editing && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  if (!busy) act(() => deleteListing(it.id))
                }}
                className="text-danger"
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
            <input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="цена ₽" />
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={savePrice}>
              Цена
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSizes()}
              placeholder="добавить размеры: 11, 11.5"
            />
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={addSizes}>
              + размеры
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setEditing((v) => !v)}>
          {editing ? 'Готово' : 'Изменить'}
        </button>
        <button className="btn btn-danger btn-sm" disabled={busy} onClick={removeGroup}>
          Удалить
        </button>
      </div>

      {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  )
}
