import { useEffect, useState } from 'react'
import { Group, Header, Div, FormItem, Input, NativeSelect, Button, Card, Footnote } from '@vkontakte/vkui'
import { Autocomplete } from './Autocomplete'
import { fetchCategories, fetchBrands, type Brand, type Category } from '../api/directory'
import { fetchSellers, setSellerStatus, addBrand, addModel, type AdminSeller } from '../api/admin'

const STATUS: Record<AdminSeller['status'], { text: string; color: string }> = {
  pending: { text: 'на модерации', color: '#b8860b' },
  approved: { text: 'проверенный', color: '#1e8e3e' },
  blocked: { text: 'заблокирован', color: '#c0392b' },
}

export function AdminPage() {
  const [sellers, setSellers] = useState<AdminSeller[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState('')

  const [brandName, setBrandName] = useState('')
  const [brandAliases, setBrandAliases] = useState('')
  const [mBrand, setMBrand] = useState<Brand | null>(null)
  const [mCategory, setMCategory] = useState(0)
  const [mName, setMName] = useState('')
  const [mAliases, setMAliases] = useState('')
  const [mSku, setMSku] = useState('')
  const [dirMsg, setDirMsg] = useState('')
  const [resetKey, setResetKey] = useState(0)

  function loadSellers() {
    fetchSellers().then(setSellers).catch(() => setError('нет доступа к админке'))
  }
  useEffect(() => {
    loadSellers()
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  async function changeStatus(id: number, status: AdminSeller['status']) {
    await setSellerStatus(id, status).catch((e) => setError((e as Error).message))
    loadSellers()
  }

  const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

  async function submitBrand() {
    setDirMsg('')
    try {
      await addBrand(brandName, csv(brandAliases))
      setDirMsg(`Бренд добавлен: ${brandName}`)
      setBrandName('')
      setBrandAliases('')
    } catch (e) {
      setDirMsg((e as Error).message)
    }
  }

  async function submitModel() {
    setDirMsg('')
    if (!mBrand || !mCategory || !mName.trim()) {
      setDirMsg('Нужны бренд, категория и название модели')
      return
    }
    try {
      await addModel({ brandId: mBrand.id, categoryId: mCategory, name: mName, aliases: csv(mAliases), sku: mSku || undefined })
      setDirMsg(`Модель добавлена: ${mBrand.name} ${mName}`)
      setMName('')
      setMAliases('')
      setMSku('')
      setMBrand(null)
      setMCategory(0)
      setResetKey((k) => k + 1)
    } catch (e) {
      setDirMsg((e as Error).message)
    }
  }

  return (
    <>
      <Group header={<Header>{`Продавцы (${sellers.length})`}</Header>}>
        {error && <Div><Footnote style={{ color: '#c0392b' }}>{error}</Footnote></Div>}
        <Div>
          {sellers.map((s) => {
            const st = STATUS[s.status]
            return (
              <Card key={s.id} mode="outline" style={{ marginBottom: 8 }}>
                <Div>
                  <div style={{ fontWeight: 600 }}>
                    {s.nick} <span style={{ fontWeight: 400, color: '#999' }}>· vk {s.vkId} · позиций: {s._count.listings}</span>
                  </div>
                  <div style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>
                    {s.contact}
                    {s.city && ` · ${s.city}`} · <b style={{ color: st.color }}>{st.text}</b>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button size="s" mode="secondary" disabled={s.status === 'approved'} onClick={() => changeStatus(s.id, 'approved')}>
                      Одобрить
                    </Button>
                    <Button size="s" mode="secondary" appearance="negative" disabled={s.status === 'blocked'} onClick={() => changeStatus(s.id, 'blocked')}>
                      Заблокировать
                    </Button>
                    {s.status !== 'pending' && (
                      <Button size="s" mode="tertiary" onClick={() => changeStatus(s.id, 'pending')}>
                        В ожидание
                      </Button>
                    )}
                  </div>
                </Div>
              </Card>
            )
          })}
        </Div>
      </Group>

      <Group header={<Header>Справочник</Header>}>
        {dirMsg && <Div><Footnote style={{ color: dirMsg.includes('добавлен') ? '#1e8e3e' : '#c0392b' }}>{dirMsg}</Footnote></Div>}

        <FormItem top="Новый бренд — название">
          <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="напр. Off-White" />
        </FormItem>
        <FormItem top="Алиасы через запятую">
          <Input value={brandAliases} onChange={(e) => setBrandAliases(e.target.value)} placeholder="офвайт, ow" />
        </FormItem>
        <Div>
          <Button stretched onClick={submitBrand}>Добавить бренд</Button>
        </Div>

        <FormItem top="Новая модель — бренд">
          <Autocomplete<Brand> key={`b-${resetKey}`} placeholder="бренд модели" fetcher={fetchBrands} getKey={(b) => b.id} getLabel={(b) => b.name} onSelect={(b) => setMBrand(b)} />
        </FormItem>
        <FormItem top="Категория">
          <NativeSelect value={mCategory} onChange={(e) => setMCategory(Number(e.target.value))}>
            <option value={0}>категория…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? '— ' : ''}
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </FormItem>
        <FormItem top="Название модели">
          <Input value={mName} onChange={(e) => setMName(e.target.value)} />
        </FormItem>
        <FormItem top="Алиасы через запятую">
          <Input value={mAliases} onChange={(e) => setMAliases(e.target.value)} />
        </FormItem>
        <FormItem top="Артикул (опц.)">
          <Input value={mSku} onChange={(e) => setMSku(e.target.value)} />
        </FormItem>
        <Div>
          <Button stretched onClick={submitModel}>Добавить модель</Button>
        </Div>
      </Group>
    </>
  )
}
