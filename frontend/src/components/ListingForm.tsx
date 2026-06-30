import { useState } from 'react'
import { Group, Header, FormItem, Input, Textarea, Button, Div, Radio, Checkbox, Footnote } from '@vkontakte/vkui'
import { Autocomplete } from './Autocomplete'
import { fetchBrands, fetchModels, type Brand, type Model } from '../api/directory'
import { createListing, type Condition } from '../api/listings'

// Форма добавления позиции вручную. Размеры зависят от категории модели.
export function ListingForm({ onCreated }: { onCreated: () => void }) {
  const [brand, setBrand] = useState<Brand | null>(null)
  const [model, setModel] = useState<Model | null>(null)
  const [sizeUs, setSizeUs] = useState('')
  const [sizeEu, setSizeEu] = useState('')
  const [size, setSize] = useState('')
  const [colorway, setColorway] = useState('')
  const [condition, setCondition] = useState<Condition>('new')
  const [hasBox, setHasBox] = useState(true)
  const [fitting, setFitting] = useState(false)
  const [price, setPrice] = useState('')
  const [city, setCity] = useState('')
  const [photo, setPhoto] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [resetKey, setResetKey] = useState(0)

  const isFootwear = model?.category.slug === 'footwear'

  function reset() {
    setModel(null)
    setBrand(null)
    setSizeUs('')
    setSizeEu('')
    setSize('')
    setColorway('')
    setCondition('new')
    setHasBox(true)
    setFitting(false)
    setPrice('')
    setCity('')
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
      await createListing({
        modelId: model.id,
        sizeUs: isFootwear ? sizeUs : undefined,
        sizeEu: isFootwear ? sizeEu : undefined,
        size: isFootwear ? undefined : size,
        colorway,
        condition,
        hasBox,
        fitting,
        price: priceNum,
        city,
        photo,
        comment,
      })
      setOkMsg(`Добавлено: ${model.brand.name} ${model.name}`)
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
          {isFootwear ? (
            <div style={{ display: 'flex' }}>
              <FormItem top="Размер US" style={{ flex: 1 }}>
                <Input value={sizeUs} onChange={(e) => setSizeUs(e.target.value)} placeholder="9.5" />
              </FormItem>
              <FormItem top="Размер EU" style={{ flex: 1 }}>
                <Input value={sizeEu} onChange={(e) => setSizeEu(e.target.value)} placeholder="43" />
              </FormItem>
            </div>
          ) : (
            <FormItem top="Размер">
              <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="M, 42mm, one size" />
            </FormItem>
          )}

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
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" />
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
          Добавить в сток
        </Button>
      </Div>
    </Group>
  )
}
