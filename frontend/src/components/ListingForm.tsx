import { useEffect, useState } from 'react'
import { Autocomplete } from './Autocomplete'
import { fetchBrands, fetchModels, fetchCategories, createModel, type Brand, type Model, type Category } from '../api/directory'
import { createListing, type Condition } from '../api/listings'
import { PhotoPicker } from './PhotoPicker'

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

  // Добавление своей модели, которой нет в справочнике.
  const [categories, setCategories] = useState<Category[]>([])
  const [showNewModel, setShowNewModel] = useState(false)
  const [newBrand, setNewBrand] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [newCategoryId, setNewCategoryId] = useState<number | ''>('')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newSku, setNewSku] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  const isFootwear = model?.category.slug === 'footwear'

  function addSize(raw: string) {
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length) setSizes((prev) => [...new Set([...prev, ...parts])])
    setSizeInput('')
  }

  async function createNewModel() {
    setError('')
    if (newBrand.trim().length < 2) return setError('Укажите бренд (мин. 2 символа)')
    if (newModelName.trim().length < 2) return setError('Укажите название модели')
    if (!newCategoryId) return setError('Выберите категорию')
    setCreating(true)
    try {
      const m = await createModel({ brandName: newBrand.trim(), name: newModelName.trim(), categoryId: Number(newCategoryId), imageUrl: newImageUrl.trim() || undefined, sku: newSku.trim() || undefined })
      setModel(m)
      setBrand(m.brand as Brand)
      setShowNewModel(false)
      setNewBrand('')
      setNewModelName('')
      setNewCategoryId('')
      setNewImageUrl('')
      setNewSku('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
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

      {model ? (
        <div className="text-2" style={{ fontSize: 13, marginTop: 6 }}>
          Выбрано: <b>{model.brand.name} {model.name}</b>{' '}
          <span className="text-3">· {model.category.name}</span>{' '}
          <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setModel(null)}>сменить</span>
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          {!showNewModel ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setShowNewModel(true)
                setNewBrand(brand?.name ?? '')
              }}
            >
              Нет в списке? Добавить свою модель
            </button>
          ) : (
            <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Новая модель в справочник</div>
              <span className="label" style={{ marginTop: 0 }}>Бренд</span>
              <input className="input" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Bottega Veneta" />
              <span className="label">Название модели</span>
              <input className="input" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="Puddle Boot" />
              <span className="label">Категория</span>
              <select className="select" value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">— выбери —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? '— ' : ''}{c.name}
                  </option>
                ))}
              </select>
              <span className="label">Заводской артикул (если знаешь)</span>
              <input className="input" value={newSku} onChange={(e) => setNewSku(e.target.value)} placeholder="напр. adidas B75806" />
              <span className="label">Фото модели (необязательно)</span>
              <PhotoPicker value={newImageUrl} onChange={setNewImageUrl} />
              <div className="hint" style={{ marginTop: 4 }}>Карточка создастся сразу и уйдёт на модерацию — админ проверит название, артикул и фото. Каталожное фото подставится во все объявления этой модели.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn btn-primary btn-sm" disabled={creating} onClick={createNewModel}>
                  {creating ? 'Создаю…' : 'Создать и выбрать'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewModel(false)}>Отмена</button>
              </div>
            </div>
          )}
        </div>
      )}

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
          <span className="label">Фото своей пары (необязательно)</span>
          <PhotoPicker value={photo} onChange={setPhoto} hint="Если не добавишь — в каталоге покажется фото модели." />
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
