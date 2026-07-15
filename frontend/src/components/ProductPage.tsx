import { useEffect, useMemo, useState } from 'react'
import { fetchProduct, offerSize, retailDiscount, type ProductData, type Offer } from '../api/catalog'
import { SellerModal } from './SellerModal'

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
  const [data, setData] = useState<ProductData | null>(null)
  const [error, setError] = useState('')
  const [size, setSize] = useState<string | null>(null)
  const [sellerId, setSellerId] = useState(0)
  const [imgOk, setImgOk] = useState(true)

  useEffect(() => {
    setData(null)
    fetchProduct(modelId).then(setData).catch(() => setError('не удалось загрузить товар'))
  }, [modelId])

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
      <button className="btn btn-ghost btn-sm" onClick={onBack}>← Каталог</button>

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
          <h1 className="page-title" style={{ marginTop: 4 }}>{m.name}</h1>
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

      {sellerId > 0 && <SellerModal sellerId={sellerId} onClose={() => setSellerId(0)} />}
    </div>
  )
}
