import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchChats, fetchMessages, sendMessage, type Conversation, type ChatMessage, type ChatPeer } from '../api/chats'

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

function listingLabel(c: Conversation): string {
  const l = c.listing
  const size = l.sizeUs || l.sizeEu ? [l.sizeUs && `US ${l.sizeUs}`, l.sizeEu && `EU ${l.sizeEu}`].filter(Boolean).join('/') : l.size
  return `${l.model.brand.name} ${l.model.name}${size ? ` · ${size}` : ''} · ${l.price.toLocaleString('ru-RU')} ₽`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
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

// Чаты: слева список диалогов, справа окно (на мобиле — по очереди). Обновление поллингом.
export function ChatsPage({ meId, initialChatId }: { meId: number; initialChatId?: number }) {
  const isDesktop = useIsDesktop()
  const [convs, setConvs] = useState<Conversation[]>([])
  const [loaded, setLoaded] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(initialChatId ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickBottom = useRef(true)

  async function loadConvs() {
    try {
      setConvs(await fetchChats())
    } catch {
      /* не в сети — попробуем в следующий тик */
    } finally {
      setLoaded(true)
    }
  }

  async function loadMessages(id: number) {
    try {
      const ms = await fetchMessages(id)
      setMessages(ms)
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

  async function submit() {
    const t = text.trim()
    if (!t || activeId == null || sending) return
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        {!isDesktop && (
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveId(null)}>
            ←
          </button>
        )}
        <Avatar p={peerOf(active, meId)} size={32} />
        <div style={{ minWidth: 0 }}>
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
        <input
          className="input"
          style={{ flex: 1 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Сообщение…"
        />
        <button className="btn btn-primary" disabled={sending || !text.trim()} onClick={submit}>
          Отправить
        </button>
      </div>
    </div>
  ) : (
    <div className="text-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
      выбери диалог слева
    </div>
  )

  return (
    <div
      className="card"
      style={{
        marginTop: 20,
        padding: 0,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: isDesktop ? '320px 1fr' : '1fr',
        height: 'calc(100vh - 170px)',
        minHeight: 380,
      }}
    >
      {showList && list}
      {showChat && chat}
    </div>
  )
}
