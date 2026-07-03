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
  type Conversation,
  type ChatMessage,
  type ChatPeer,
  type DealFull,
} from '../api/chats'

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
        </div>
        {d.status === 'completed' && iAmBuyer && (
          d.review ? (
            <div className="text-accent" style={{ fontSize: 13 }}>ваш отзыв: {'★'.repeat(d.review.rating)}{'☆'.repeat(5 - d.review.rating)}</div>
          ) : reviewingId === d.id ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className="btn btn-sm"
                    style={{ padding: '4px 10px', color: n <= rating ? 'var(--accent)' : 'var(--text-3)', background: 'var(--bg-elev)' }}
                    onClick={() => setRating(n)}
                  >
                    ★{n}
                  </button>
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
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {peerOf(active, meId).vkName || peerOf(active, meId).nick}
              {peerOf(active, meId).status === 'approved' && <span className="text-success"> ✓</span>}
            </div>
            <div className="text-3" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {listingLabel(active)}
              {!active.listing.inStock && <span className="text-danger"> · продано</span>}
            </div>
          </div>
        </div>
        {openDeal && (
          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 13 }}>
              Сделка открыта · <b className="text-accent">{openDeal.price.toLocaleString('ru-RU')} ₽</b>
              <span className="text-3"> · покупатель {openDeal.buyerConfirmed ? '✓' : '—'} · продавец {openDeal.sellerConfirmed ? '✓' : '—'}</span>
            </span>
            <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {!((openDeal.buyerId === meId && openDeal.buyerConfirmed) || (openDeal.sellerId === meId && openDeal.sellerConfirmed)) && (
                <button className="btn btn-primary btn-sm" onClick={() => dealAction(() => confirmDeal(openDeal.id))}>
                  Подтвердить
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => dealAction(() => cancelDeal(openDeal.id))}>
                Отменить
              </button>
            </span>
          </div>
        )}
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
