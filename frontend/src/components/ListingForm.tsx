import { useState } from 'react'
import { Autocomplete } from './Autocomplete'
import { fetchBrands, fetchModels, type Brand, type Model } from '../api/directory'
import { createListing, type Condition } from '../api/listings'

// Добавление вручную: один товар + несколько размеров сразу.
export function ListingForm({ onCreated }: { onCreated: () => void }) {
  const [brand, setBrand] = useState<Brand | null>(null)
  const [model, setModel] = useState<Model | null>(null)
  const [sizes, setSizes] = useState<string[]>([])
  const [sizeInput, setSizeInput] = useState('')
  const [colorway, setColorway] = useState('')
  const [condition, setCondition] = useState<Condition>('new')
  const [hasBox, setHasBox] = useState(true)
  const [fitting, setFitting] = useState(false)
  const [price, setPrice] = useState('')
  const [city, setCity] = useState('Москва')
  const [photo, setPhoto] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resetKey, setResetKey] = useState(0)

  const isFootwear = model?.category.slug === 'footwear'

  function addSize(raw: string) {
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length) setSizes((prev) => [...new Set([...prev, ...parts])])
    setSizeInput('')
  }

  async function submit() {
    setError('')
    if (!model) {
      setError('Выберите модель')
      return
    }
    const priceNum = Number(price)
    if (!priceNum || priceNum <= 0) {
      setError('Укажите цену (число больше 0)')
      return
    }
    setBusy(true)
    try {
      await createListing({ modelId: model.id, sizes, colorway, condition, hasBox, fitting, price: priceNum, city, photo, comment })
      setModel(null)
      setBrand(null)
      setSizes([])
      setColorway('')
      setPrice('')
      setPhoto('')
      setComment('')
      setResetKey((k) => k + 1)
      onCreated()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <span className="label" style={{ marginTop: 0 }}>Бренд (для сужения списка моделей)</span>
      <Autocomplete<Brand>
        key={`brand-${resetKey}`}
        placeholder="nb, форсы, бетон…"
        fetcher={fetchBrands}
        getKey={(b) => b.id}
        getLabel={(b) => b.name}
        onSelect={(b) => {
          setBrand(b)
          setModel(null)
        }}
      />

      <span className="label">Модель *</span>
      <Autocomplete<Model>
        key={`model-${resetKey}`}
        placeholder="350, дж4, m2002r…"
        fetcher={(q) => fetchModels(q, brand?.id)}
        getKey={(m) => m.id}
        getLabel={(m) => m.name}
        renderItem={(m) => (
          <span>
            {m.name} <span className="text-3" style={{ fontSize: 12 }}>· {m.brand.name} · {m.category.name}</span>
          </span>
        )}
        onSelect={(m) => {
          setModel(m)
          setBrand(m.brand as Brand)
        }}
      />

      {model && (
        <>
          <span className="label">{isFootwear ? 'Размеры (US) — можно несколько' : 'Размеры — можно несколько'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSize(sizeInput)
                }
              }}
              placeholder={isFootwear ? '9, 9.5, 10…' : 'S, M, L…'}
            />
            <button className="btn btn-outline" onClick={() => addSize(sizeInput)}>
              + добавить
            </button>
          </div>
          {sizes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {sizes.map((s) => (
                <span key={s} className="size-chip" onClick={() => setSizes((prev) => prev.filter((x) => x !== s))} title="убрать">
                  {s} ✕
                </span>
              ))}
            </div>
          )}

          <span className="label">Расцветка</span>
          <input className="input" value={colorway} onChange={(e) => setColorway(e.target.value)} placeholder="Mocha, Onyx…" />

          <span className="label">Состояние</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={condition === 'new' ? 'chip chip-active' : 'chip'} onClick={() => setCondition('new')}>новое</button>
            <button className={condition === 'used' ? 'chip chip-active' : 'chip'} onClick={() => setCondition('used')}>б/у</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className={hasBox ? 'chip chip-active' : 'chip'} onClick={() => setHasBox((v) => !v)}>с коробкой</button>
            <button className={fitting ? 'chip chip-active' : 'chip'} onClick={() => setFitting((v) => !v)}>примерка</button>
          </div>

          <span className="label">Цена, ₽ *</span>
          <input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="12000" />
          <span className="label">Город</span>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
          <span className="label">Фото (ссылка)</span>
          <input className="input" value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://…" />
          <span className="label">Комментарий</span>
          <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} />
        </>
      )}

      {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 10 }}>{error}</div>}

      <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 16 }} disabled={busy} onClick={submit}>
        {busy ? 'Добавляю…' : sizes.length > 1 ? `Добавить ${sizes.length} позиций` : 'Добавить в сток'}
      </button>
    </div>
  )
}
