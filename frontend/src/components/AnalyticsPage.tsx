import { useEffect, useState } from 'react'
import { fetchDemand, type DemandAnalytics, type ModelStat, type SaleStat, type GapStat } from '../api/analytics'

// Горизонтальная «бар-строка»: подпись + значение + полоса относительно максимума.
function Bar({ label, sub, value, max, valueText }: { label: string; sub?: string; value: number; max: number; valueText?: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ height: 6, background: 'var(--bg-elev)', borderRadius: 4, marginTop: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
        </div>
        {sub && <div className="text-3" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
      </div>
      <div className="text-2" style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, minWidth: 44, textAlign: 'right' }}>
        {valueText ?? value}
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
      {hint && <div className="text-3" style={{ fontSize: 12, margin: '2px 0 8px' }}>{hint}</div>}
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  )
}

const empty = <div className="text-3" style={{ fontSize: 13, padding: '6px 0' }}>пока нет данных за период</div>

// Раздел «Аналитика спроса» (PRO): что ищут, чего не хватает, что продаётся.
export function AnalyticsPage() {
  const [period, setPeriod] = useState<'week' | 'month'>('month')
  const [data, setData] = useState<DemandAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchDemand(period)
      .then(setData)
      .catch(() => setError('не удалось загрузить аналитику'))
      .finally(() => setLoading(false))
  }, [period])

  const maxOf = (arr: { count?: number; demand?: number }[], key: 'count' | 'demand') =>
    arr.reduce((m, x) => Math.max(m, (x[key] as number) ?? 0), 0)

  const label = (m: ModelStat | SaleStat | GapStat) => `${m.brand} ${m.name}`

  return (
    <div style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title">
            Аналитика спроса <span className="badge badge-accent" style={{ verticalAlign: 'middle' }}>PRO</span>
          </h1>
          <div className="text-3" style={{ fontSize: 13, marginTop: 2 }}>
            что искать и закупать — по реальным данным площадки
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={period === 'week' ? 'chip chip-active' : 'chip'} onClick={() => setPeriod('week')}>Неделя</button>
          <button className={period === 'month' ? 'chip chip-active' : 'chip'} onClick={() => setPeriod('month')}>Месяц</button>
        </div>
      </div>

      {loading && <p className="text-3" style={{ marginTop: 16 }}>считаем…</p>}
      {error && <p className="text-danger" style={{ marginTop: 16 }}>{error}</p>}

      {data && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginTop: 16 }}>
          <Section title="🔥 Дефицит: спрос ≫ предложение" hint="Много спрашивают, мало в наличии — это стоит закупать в первую очередь.">
            {data.gap.length === 0 ? empty : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }} className="text-3">
                  <span>модель</span>
                  <span>спрос / в наличии</span>
                </div>
                {data.gap.map((g) => (
                  <div key={g.modelId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label(g)}</div>
                      <div className="text-3" style={{ fontSize: 11 }}>{g.category}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <span className="text-accent" style={{ fontWeight: 800 }}>{g.demand}</span>
                      <span className="text-3"> / </span>
                      <span className={g.supply === 0 ? 'text-danger' : 'text-2'} style={{ fontWeight: 700 }}>{g.supply}</span>
                      {g.supply === 0 && <div className="text-danger" style={{ fontSize: 10 }}>нет в наличии</div>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </Section>

          <Section title="Что ищут" hint="Топ моделей по запросам «Ищу» и поиску.">
            {(() => {
              const merged = new Map<number, { m: ModelStat; total: number }>()
              for (const x of [...data.topRequested, ...data.topSearched]) {
                const cur = merged.get(x.modelId)
                if (cur) cur.total += x.count
                else merged.set(x.modelId, { m: x, total: x.count })
              }
              const list = [...merged.values()].sort((a, b) => b.total - a.total).slice(0, 10)
              const max = list.reduce((mx, x) => Math.max(mx, x.total), 0)
              return list.length === 0 ? empty : list.map((x) => <Bar key={x.m.modelId} label={label(x.m)} sub={x.m.category} value={x.total} max={max} />)
            })()}
          </Section>

          <Section title="Продаётся" hint="Завершённые сделки за период + средняя цена.">
            {data.topSales.length === 0 ? empty : data.topSales.map((s: SaleStat) => (
              <Bar
                key={s.modelId}
                label={label(s)}
                sub={s.avgPrice ? `средняя цена ${s.avgPrice.toLocaleString('ru-RU')} ₽` : undefined}
                value={s.count}
                max={maxOf(data.topSales, 'count')}
                valueText={`${s.count} шт`}
              />
            ))}
          </Section>

          <Section title="Ищут, но не нашли" hint="Запросы без совпадения в каталоге — спрос, который вы пока не закрываете.">
            {data.unmet.length === 0 ? empty : data.unmet.map((u) => (
              <Bar key={u.query} label={u.query} value={u.count} max={maxOf(data.unmet.map((x) => ({ count: x.count })), 'count')} valueText={`${u.count}×`} />
            ))}
          </Section>
        </div>
      )}

      <div className="hint" style={{ marginTop: 14 }}>
        Данные — из запросов, поиска и сделок внутри площадки. Чем больше активность, тем точнее аналитика.
      </div>
    </div>
  )
}
