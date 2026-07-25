import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchChats,
  fetchMessages,
  sendMessage,
  sendOffer,
  acceptOffer,
  declineOffer,
  fetchDeals,
  confirmDeal,
  cancelDeal,
  reviewDeal,
  setDealGuarantor,
  fetchGuarantors,
  type Conversation,
  type ChatMessage,
  type ChatPeer,
  type DealFull,
  type Guarantor,
} from '../api/chats'
import { VerifiedBadge } from './VerifiedBadge'

function useIsDesktop(): boolean {
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900)
  useEffect(() => {
    const on = () => setD(window.innerWidth >= 900)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return d
}

function peerOf(c: Conversation, meId: number): ChatPeer {
  return c.buyerId === meId ? c.seller : c.buyer
}

// Контакт гаранта → кликабельная ссылка (ВК/Telegram/телефон/URL).
function guarLink(contact: string): string {
  const c = contact.trim()
  if (/^https?:\/\//i.test(c)) return c
  if (c.startsWith('@')) return `https://t.me/${c.slice(1)}`
  if (/^\+?\d[\d\s()-]{6,}$/.test(c)) return `tel:${c.replace(/[\s()-]/g, '')}`
  if (/(vk\.com|t\.me)\//i.test(c)) return `https://${c.replace(/^\/+/, '')}`
  return c
}

function sizeOf(l: { sizeUs: string | null; sizeEu: string | null; size: string | null }): string {
  return l.sizeUs || l.sizeEu ? [l.sizeUs && `US ${l.sizeUs}`, l.sizeEu && `EU ${l.sizeEu}`].filter(Boolean).join('/') : l.size || ''
}

function listingLabel(c: Conversation): string {
  const l = c.listing
  const size = sizeOf(l)
  return `${l.model.brand.name} ${l.model.name}${size ? ` · ${size}` : ''} · ${l.price.toLocaleString('ru-RU')} ₽`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const OFFER_STATUS_LABEL: Record<string, string> = {
  active: 'ожидает ответа',
  accepted: '✓ принято — сделка открыта',
  declined: 'отклонено',
  superseded: 'неактуально',
}

function Avatar({ p, size = 36 }: { p: ChatPeer; size?: number }) {
  return p.photo ? (
    <img src={p.photo} alt="" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--bg-elev)',
        color: 'var(--text-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size / 2.6,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {(p.vkName || p.nick).slice(0, 1).toUpperCase()}
    </div>
  )
}

// Сделки: список карточек (открытые сверху) с подтверждением/отменой.
function DealsView({ meId, onOpenChat }: { meId: number; onOpenChat: (chatId: number) => void }) {
  const [deals, setDeals] = useState<DealFull[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(0)
  const [reviewingId, setReviewingId] = useState(0)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')

  function load() {
    fetchDeals()
      .then(setDeals)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 12000)
    return () => clearInterval(t)
  }, [])

  async function act(id: number, fn: () => Promise<unknown>) {
    setBusy(id)
    try {
      await fn()
      load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(0)
    }
  }

  const open = deals.filter((d) => d.status === 'open')
  const closed = deals.filter((d) => d.status !== 'open')

  function card(d: DealFull) {
    const iAmBuyer = d.buyerId === meId
    const peer = iAmBuyer ? d.seller : d.buyer
    const myConfirmed = iAmBuyer ? d.buyerConfirmed : d.sellerConfirmed
    const size = sizeOf(d.listing)
    return (
      <div key={d.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {d.listing.model.brand.name} {d.listing.model.name}
            {size && <span className="text-2" style={{ fontWeight: 400 }}> · {size}</span>}
          </div>
          <span
            className={d.status === 'open' ? 'text-accent' : d.status === 'completed' ? 'text-success' : 'text-3'}
            style={{ fontSize: 12, fontWeight: 700 }}
          >
            {d.status === 'open' ? 'открыта' : d.status === 'completed' ? 'завершена' : 'отменена'}
          </span>
        </div>
        <div className="text-2" style={{ fontSize: 13 }}>
          {iAmBuyer ? 'покупаю у' : 'продаю'} {peer.vkName || peer.nick} ·{' '}
          <b className="text-accent">{d.price.toLocaleString('ru-RU')} ₽</b> · {fmtTime(d.createdAt)}
          {d.guarantorRef ? <span className="text-3"> · гарант: {d.guarantorRef.name} ✓</span> : d.guarantor ? <span className="text-3"> · гарант: {d.guarantor}</span> : null}
        </div>
        {d.status === 'completed' && iAmBuyer && (
          d.review ? (
            <div className="text-accent" style={{ fontSize: 13 }}>ваш отзыв: {'★'.repeat(d.review.rating)}{'☆'.repeat(5 - d.review.rating)}</div>
          ) : reviewingId === d.id ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    onClick={() => setRating(n)}
                    style={{ fontSize: 30, lineHeight: 1, cursor: 'pointer', color: n <= rating ? 'var(--accent)' : 'var(--text-3)', userSelect: 'none' }}
                  >
                    {n <= rating ? '★' : '☆'}
                  </span>
                ))}
              </div>
              <input className="input" value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="пара слов о сделке (необязательно)" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy === d.id}
                  onClick={() => act(d.id, async () => { await reviewDeal(d.id, rating, reviewText); setReviewingId(0); setReviewText('') })}
                >
                  Отправить отзыв
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setReviewingId(0)}>Отмена</button>
              </div>
            </div>
          ) : (
            <div>
              <button className="btn btn-outline btn-sm" onClick={() => { setReviewingId(d.id); setRating(5); setReviewText('') }}>
                Оставить отзыв
              </button>
            </div>
          )
        )}
        {d.status === 'open' && (
          <>
            <div className="text-3" style={{ fontSize: 12 }}>
              подтверждения: покупатель {d.buyerConfirmed ? '✓' : '—'} · продавец {d.sellerConfirmed ? '✓' : '—'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!myConfirmed && (
                <button className="btn btn-primary btn-sm" disabled={busy === d.id} onClick={() => act(d.id, () => confirmDeal(d.id))}>
                  Подтвердить сделку
                </button>
              )}
              {myConfirmed && <span className="text-success" style={{ fontSize: 13, alignSelf: 'center' }}>вы подтвердили — ждём вторую сторону</span>}
              <button className="btn btn-danger btn-sm" disabled={busy === d.id} onClick={() => act(d.id, () => cancelDeal(d.id))}>
                Отменить
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => onOpenChat(d.conversationId)}>
                В чат
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 10, paddingTop: 4 }}>
      {loaded && deals.length === 0 && (
        <div className="text-3" style={{ fontSize: 13, padding: 16 }}>
          Сделок пока нет. Отправь предложение цены в чате — принятый оффер станет сделкой.
        </div>
      )}
      {open.length > 0 && <div className="text-2" style={{ fontSize: 12, fontWeight: 700 }}>ОТКРЫТЫЕ ({open.length})</div>}
      {open.map(card)}
      {closed.length > 0 && <div className="text-3" style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>ЗАКРЫТЫЕ ({closed.length})</div>}
      {closed.map(card)}
    </div>
  )
}

