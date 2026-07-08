import { useEffect, useState } from 'react'
import { Autocomplete } from './Autocomplete'
import { fetchBrands, fetchModels, type Brand, type Model } from '../api/directory'
import {
  createRequest,
  fetchRequests,
  fetchMyMatches,
  respondToRequest,
  closeRequest,
  matchSize,
  type BuyRequest,
  type RequestMatch,
} from '../api/requests'

function fmtAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  if (mins < 1440) return `${Math.round(mins / 60)} ч назад`
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function requestTitle(r: BuyRequest): string {
  return `${r.model.brand.name} ${r.model.name}${r.size ? ` · ${r.size}` : ''}`
}

// Выбор своей позиции для отклика на запрос.
function RespondPicker({ request, onDone, onCancel }: { request: BuyRequest; onDone: (chatId: number) => void; onCancel: () => void }) {
  const [exact, setExact] = useState<RequestMatch[]>([])
  const [rest, setRest] = useState<RequestMatch[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMyMatches(request.id)
      .then((r) => {
        setExact(r.exact)
        setRest(r.rest)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoaded(true))
  }, [request.id])

  async function send(listingId: number) {
    setBusy(true)
    setError('')
    try {
      const r = await respondToRequest(request.id, listingId)
      onDone(r.conversationId)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const row = (m: RequestMatch, tag?: string) => (
    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', borderTop: '1px solid var(--border)', padding: '7px 0' }}>
      <span style={{ fontSize: 13 }}>
        {matchSize(m)} {m.colorway && <span className="text-3">· {m.colorway}</span>}{' '}
        <b className="text-accent">{m.price.toLocaleString('ru-RU')} ₽</b>
        {tag && <span className="badge" style={{ marginLeft: 6 }}>{tag}</span>}
      </span>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => send(m.id)}>
        Предложить
      </button>
    </div>
  )

  return (
    <div style={{ marginTop: 10, background: 'var(--bg-elev)', borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Выбери позицию из своего стока</span>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Отмена</button>
      </div>
      {!loaded && <div className="text-3" style={{ fontSize: 13 }}>смотрим твой сток…</div>}
      {loaded && exact.length === 0 && rest.length === 0 && (
        <div className="text-3" style={{ fontSize: 13, padding: '6px 0' }}>
          У тебя нет позиций этой модели в наличии. Добавь в «Мой сток» и вернись.
        </div>
      )}
      {exact.map((m) => row(m, 'точный размер'))}
      {rest.map((m) => row(m))}
      {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 6 }}>{error}</div>}
    </div>
  )
}

// Доска запросов «Ищу»: форма + лента. onOpenChat — переход в чат после отклика.
export function RequestsPage({ meId, onOpenChat, onNeedAuth }: { meId: number | null; onOpenChat: (chatId: number) => void; onNeedAuth: () => void }) {
  const [requests, setRequests] = useState<BuyRequest[]>([])
  const [loaded, setLoaded] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [respondingId, setRespondingId] = useState(0)

  // Форма нового запроса.
  const [brand, setBrand] = useState<Brand | null>(null)
  const [model, setModel] = useState<Model | null>(null)
  const [size, setSize] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [city, setCity] = useState('Москва')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<BuyRequest | null>(null)
  const [resetKey, setResetKey] = useState(0)

  function load() {
    fetchRequests(mineOnly)
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineOnly])

  async function submit() {
    if (!meId) {
      onNeedAuth()
      return
    }
    setError('')
    if (!model) {
      setError('Выбери модель из справочника')
      return
    }
    setBusy(true)
    try {
      const r = await createRequest({
        modelId: model.id,
        size: size.trim() || undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        city: city.trim() || undefined,
        comment: comment.trim() || undefined,
      })
      setCreated(r)
      setModel(null)
      setBrand(null)
      setSize('')
      setMaxPrice('')
      setComment('')
      setResetKey((k) => k + 1)
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title">Запросы «Ищу»</h1>
          <div className="text-3" style={{ fontSize: 13, marginTop: 2 }}>
            покупатели ищут — продавцы предлагают цену
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {meId && (
            <button className={mineOnly ? 'chip chip-active' : 'chip'} onClick={() => setMineOnly((v) => !v)}>
              Мои
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => (meId ? setShowForm((v) => !v) : onNeedAuth())}>
            {showForm ? 'Скрыть форму' : '+ Оставить запрос'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginTop: 14, maxWidth: 560 }}>
          <span className="label" style={{ marginTop: 0 }}>Бренд (для сужения списка)</span>
          <Autocomplete<Brand>
            key={`b-${resetKey}`}
            placeholder="nb, джордан, бетон…"
            fetcher={fetchBrands}
            getKey={(b) => b.id}
            getLabel={(b) => b.name}
            onSelect={(b) => {
              setBrand(b)
              setModel(null)
            }}
          />
          <span className="label">Что ищешь? *</span>
          <Autocomplete<Model>
            key={`m-${resetKey}`}
            placeholder="дж4, 2002r, birkin…"
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            <div>
              <span className="label">Размер</span>
              <input className="input" value={size} onChange={(e) => setSize(e.target.value)} placeholder="9.5 или M" />
            </div>
            <div>
              <span className="label">Бюджет до, ₽</span>
              <input className="input" type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="20000" />
            </div>
            <div>
              <span className="label">Город</span>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <span className="label">Комментарий</span>
          <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="расцветка, состояние, примерка…" />
          {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 8 }}>{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 14 }} disabled={busy} onClick={submit}>
            {busy ? 'Публикуем…' : 'Опубликовать запрос'}
          </button>
        </div>
      )}

      {created && (
        <div className="card" style={{ marginTop: 12, borderColor: 'var(--accent)' }}>
          <div style={{ fontWeight: 700 }}>Запрос опубликован: {requestTitle(created)}</div>
          {created.matches && created.matches.length > 0 ? (
            <>
              <div className="text-2" style={{ fontSize: 13, margin: '6px 0' }}>Уже есть в стоке прямо сейчас:</div>
              {created.matches.map((m) => (
                <div key={m.id} className="text-2" style={{ fontSize: 13, borderTop: '1px solid var(--border)', padding: '5px 0' }}>
                  {matchSize(m)} {m.colorway && `· ${m.colorway} `}· <b className="text-accent">{m.price.toLocaleString('ru-RU')} ₽</b>
                  {m.seller && ` · ${m.seller.vkName || m.seller.nick}`}
                </div>
              ))}
              <div className="hint">Найди эти позиции в «Поиске» и напиши продавцу — или жди офферов в «Чатах».</div>
            </>
          ) : (
            <div className="text-2" style={{ fontSize: 13, marginTop: 6 }}>
              Пока точных совпадений в стоке нет — продавцы увидят запрос и предложат цену в «Чатах».
            </div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setCreated(null)}>
            Скрыть
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {loaded && requests.length === 0 && (
          <div className="text-3" style={{ fontSize: 13 }}>
            {mineOnly ? 'у тебя пока нет запросов' : 'активных запросов пока нет — оставь первый'}
          </div>
        )}
        {requests.map((r) => {
          const mine = meId != null && r.buyerId === meId
          return (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    Ищу {requestTitle(r)}
                    {mine && <span className="badge badge-accent" style={{ marginLeft: 8 }}>ваш</span>}
                    {r.status === 'closed' && <span className="badge" style={{ marginLeft: 8 }}>закрыт</span>}
                  </div>
                  <div className="text-2" style={{ fontSize: 13, marginTop: 2 }}>
                    {r.maxPrice && `до ${r.maxPrice.toLocaleString('ru-RU')} ₽ · `}
                    {r.city && `${r.city} · `}
                    {r.buyer.vkName || r.buyer.nick} · {fmtAgo(r.createdAt)} · откликов: {r._count.responses}
                  </div>
                  {r.comment && <div className="text-3" style={{ fontSize: 13, marginTop: 4 }}>{r.comment}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
                  {mine && r.status === 'active' && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => closeRequest(r.id).then(load).catch((e) => alert((e as Error).message))}
                    >
                      Закрыть
                    </button>
                  )}
                  {!mine && r.status === 'active' && (
                    <div style={{ textAlign: 'right' }}>
                      <button
                        className={r.myMatchCount ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                        onClick={() => (meId ? setRespondingId(respondingId === r.id ? 0 : r.id) : onNeedAuth())}
                      >
                        Предложить
                      </button>
                      {!!r.myMatchCount && (
                        <div className="text-accent" style={{ fontSize: 11, marginTop: 4, fontWeight: 700 }}>
                          у тебя подходящих: {r.myMatchCount}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {respondingId === r.id && (
                <RespondPicker
                  request={r}
                  onCancel={() => setRespondingId(0)}
                  onDone={(chatId) => {
                    setRespondingId(0)
                    load()
                    onOpenChat(chatId)
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
