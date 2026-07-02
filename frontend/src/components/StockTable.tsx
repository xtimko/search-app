import { useState } from 'react'
import { updateListing, deleteListing, createListing } from '../api/listings'
import type { StockGroup } from './StockGroupCard'

// Компактный табличный вид стока («как Excel»): строка = товар, размеры — мини-чипы
// (клик = продано/в наличии), цена редактируется по клику, добавление размеров инлайн.
export function StockTable({ groups, onChanged }: { groups: StockGroup[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [priceEdit, setPriceEdit] = useState<string | null>(null)
  const [priceVal, setPriceVal] = useState('')
  const [sizeEdit, setSizeEdit] = useState<string | null>(null)
  const [sizeVal, setSizeVal] = useState('')
  const [error, setError] = useState('')

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

  async function savePrice(g: StockGroup) {
    const p = Number(priceVal)
    setPriceEdit(null)
    if (!p || p <= 0 || p === g.price) return
    await act(async () => {
      for (const it of g.items) await updateListing(it.id, { price: p })
    })
  }

  async function addSizes(g: StockGroup) {
    const parts = sizeVal.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
    setSizeEdit(null)
    setSizeVal('')
    if (!parts.length) return
    await act(() =>
      createListing({
        modelId: g.modelId,
        sizes: parts,
        colorway: g.colorway ?? undefined,
        condition: g.condition,
        price: g.price,
        city: g.city ?? undefined,
        fitting: g.fitting,
      }),
    )
  }

  const td: React.CSSProperties = { padding: '7px 10px', verticalAlign: 'middle' }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-card)', textAlign: 'left' }}>
            <th style={{ ...td, color: 'var(--text-3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Товар</th>
            <th style={{ ...td, color: 'var(--text-3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Размеры (клик = продано)</th>
            <th style={{ ...td, color: 'var(--text-3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Цена</th>
            <th style={{ ...td, color: 'var(--text-3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Наличие</th>
            <th style={{ ...td }}></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const inStock = g.items.filter((i) => i.inStock).length
            return (
              <tr key={g.key} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, minWidth: 180 }}>
                  <div style={{ fontWeight: 600 }}>
                    {g.brandName} {g.modelName}
                  </div>
                  <div className="text-3" style={{ fontSize: 11 }}>
                    {g.colorway ? `${g.colorway} · ` : ''}
                    {g.condition === 'new' ? 'новое' : 'б/у'}
                    {g.fitting && ' · примерка'}
                    {g.city && ` · ${g.city}`}
                  </div>
                </td>
                <td style={{ ...td }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    {g.items.map((it) => (
                      <span
                        key={it.id}
                        onClick={() => !busy && !it.reserved && act(() => updateListing(it.id, { inStock: !it.inStock }))}
                        title={it.reserved ? 'в открытой сделке (резерв)' : it.inStock ? 'в наличии — клик: продано' : 'продано — клик: вернуть'}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 12,
                          cursor: it.reserved ? 'default' : 'pointer',
                          userSelect: 'none',
                          background: it.inStock ? 'var(--bg-elev)' : 'transparent',
                          border: `1px solid ${it.reserved ? 'var(--warn)' : it.inStock ? 'var(--border-strong)' : 'var(--border)'}`,
                          color: it.reserved ? 'var(--warn)' : it.inStock ? 'var(--text)' : 'var(--text-3)',
                          textDecoration: it.inStock ? 'none' : 'line-through',
                        }}
                      >
                        {it.size}
                      </span>
                    ))}
                    {sizeEdit === g.key ? (
                      <input
                        className="input"
                        autoFocus
                        style={{ width: 110, padding: '2px 8px', fontSize: 12 }}
                        value={sizeVal}
                        onChange={(e) => setSizeVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addSizes(g)
                          if (e.key === 'Escape') setSizeEdit(null)
                        }}
                        onBlur={() => addSizes(g)}
                        placeholder="9, 9.5"
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setSizeEdit(g.key)
                          setSizeVal('')
                        }}
                        title="добавить размеры"
                        style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, cursor: 'pointer', border: '1px dashed var(--border-strong)', color: 'var(--text-3)' }}
                      >
                        +
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {priceEdit === g.key ? (
                    <input
                      className="input"
                      autoFocus
                      type="number"
                      style={{ width: 100, padding: '2px 8px', fontSize: 12 }}
                      value={priceVal}
                      onChange={(e) => setPriceVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') savePrice(g)
                        if (e.key === 'Escape') setPriceEdit(null)
                      }}
                      onBlur={() => savePrice(g)}
                    />
                  ) : (
                    <span
                      className="text-accent"
                      style={{ fontWeight: 700, cursor: 'pointer', borderBottom: '1px dashed var(--border-strong)' }}
                      title="изменить цену"
                      onClick={() => {
                        setPriceEdit(g.key)
                        setPriceVal(String(g.price))
                      }}
                    >
                      {g.price.toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }} className={inStock ? '' : 'text-3'}>
                  {inStock}/{g.items.length}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <span
                    className="text-danger"
                    style={{ cursor: 'pointer', fontSize: 14, padding: 4 }}
                    title="удалить товар со всеми размерами"
                    onClick={() => {
                      if (window.confirm(`Удалить «${g.brandName} ${g.modelName}» (${g.items.length} поз.)?`)) {
                        act(async () => {
                          for (const it of g.items) await deleteListing(it.id)
                        })
                      }
                    }}
                  >
                    ✕
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {error && <div className="text-danger" style={{ fontSize: 13, padding: '8px 12px' }}>{error}</div>}
    </div>
  )
}
