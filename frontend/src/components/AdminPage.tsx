import { useEffect, useState } from 'react'
import { Autocomplete } from './Autocomplete'
import { fetchCategories, fetchBrands, fetchModels, type Brand, type Category, type Model } from '../api/directory'
import { fetchSellers, setSellerStatus, addBrand, addModel, setModelImage, type AdminSeller } from '../api/admin'

const STATUS: Record<AdminSeller['status'], { text: string; cls: string }> = {
  pending: { text: 'на модерации', cls: 'text-2' },
  approved: { text: 'проверенный', cls: 'text-success' },
  blocked: { text: 'заблокирован', cls: 'text-danger' },
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
  const [mImage, setMImage] = useState('')
  const [dirMsg, setDirMsg] = useState('')
  const [resetKey, setResetKey] = useState(0)

  // Куратор фото: выбор модели + ссылка.
  const [photoModel, setPhotoModel] = useState<Model | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoMsg, setPhotoMsg] = useState('')
  const [photoKey, setPhotoKey] = useState(0)

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
      await addModel({ brandId: mBrand.id, categoryId: mCategory, name: mName, aliases: csv(mAliases), sku: mSku || undefined, imageUrl: mImage || undefined })
      setDirMsg(`Модель добавлена: ${mBrand.name} ${mName}`)
      setMName('')
      setMAliases('')
      setMSku('')
      setMImage('')
      setMBrand(null)
      setMCategory(0)
      setResetKey((k) => k + 1)
    } catch (e) {
      setDirMsg((e as Error).message)
    }
  }

  async function saveModelPhoto() {
    setPhotoMsg('')
    if (!photoModel) {
      setPhotoMsg('Выбери модель')
      return
    }
    try {
      await setModelImage(photoModel.id, photoUrl.trim())
      setPhotoMsg(`Фото сохранено: ${photoModel.brand.name} ${photoModel.name}`)
      setPhotoModel(null)
      setPhotoUrl('')
      setPhotoKey((k) => k + 1)
    } catch (e) {
      setPhotoMsg((e as Error).message)
    }
  }

  return (
    <div style={{ paddingTop: 20 }}>
      <h1 className="page-title">Админ</h1>
      {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 8 }}>{error}</div>}

      <div className="section-title">Продавцы ({sellers.length})</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
        {sellers.map((s) => {
          const st = STATUS[s.status]
          return (
            <div key={s.id} className="card">
              <div style={{ fontWeight: 700 }}>
                {s.nick} <span className="text-3" style={{ fontWeight: 400 }}>· vk {s.vkId} · позиций: {s._count.listings}</span>
              </div>
              <div className="text-2" style={{ fontSize: 13, margin: '2px 0 10px' }}>
                {s.contact}
                {s.city && ` · ${s.city}`} · <span className={st.cls} style={{ fontWeight: 600 }}>{st.text}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-outline btn-sm" disabled={s.status === 'approved'} onClick={() => changeStatus(s.id, 'approved')}>
                  Одобрить
                </button>
                <button className="btn btn-danger btn-sm" disabled={s.status === 'blocked'} onClick={() => changeStatus(s.id, 'blocked')}>
                  Заблокировать
                </button>
                {s.status !== 'pending' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => changeStatus(s.id, 'pending')}>
                    В ожидание
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="section-title">Справочник</div>
      {dirMsg && (
        <div className={dirMsg.includes('добавлен') ? 'text-success' : 'text-danger'} style={{ fontSize: 13, marginBottom: 8 }}>
          {dirMsg}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, maxWidth: 720 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Добавить бренд</div>
          <span className="label">Название</span>
          <input className="input" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="напр. Off-White" />
          <span className="label">Алиасы через запятую</span>
          <input className="input" value={brandAliases} onChange={(e) => setBrandAliases(e.target.value)} placeholder="офвайт, ow" />
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={submitBrand}>
            Добавить бренд
          </button>
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Добавить модель</div>
          <span className="label">Бренд</span>
          <Autocomplete<Brand>
            key={`b-${resetKey}`}
            placeholder="бренд модели"
            fetcher={fetchBrands}
            getKey={(b) => b.id}
            getLabel={(b) => b.name}
            onSelect={(b) => setMBrand(b)}
          />
          <span className="label">Категория</span>
          <select className="select" value={mCategory} onChange={(e) => setMCategory(Number(e.target.value))}>
            <option value={0}>категория…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? '— ' : ''}
                {c.name}
              </option>
            ))}
          </select>
          <span className="label">Название модели</span>
          <input className="input" value={mName} onChange={(e) => setMName(e.target.value)} />
          <span className="label">Алиасы через запятую</span>
          <input className="input" value={mAliases} onChange={(e) => setMAliases(e.target.value)} />
          <span className="label">Артикул (опц.)</span>
          <input className="input" value={mSku} onChange={(e) => setMSku(e.target.value)} />
          <span className="label">Фото модели (ссылка, опц.)</span>
          <input className="input" value={mImage} onChange={(e) => setMImage(e.target.value)} placeholder="https://…" />
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={submitModel}>
            Добавить модель
          </button>
        </div>
      </div>

      <div className="section-title">Фото моделей</div>
      <div className="hint" style={{ marginBottom: 8 }}>
        Каталожное фото подставляется во все объявления модели, где продавец не приложил своё.
      </div>
      {photoMsg && (
        <div className={photoMsg.includes('сохранено') ? 'text-success' : 'text-danger'} style={{ fontSize: 13, marginBottom: 8 }}>
          {photoMsg}
        </div>
      )}
      <div className="card" style={{ maxWidth: 460 }}>
        <span className="label" style={{ marginTop: 0 }}>Модель</span>
        <Autocomplete<Model>
          key={`ph-${photoKey}`}
          placeholder="начни вводить: samba, дж4…"
          fetcher={(q) => fetchModels(q)}
          getKey={(m) => m.id}
          getLabel={(m) => `${m.brand.name} ${m.name}`}
          renderItem={(m) => (
            <span>
              {m.brand.name} {m.name} <span className="text-3" style={{ fontSize: 12 }}>· {m.category.name}{m.imageUrl ? ' · есть фото' : ''}</span>
            </span>
          )}
          onSelect={(m) => {
            setPhotoModel(m)
            setPhotoUrl(m.imageUrl ?? '')
          }}
        />
        {photoModel && (
          <>
            <span className="label">Ссылка на фото (пусто — убрать)</span>
            <input className="input" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
            {photoUrl.trim() && (
              <img
                src={photoUrl.trim()}
                alt="превью"
                style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', marginTop: 8 }}
              />
            )}
            <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={saveModelPhoto}>
              Сохранить фото для «{photoModel.brand.name} {photoModel.name}»
            </button>
          </>
        )}
      </div>
    </div>
  )
}
