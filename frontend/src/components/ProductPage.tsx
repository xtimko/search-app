import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProduct, fetchCatalogBatch, offerSize, retailDiscount, type ProductData, type Offer, type CatalogItem } from '../api/catalog'
import { getRecentIds, pushRecentId } from '../recent'
import { SellerModal } from './SellerModal'
import { CardRow } from './CardRow'
import { HeartButton } from './ProductCard'

// Кликабельное звено хлебных крошек.
function Crumb({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="text-3"
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0, transition: 'color 0.15s', flexShrink: 0 }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = '')}
    >
      {children}
    </button>
  )
}

const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many

// График цен по завершённым сделкам — лёгкий SVG без библиотек.
// Оси: слева min/mid/max цены, снизу первая и последняя даты. Наведение в
// любом месте графика подсвечивает БЛИЖАЙШУЮ точку: направляющая + плашка
// с суммой и датой продажи (работает и пальцем — pointer events).
// При min=max линия рисуется по центру.
function PriceChart({ sales }: { sales: { price: number; at: string }[] }) {
  const W = 640, H = 220, PL = 56, PR = 14, PT = 14, PB = 28
  const [hover, setHover] = useState<number | null>(null)
  const prices = sales.map((s) => s.price)
  const min = Math.min(...prices), max = Math.max(...prices)
  const pad = (max - min || max * 0.1 || 1) * 0.1
  const lo = min - pad, hi = max + pad
  const times = sales.map((s) => +new Date(s.at))
  const t0 = times[0], tSpan = times[times.length - 1] - t0 || 1
  const x = (t: number) => PL + ((t - t0) / tSpan) * (W - PL - PR)
  const y = (p: number) => PT + (1 - (p - lo) / (hi - lo)) * (H - PT - PB)
  const pts = sales.map((s, i) => ({ cx: x(times[i]), cy: y(s.price), s }))
  const line = pts.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
  const rub = (n: number) => n.toLocaleString('ru-RU')
  const dat = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  const levels = min === max ? [min] : [min, Math.round((min + max) / 2), max]

  // Ближайшая по горизонтали точка к курсору/пальцу (в координатах viewBox).
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const xv = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].cx - xv) < Math.abs(pts[best].cx - xv)) best = i
    setHover(best)
  }

  const hp = hover != null ? pts[hover] : null
  const tipLabel = hp ? `${rub(hp.s.price)} ₽ · ${dat(+new Date(hp.s.at))}` : ''
  const tipW = tipLabel.length * 6.8 + 20
  // Плашка над точкой; у верхнего края — под точкой; по горизонтали не вылезает.
  const tipX = hp ? Math.min(Math.max(hp.cx, PL + tipW / 2), W - PR - tipW / 2) : 0
  const tipY = hp ? (hp.cy - 34 < 4 ? hp.cy + 12 : hp.cy - 34) : 0

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair', touchAction: 'pan-y' }}
      role="img"
      aria-label="График цен продаж"
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {levels.map((p) => (
        <g key={p}>
          <line x1={PL} y1={y(p)} x2={W - PR} y2={y(p)} stroke="var(--border)" strokeDasharray="3 5" strokeWidth="1" />
          <text x={PL - 8} y={y(p) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--text-3)" className="tnum">{rub(p)}</text>
        </g>
      ))}
      <polygon points={`${PL},${H - PB} ${line} ${pts[pts.length - 1].cx.toFixed(1)},${H - PB}`} fill="var(--text)" opacity="0.05" />
      <polyline points={line} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r="3.5" fill={i === pts.length - 1 ? 'var(--text)' : 'var(--bg)'} stroke="var(--text)" strokeWidth="1.6" />
      ))}
      <text x={PL} y={H - 8} fontSize="10.5" fill="var(--text-3)">{dat(times[0])}</text>
      {tSpan > 1 && (
        <text x={W - PR} y={H - 8} textAnchor="end" fontSize="10.5" fill="var(--text-3)">{dat(times[times.length - 1])}</text>
      )}

      {hp && (
        <g pointerEvents="none">
          <line x1={hp.cx} y1={PT} x2={hp.cx} y2={H - PB} stroke="var(--text-3)" strokeDasharray="2 4" strokeWidth="1" />
          <circle cx={hp.cx} cy={hp.cy} r="5.5" fill="var(--text)" stroke="var(--bg-card)" strokeWidth="2" />
          <rect x={tipX - tipW / 2} y={tipY} width={tipW} height={24} rx="8" fill="var(--bg-elev)" stroke="var(--border-strong)" />
          <text x={tipX} y={tipY + 16} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)" className="tnum">{tipLabel}</text>
        </g>
      )}
    </svg>
  )
}

