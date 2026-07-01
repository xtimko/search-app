import { useState } from 'react'
import { Group, Header, FormItem, Input, Textarea, Button, Div, Radio, Checkbox, Footnote } from '@vkontakte/vkui'
import { Autocomplete } from './Autocomplete'
import { fetchBrands, fetchModels, type Brand, type Model } from '../api/directory'
import { createListing, type Condition } from '../api/listings'

// Форма добавления. Один товар + несколько размеров сразу → создаётся позиция на каждый размер.
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
  const [okMsg, setOkMsg] = useState('')
  const [resetKey, setResetKey] = useState(0)

  const isFootwear = model?.category.slug === 'footwear'

  function addSize(raw: string) {
    const parts = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length) setSizes((prev) => [...new Set([...prev, ...parts])])
    setSizeInput('')
  }

  function reset() {
    setModel(null)
    setBrand(null)
    setSizes([])
    setSizeInput('')
    setColorway('')
    setCondition('new')
    setHasBox(true)
    setFitting(false)
    setPrice('')
    setPhoto('')
    setComment('')
    setResetKey((k) => k + 1)
  }

  async function submit() {
    setError('')
    setOkMsg('')
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
      const n = sizes.length || 1
      setOkMsg(`Добавлено: ${model.brand.name} ${model.name} — ${n} ${n === 1 ? 'позиция' : 'позиций'}`)
      reset()
      onCreated()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Group header={<Header>Добавить позицию вручную</Header>}>
      <FormItem top="Бренд (для сужения списка моделей)">
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
      </FormItem>

      <FormItem top="Модель *">
        <Autocomplete<Model>
          key={`model-${resetKey}`}
          placeholder="350, дж4, m2002r…"
          fetcher={(q) => fetchModels(q, brand?.id)}
          getKey={(m) => m.id}
          getLabel={(m) => m.name}
          renderItem={(m) => (
            <span>
              {m.name} <span style={{ color: '#888', fontSize: 13 }}>· {m.brand.name} · {m.category.name}</span>
            </span>
          )}
          onSelect={(m) => {
            setModel(m)
            setBrand(m.brand as Brand)
          }}
        />
      </FormItem>

      {model && (
        <>
          <FormItem top={isFootwear ? 'Размеры (US) — можно несколько' : 'Размеры — можно несколько'} bottom="Введите размер и нажмите Enter или «+». Оставьте пусто, если размер не нужен.">
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
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
              <Button mode="secondary" onClick={() => addSize(sizeInput)}>
                + добавить
              </Button>
            </div>
            {sizes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {sizes.map((s) => (
                  <span
                    key={s}
                    onClick={() => setSizes((prev) => prev.filter((x) => x !== s))}
                    style={{ padding: '4px 10px', background: '#e9edf7', borderRadius: 16, fontSize: 14, cursor: 'pointer' }}
                    title="убрать"
                  >
                    {s} ✕
                  </span>
                ))}
              </div>
            )}
          </FormItem>

          <FormItem top="Расцветка">
            <Input value={colorway} onChange={(e) => setColorway(e.target.value)} placeholder="Mocha, Onyx…" />
          </FormItem>

          <FormItem top="Состояние">
            <Radio name="cond" checked={condition === 'new'} onChange={() => setCondition('new')}>
              новое
            </Radio>
            <Radio name="cond" checked={condition === 'used'} onChange={() => setCondition('used')}>
              б/у
            </Radio>
          </FormItem>

          <FormItem>
            <Checkbox checked={hasBox} onChange={(e) => setHasBox(e.target.checked)}>
              с коробкой
            </Checkbox>
            <Checkbox checked={fitting} onChange={(e) => setFitting(e.target.checked)}>
              примерка
            </Checkbox>
          </FormItem>

          <FormItem top="Цена, ₽ *">
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="12000" />
          </FormItem>
          <FormItem top="Город">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </FormItem>
          <FormItem top="Фото (ссылка)">
            <Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://…" />
          </FormItem>
          <FormItem top="Комментарий">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </FormItem>
        </>
      )}

      {error && (
        <FormItem>
          <Footnote style={{ color: '#c0392b' }}>{error}</Footnote>
        </FormItem>
      )}
      {okMsg && (
        <FormItem>
          <Footnote style={{ color: '#1e8e3e' }}>{okMsg}</Footnote>
        </FormItem>
      )}
      <Div>
        <Button size="l" stretched loading={busy} onClick={submit}>
          {sizes.length > 1 ? `Добавить ${sizes.length} позиций` : 'Добавить в сток'}
        </Button>
      </Div>
    </Group>
  )
}