// Чаты: под-вкладки «Диалоги / Сделки»; в диалоге — текст и офферы, плашка открытой сделки.
export function ChatsPage({ meId, initialChatId }: { meId: number; initialChatId?: number }) {
  const isDesktop = useIsDesktop()
  const [view, setView] = useState<'chats' | 'deals'>('chats')
  const [convs, setConvs] = useState<Conversation[]>([])
  const [loaded, setLoaded] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(initialChatId ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [offerMode, setOfferMode] = useState(false)
  const [offerPrice, setOfferPrice] = useState('')
  const [sending, setSending] = useState(false)
  const [guarPick, setGuarPick] = useState(false) // открыт выбор гаранта
  const [guarName, setGuarName] = useState('') // «свой» гарант
  const [guarantors, setGuarantors] = useState<Guarantor[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickBottom = useRef(true)

  async function loadConvs() {
    try {
      setConvs(await fetchChats())
    } catch {
      /* следующий тик */
    } finally {
      setLoaded(true)
    }
  }

  async function loadMessages(id: number) {
    try {
      setMessages(await fetchMessages(id))
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadConvs()
    const t = setInterval(loadConvs, 10000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (activeId == null) return
    setMessages([])
    stickBottom.current = true
    loadMessages(activeId)
    const t = setInterval(() => loadMessages(activeId), 4000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  useEffect(() => {
    const el = scrollRef.current
    if (el && stickBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const active = useMemo(() => convs.find((c) => c.id === activeId) ?? null, [convs, activeId])
  const openDeal = active?.deals?.[0] ?? null

  // Список проверенных гарантов — один раз (для выбора в сделке).
  useEffect(() => {
    fetchGuarantors().then(setGuarantors).catch(() => {})
  }, [])

  async function submit() {
    if (activeId == null || sending) return
    if (offerMode) {
      const p = Number(offerPrice)
      if (!p || p <= 0) return
      setSending(true)
      try {
        const msg = await sendOffer(activeId, p)
        setOfferPrice('')
        setOfferMode(false)
        stickBottom.current = true
        setMessages((prev) => [...prev, msg])
        loadConvs()
      } catch (e) {
        alert((e as Error).message)
      } finally {
        setSending(false)
      }
      return
    }
    const t = text.trim()
    if (!t) return
    setSending(true)
    try {
      const msg = await sendMessage(activeId, t)
      setText('')
      stickBottom.current = true
      setMessages((prev) => [...prev, msg])
      loadConvs()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  async function offerAction(msgId: number, action: 'accept' | 'decline') {
    if (activeId == null) return
    try {
      if (action === 'accept') await acceptOffer(activeId, msgId)
      else await declineOffer(activeId, msgId)
      await Promise.all([loadMessages(activeId), loadConvs()])
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function dealAction(fn: () => Promise<unknown>) {
    try {
      await fn()
      await Promise.all([activeId != null ? loadMessages(activeId) : Promise.resolve(), loadConvs()])
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const showList = isDesktop || activeId == null
  const showChat = isDesktop || activeId != null

  const list = (
    <div style={{ borderRight: isDesktop ? '1px solid var(--border)' : 'none', overflowY: 'auto' }}>
      {loaded && convs.length === 0 && (
        <div className="text-3" style={{ padding: 20, fontSize: 13 }}>
          Диалогов пока нет. Найди товар в поиске и нажми «Написать продавцу».
        </div>
      )}
      {convs.map((c) => {
        const p = peerOf(c, meId)
        const last = c.messages[0]
        const unread = c._count.messages
        return (
          <div
            key={c.id}
            onClick={() => setActiveId(c.id)}
            style={{
              display: 'flex',
              gap: 10,
              padding: '10px 12px',
              cursor: 'pointer',
              background: c.id === activeId ? 'var(--bg-elev)' : 'transparent',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <Avatar p={p} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.vkName || p.nick}
                  {c.deals?.length > 0 && <span className="text-accent"> · сделка</span>}
                </span>
                {last && <span className="text-3" style={{ fontSize: 11, flexShrink: 0 }}>{fmtTime(last.createdAt)}</span>}
              </div>
              <div className="text-3" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {listingLabel(c)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span className="text-2" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {last ? `${last.senderId === meId ? 'Вы: ' : ''}${last.text}` : 'нет сообщений'}
                </span>
                {unread > 0 && (
                  <span style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>
                    {unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  const chat = active ? (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isDesktop && (
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveId(null)}>
              Назад
            </button>
          )}
          <Avatar p={peerOf(active, meId)} size={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 14 }}>
              {peerOf(active, meId).vkName || peerOf(active, meId).nick}
              {peerOf(active, meId).verified && <VerifiedBadge size={14} />}
            </div>
            <div className="text-3" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {listingLabel(active)}
              {!active.listing.inStock && <span className="text-danger"> · продано</span>}
            </div>
          </div>
        </div>
        {openDeal && (() => {
          const iConfirmed = (openDeal.buyerId === meId && openDeal.buyerConfirmed) || (openDeal.sellerId === meId && openDeal.sellerConfirmed)
          const hasGuar = !!(openDeal.guarantorRef || openDeal.guarantor)
          // Шаги безопасной сделки — где мы сейчас.
          const step = iConfirmed ? 3 : hasGuar ? 2 : 1
          const setGuar = (payload: { guarantorId?: number | null; name?: string }) =>
            dealAction(async () => { await setDealGuarantor(openDeal.id, payload); setGuarPick(false); setGuarName('') })
          return (
          <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--accent)', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13 }}>
                Сделка открыта · <b className="text-accent">{openDeal.price.toLocaleString('ru-RU')} ₽</b>
                <span className="text-3"> · покупатель {openDeal.buyerConfirmed ? '✓' : '—'} · продавец {openDeal.sellerConfirmed ? '✓' : '—'}</span>
              </span>
              <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                {!iConfirmed && (
                  <button className="btn btn-primary btn-sm" onClick={() => dealAction(() => confirmDeal(openDeal.id))}>
                    Подтвердить получение
                  </button>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => dealAction(() => cancelDeal(openDeal.id))}>Отменить</button>
              </span>
            </div>

            {/* Шаги безопасной сделки */}
            <div className="text-3" style={{ fontSize: 11 }}>
              Безопасная сделка: <b className={step >= 1 ? 'text-2' : ''}>1. цена ✓</b> ·{' '}
              <b className={step >= 2 ? 'text-2' : ''}>2. гарант</b> ·{' '}
              <b className={step >= 2 ? 'text-2' : ''}>3. оплата гаранту</b> ·{' '}
              <b className={step >= 3 ? 'text-2' : ''}>4. оба подтверждают</b>
            </div>

            {/* Текущий гарант */}
            {openDeal.guarantorRef ? (
              <div className="text-2" style={{ fontSize: 12.5, background: 'var(--bg-elev)', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <VerifiedBadge size={14} /> Гарант: <b>{openDeal.guarantorRef.name}</b> · проверен площадкой
                </span>
                <div style={{ marginTop: 3 }}>
                  Связь: <a href={guarLink(openDeal.guarantorRef.contact)} target="_blank" rel="noopener noreferrer">{openDeal.guarantorRef.contact}</a>
                  {openDeal.guarantorRef.note && <span className="text-3"> · {openDeal.guarantorRef.note}</span>}
                </div>
                <div className="text-3" style={{ marginTop: 3 }}>Оплата гаранту → он переводит продавцу после подтверждения получения. <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px', minHeight: 0 }} onClick={() => setGuar({})}>убрать</button></div>
              </div>
            ) : openDeal.guarantor ? (
              <div className="text-2" style={{ fontSize: 12.5, background: 'var(--bg-elev)', borderRadius: 8, padding: '8px 10px' }}>
                Гарант (свой): <b>{openDeal.guarantor}</b> <span style={{ color: 'var(--warn)' }}>· не проверен площадкой</span>
                <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px', minHeight: 0, marginLeft: 6 }} onClick={() => setGuar({})}>убрать</button>
              </div>
            ) : guarPick ? (
              <div style={{ background: 'var(--bg-elev)', borderRadius: 8, padding: '10px', display: 'grid', gap: 8 }}>
                <div className="text-3" style={{ fontSize: 12 }}>Гарант — посредник: принимает оплату и переводит продавцу после того, как покупатель подтвердит получение. Защищает обе стороны.</div>
                {guarantors.length > 0 ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div className="text-3" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Проверенные площадкой</div>
                    {guarantors.map((g) => (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600 }}>{g.name}</span>
                          <span className="text-3"> · {g.contact}{g.note ? ` · ${g.note}` : ''}</span>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => setGuar({ guarantorId: g.id })}>Выбрать</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-3" style={{ fontSize: 12 }}>Проверенных гарантов пока нет в списке — можно указать своего по договорённости.</div>
                )}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    className="input"
                    style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                    value={guarName}
                    onChange={(e) => setGuarName(e.target.value)}
                    placeholder="свой гарант: имя / ссылка"
                  />
                  <button className="btn btn-outline btn-sm" disabled={!guarName.trim()} onClick={() => setGuar({ name: guarName.trim() })}>Указать</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setGuarPick(false)}>Закрыть</button>
                </div>
              </div>
            ) : (
              <div>
                <button className="btn btn-outline btn-sm" title="посредник: принимает оплату и переводит продавцу после получения товара" onClick={() => setGuarPick(true)}>
                  🛡 Провести через гаранта
                </button>
              </div>
            )}
          </div>
          )
        })()}
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
        }}
        style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {messages.map((m) => {
          const mine = m.senderId === meId
          if (m.kind === 'system') {
            return (
              <div key={m.id} className="text-3" style={{ textAlign: 'center', fontSize: 12, padding: '4px 0' }}>
                {m.text} · {fmtTime(m.createdAt)}
              </div>
            )
          }
          if (m.kind === 'offer') {
            const canAct = !mine && m.offerStatus === 'active'
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: `1px solid ${m.offerStatus === 'active' ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: 'var(--bg-elev)',
                  }}
                >
                  <div style={{ fontSize: 12 }} className="text-2">
                    {mine ? 'Ваше предложение' : 'Предложение цены'}
                  </div>
                  <div className="text-accent" style={{ fontSize: 18, fontWeight: 800 }}>
                    {m.offerPrice?.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-3" style={{ fontSize: 11 }}>
                    {OFFER_STATUS_LABEL[m.offerStatus ?? 'active']} · {fmtTime(m.createdAt)}
                  </div>
                  {canAct && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => offerAction(m.id, 'accept')}>
                        Принять
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => offerAction(m.id, 'decline')}>
                        Отклонить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          }
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '75%',
                  padding: '7px 11px',
                  borderRadius: 12,
                  fontSize: 14,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: mine ? 'var(--accent)' : 'var(--bg-elev)',
                  color: mine ? 'var(--on-accent)' : 'var(--text)',
                }}
              >
                {m.text}
                <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 8 }}>{fmtTime(m.createdAt)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
        <button
          className={offerMode ? 'btn btn-primary' : 'btn btn-outline'}
          title="предложить цену"
          onClick={() => setOfferMode((v) => !v)}
        >
          ₽
        </button>
        {offerMode ? (
          <input
            className="input"
            style={{ flex: 1 }}
            type="number"
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="ваша цена, ₽"
            autoFocus
          />
        ) : (
          <input
            className="input"
            style={{ flex: 1 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Сообщение…"
          />
        )}
        <button className="btn btn-primary" disabled={sending || (offerMode ? !offerPrice : !text.trim())} onClick={submit}>
          {offerMode ? 'Предложить' : 'Отправить'}
        </button>
      </div>
    </div>
  ) : (
    <div className="text-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
      выбери диалог слева
    </div>
  )

  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button className={view === 'chats' ? 'chip chip-active' : 'chip'} onClick={() => setView('chats')}>
          Диалоги
        </button>
        <button className={view === 'deals' ? 'chip chip-active' : 'chip'} onClick={() => setView('deals')}>
          Сделки
        </button>
      </div>

      {view === 'deals' ? (
        <DealsView
          meId={meId}
          onOpenChat={(chatId) => {
            setView('chats')
            setActiveId(chatId)
          }}
        />
      ) : (
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: isDesktop ? '320px 1fr' : '1fr',
            height: 'calc(100vh - 210px)',
            minHeight: 380,
          }}
        >
          {showList && list}
          {showChat && chat}
        </div>
      )}
    </div>
  )
}