// Страница товара (как StockX): фото + сводка, размеры с мин. ценой, офферы.
export function ProductPage({
  modelId,
  onBack,
  onContact,
  onLeaveRequest,
}: {
  modelId: number
  onBack: () => void
  onContact: (listingId: number, fallbackContact: string) => void
  onLeaveRequest: () => void
}) {
  const navigate = useNavigate()
  const [data, setData] = useState<ProductData | null>(null)
  const [error, setError] = useState('')
  const [size, setSize] = useState<string | null>(null)
  const [sellerId, setSellerId] = useState(0)
  const [imgOk, setImgOk] = useState(true)
  const [recent, setRecent] = useState<CatalogItem[]>([])

  useEffect(() => {
    setData(null)
    setSize(null)
    setImgOk(true)
    window.scrollTo({ top: 0 }) // переход с нижних каруселей — наверх новой страницы
    fetchProduct(modelId).then(setData).catch(() => setError('не удалось загрузить товар'))
  }, [modelId])

  // «Недавно смотрели»: снапшот id ДО записи текущего товара (сам себя не показывает).
  useEffect(() => {
    const ids = getRecentIds().filter((x) => x !== modelId).slice(0, 8)
    setRecent([])
    fetchCatalogBatch(ids).then((r) => setRecent(r.results)).catch(() => {})
  }, [modelId])

  // Запоминаем товар после успешной загрузки.
  useEffect(() => {
    if (data) pushRecentId(modelId)
  }, [data, modelId])

  // Заголовок вкладки по названию модели (для шаринга/истории).
  useEffect(() => {
    if (data) document.title = `${data.model.brand.name} ${data.model.name} — Search-app`
  }, [data])

  // Размеры: label → { count, minPrice }
  const sizes = useMemo(() => {
    const m = new Map<string, { count: number; minPrice: number }>()
    for (const o of data?.offers ?? []) {
      const k = offerSize(o)
      const cur = m.get(k)
      if (cur) {
        cur.count++
        cur.minPrice = Math.min(cur.minPrice, o.price)
      } else m.set(k, { count: 1, minPrice: o.price })
    }
    return [...m.entries()].sort((a, b) => parseFloat(a[0].replace(/[^\d.]/g, '')) - parseFloat(b[0].replace(/[^\d.]/g, '')))
  }, [data])

  const shown = useMemo(() => (data?.offers ?? []).filter((o) => !size || offerSize(o) === size), [data, size])

  if (error) return <div style={{ paddingTop: 24 }}><button className="btn btn-ghost btn-sm" onClick={onBack}>← Назад</button><p className="text-danger">{error}</p></div>
  if (!data)
    return (
      <div style={{ paddingTop: 24, display: 'grid', gap: 12 }}>
        <div className="skeleton" style={{ height: 40, maxWidth: 320 }} />
        <div className="skeleton" style={{ height: 220 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    )

  const m = data.model
  const minPrice = data.offers.length ? Math.min(...data.offers.map((o) => o.price)) : null
  const discount = retailDiscount(minPrice, m.retailPrice)
  // Паспорт модели: пары «метка → значение» для блока «Детали товара».
  const details: [string, string][] = []
  if (m.sku) details.push(['Артикул', m.sku])
  if (m.colorway) details.push(['Расцветка', m.colorway])
  if (m.retailPrice != null) details.push(['Ритейл-цена', `${m.retailPrice.toLocaleString('ru-RU')} ₽`])
  if (m.releaseYear != null) details.push(['Год релиза', String(m.releaseYear)])
  return (
    <div style={{ paddingTop: 16 }} className="fade-up">
      {/* Хлебные крошки: ← назад · Главная › Категория › Бренд › Модель */}
      <nav aria-label="Хлебные крошки" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, whiteSpace: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack} title="назад" aria-label="назад" style={{ padding: '3px 9px', flexShrink: 0 }}>←</button>
        <Crumb onClick={() => navigate('/')}>Главная</Crumb>
        <span className="text-3" aria-hidden>›</span>
        <Crumb onClick={() => navigate(`/catalog?cat=${m.category.slug}`)}>{m.category.name}</Crumb>
        <span className="text-3" aria-hidden>›</span>
        <Crumb onClick={() => navigate(`/brand/${m.brand.id}`)}>{m.brand.name}</Crumb>
        <span className="text-3" aria-hidden>›</span>
        <span className="text-2" style={{ flexShrink: 0 }}>{m.name}</span>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 12 }}>
        <div className="card" style={{ aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 0 }}>
          {data.photo && imgOk ? (
            <img src={data.photo} alt={`${m.brand.name} ${m.name}`} onError={() => setImgOk(false)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span className="display text-3" style={{ fontSize: 56 }}>{m.brand.name.slice(0, 1)}</span>
          )}
        </div>

        <div>
          <div className="text-3" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.brand.name} · {m.category.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title" style={{ marginTop: 4 }}>{m.name}</h1>
            <HeartButton modelId={m.id} size={36} />
          </div>
          {m.colorway && <div className="text-2" style={{ fontSize: 13, marginTop: 4 }}>{m.colorway}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'baseline', gap: 8 }} className="tnum">
                {minPrice != null ? `от ${minPrice.toLocaleString('ru-RU')} ₽` : '—'}
                {discount && <span className="text-success" style={{ fontSize: 12, fontWeight: 700 }} title="мин. цена ниже ритейла">−{discount}% от ритейла</span>}
              </div>
              <div className="text-3" style={{ fontSize: 11 }}>{data.offers.length} в наличии</div>
            </div>
            {data.lastSale && (
              <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }} className="tnum">{data.lastSale.price.toLocaleString('ru-RU')} ₽</div>
                <div className="text-3" style={{ fontSize: 11 }}>последняя продажа</div>
              </div>
            )}
            {data.activeRequests > 0 && (
              <div style={{ background: 'var(--bg-elev)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{data.activeRequests}</div>
                <div className="text-3" style={{ fontSize: 11 }}>ищут сейчас</div>
              </div>
            )}
          </div>

          {sizes.length > 0 && (
            <>
              <div className="text-2" style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 8px' }}>Размеры</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className={!size ? 'chip chip-active' : 'chip'} onClick={() => setSize(null)}>Все</button>
                {sizes.map(([label, s]) => (
                  <button key={label} className={size === label ? 'chip chip-active' : 'chip'} onClick={() => setSize(size === label ? null : label)} title={`${s.count} офф.`}>
                    {label} <span style={{ opacity: 0.65, fontSize: 11 }} className="tnum">{s.minPrice.toLocaleString('ru-RU')}₽</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {data.offers.length === 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700 }}>Сейчас нет в наличии</div>
              <div className="text-2" style={{ fontSize: 13, margin: '4px 0 10px' }}>Оставь запрос — продавцы предложат цену, когда появится.</div>
              <button className="btn btn-primary btn-sm" onClick={onLeaveRequest}>Оставить запрос «Ищу»</button>
            </div>
          )}
        </div>
      </div>

      {(details.length > 0 || m.description) && (
        <>
          <div className="section-title">Детали товара</div>
          <div className="card">
            {details.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                {details.map(([label, value]) => (
                  <div key={label}>
                    <div className="text-3" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                    <div className="tnum" style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
            {m.description && (
              <p className="text-2" style={{ fontSize: 13, lineHeight: 1.6, margin: details.length > 0 ? '12px 0 0' : 0 }}>{m.description}</p>
            )}
          </div>
        </>
      )}

      {shown.length > 0 && (
        <>
          <div className="section-title">Предложения {size ? `· ${size}` : ''} <span className="text-3" style={{ fontFamily: 'var(--font)', fontWeight: 400, fontSize: 13 }}>· {shown.length}</span></div>
          <div style={{ display: 'grid', gap: 8 }}>
            {shown.map((o: Offer) => (
              <div key={o.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 86 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }} className="tnum">{o.price.toLocaleString('ru-RU')} ₽</div>
                  <div className="text-3" style={{ fontSize: 12 }}>{offerSize(o)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div className="text-2" style={{ fontSize: 13 }}>
                    {o.condition === 'new' ? 'новое' : 'б/у'}
                    {o.colorway && ` · ${o.colorway}`}
                    {o.fitting && ' · примерка'}
                    {o.city && ` · ${o.city}`}
                  </div>
                  <div className="text-3" style={{ fontSize: 12, cursor: 'pointer', marginTop: 2 }} onClick={() => setSellerId(o.seller.id)}>
                    <span style={{ textDecoration: 'underline dotted' }}>{o.seller.vkName || o.seller.nick}</span>
                    {o.seller.status === 'approved' && <span className="text-success"> ✓</span>}
                    {o.seller.rating != null && <span> ★{o.seller.rating}{o.seller.reviewsCount ? ` (${o.seller.reviewsCount})` : ''}</span>}
                    {o.seller.dealsCompleted > 0 && ` · ${o.seller.dealsCompleted} сд.`}
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => onContact(o.id, o.seller.contact)}>Написать</button>
              </div>
            ))}
          </div>
        </>
      )}

      {data.sales.length > 0 && (
        <>
          <div className="section-title">
            История продаж <span className="text-3" style={{ fontFamily: 'var(--font)', fontWeight: 400, fontSize: 13 }}>· {data.sales.length}</span>
          </div>
          <div className="card">
            {data.sales.length >= 3 ? (
              <>
                <PriceChart sales={data.sales} />
                <div className="text-3" style={{ fontSize: 12, marginTop: 8 }}>
                  за всё время: мин <b className="tnum">{Math.min(...data.sales.map((s) => s.price)).toLocaleString('ru-RU')} ₽</b> · макс{' '}
                  <b className="tnum">{Math.max(...data.sales.map((s) => s.price)).toLocaleString('ru-RU')} ₽</b>
                </div>
              </>
            ) : (
              <div className="text-2" style={{ fontSize: 13 }}>
                Пока {data.sales.length} {plural(data.sales.length, 'продажа', 'продажи', 'продаж')} — график появится после третьей.
                Последняя: <b className="tnum">{data.sales[data.sales.length - 1].price.toLocaleString('ru-RU')} ₽</b>
              </div>
            )}
          </div>
        </>
      )}

      {data.related.length > 0 && (
        <>
          <div className="section-title">Похожие модели</div>
          <CardRow items={data.related} onOpen={(id) => navigate(`/product/${id}`)} />
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="section-title">Недавно смотрели</div>
          <CardRow items={recent} onOpen={(id) => navigate(`/product/${id}`)} />
        </>
      )}

      {sellerId > 0 && <SellerModal sellerId={sellerId} onClose={() => setSellerId(0)} />}
    </div>
  )
}
