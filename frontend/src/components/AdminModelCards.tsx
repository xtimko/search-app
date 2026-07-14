import { useEffect, useState } from 'react'
import { fetchCategories, type Category } from '../api/directory'
import { fetchAdminModels, updateModel, deleteModel, type AdminModel } from '../api/admin'
import { PhotoPicker } from './PhotoPicker'

// Админ-раздел «Карточки моделей»: очередь на модерацию (pending сверху) +
// поиск и полная правка любой карточки (имя, артикул, категория, алиасы, фото).
export function AdminModelCards() {
  const [categories, setCategories] = useState<Category[]>([])
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [q, setQ] = useState('')
  const [models, setModels] = useState<AdminModel[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(0)
  const [draft, setDraft] = useState<{ name: string; sku: string; categoryId: number; aliases: string; imageUrl: string }>({ name: '', sku: '', categoryId: 0, aliases: '', imageUrl: '' })
  const [msg, setMsg] = useState('')

  function load() {
    setLoading(true)
    fetchAdminModels({ status: tab === 'pending' ? 'pending' : undefined, q: q.trim() || undefined })
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  function startEdit(m: AdminModel) {
    setEditId(m.id)
    setMsg('')
    setDraft({ name: m.name, sku: m.sku ?? '', categoryId: m.categoryId, aliases: m.aliases.join(', '), imageUrl: m.imageUrl ?? '' })
  }

  async function save(m: AdminModel, extra?: { status?: 'verified' | 'pending' }) {
    setMsg('')
    try {
      await updateModel(m.id, {
        name: draft.name,
        sku: draft.sku,
        categoryId: draft.categoryId,
        aliases: draft.aliases.split(',').map((x) => x.trim()).filter(Boolean),
        imageUrl: draft.imageUrl,
        ...extra,
      })
      setMsg(`Сохранено: ${m.brand.name} ${draft.name}`)
      setEditId(0)
      load()
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  async function verify(m: AdminModel) {
    try {
      await updateModel(m.id, { status: 'verified' })
      load()
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  async function remove(m: AdminModel) {
    if (!window.confirm(`Удалить карточку «${m.brand.name} ${m.name}»?`)) return
    try {
      await deleteModel(m.id)
      load()
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  return (
    <div>
      <div className="section-title">Карточки моделей</div>
      <div className="hint" style={{ marginBottom: 10 }}>
        Продавцы создают недостающие карточки — они приходят «на модерации». Проверь название, артикул, категорию и фото, затем подтверди.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button className={tab === 'pending' ? 'chip chip-active' : 'chip'} onClick={() => setTab('pending')}>На модерации</button>
        <button className={tab === 'all' ? 'chip chip-active' : 'chip'} onClick={() => setTab('all')}>Все / поиск</button>
        {tab === 'all' && (
          <input className="input" style={{ flex: 1, minWidth: 180, padding: '6px 10px', fontSize: 13 }} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="бренд, модель, артикул…" />
        )}
      </div>
      {msg && <div className={msg.includes('Сохранено') ? 'text-success' : 'text-danger'} style={{ fontSize: 13, marginBottom: 8 }}>{msg}</div>}

      {loading && <p className="text-3">загрузка…</p>}
      {!loading && models.length === 0 && (
        <p className="text-3">{tab === 'pending' ? 'очередь модерации пуста 👌' : 'ничего не найдено'}</p>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {models.map((m) => (
          <div key={m.id} className="card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--bg-elev)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.imageUrl ? <img src={m.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="text-3" style={{ fontWeight: 700 }}>{m.brand.name.slice(0, 1)}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {m.brand.name} {m.name}{' '}
                  {m.status === 'pending' && <span className="badge" style={{ color: 'var(--warn)', borderColor: 'var(--warn)' }}>на модерации</span>}
                </div>
                <div className="text-3" style={{ fontSize: 12 }}>
                  {m.category.name}{m.sku ? ` · арт. ${m.sku}` : ' · без артикула'} · объявлений: {m._count.listings}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {m.status === 'pending' && editId !== m.id && (
                  <button className="btn btn-primary btn-sm" onClick={() => verify(m)}>Подтвердить</button>
                )}
                <button className="btn btn-outline btn-sm" onClick={() => (editId === m.id ? setEditId(0) : startEdit(m))}>
                  {editId === m.id ? 'Скрыть' : 'Править'}
                </button>
              </div>
            </div>

            {editId === m.id && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) 1fr', gap: 18, alignItems: 'start' }}>
                  {/* слева — фото */}
                  <div>
                    <div style={{ aspectRatio: '1 / 1', borderRadius: 12, background: 'var(--bg-elev)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                      {draft.imageUrl ? (
                        <img src={draft.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span className="display text-3" style={{ fontSize: 40 }}>{m.brand.name.slice(0, 1)}</span>
                      )}
                    </div>
                    <PhotoPicker value={draft.imageUrl} onChange={(url) => setDraft({ ...draft, imageUrl: url })} />
                  </div>

                  {/* справа — данные */}
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div>
                      <span className="label" style={{ marginTop: 0 }}>Бренд</span>
                      <div className="input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-2)', background: 'var(--bg)' }}>{m.brand.name}</div>
                    </div>
                    <div>
                      <span className="label" style={{ marginTop: 0 }}>Название модели</span>
                      <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <span className="label" style={{ marginTop: 0 }}>Артикул (заводской)</span>
                        <input className="input" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder="adidas B75806" />
                      </div>
                      <div>
                        <span className="label" style={{ marginTop: 0 }}>Категория</span>
                        <select className="select" value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: Number(e.target.value) })}>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.parentId ? '— ' : ''}{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <span className="label" style={{ marginTop: 0 }}>Алиасы (через запятую)</span>
                      <input className="input" value={draft.aliases} onChange={(e) => setDraft({ ...draft, aliases: e.target.value })} placeholder="самба, samba og" />
                      <div className="hint">Народные написания и сокращения — по ним товар находят в поиске.</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {m.status === 'pending' ? (
                    <button className="btn btn-primary btn-sm" onClick={() => save(m, { status: 'verified' })}>Сохранить и подтвердить</button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => save(m)}>Сохранить</button>
                  )}
                  {m.status === 'pending' && <button className="btn btn-outline btn-sm" onClick={() => save(m)}>Сохранить (без подтверждения)</button>}
                  {m._count.listings === 0 && <button className="btn btn-danger btn-sm" onClick={() => remove(m)}>Удалить</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
