import { useEffect, useState } from 'react'
import type { Category } from '../api/directory'

// Панель фильтров каталога: категории-дерево, бренды (мультивыбор с поиском),
// размер, цена от/до, состояние. Одна и та же в сайдбаре (десктоп) и в
// bottom sheet (мобайл). Размер/цена коммитятся по Enter/blur (не на каждый символ).

export interface CatalogFiltersState {
  brands: { id: number; name: string }[]
  size: string
  priceMin: string
  priceMax: string
  condition: '' | 'new' | 'used'
}

export const EMPTY_FILTERS: CatalogFiltersState = { brands: [], size: '', priceMin: '', priceMax: '', condition: '' }

export function countActiveFilters(f: CatalogFiltersState, countBrands = true): number {
  return (countBrands ? f.brands.length : 0) + (f.size ? 1 : 0) + (f.priceMin || f.priceMax ? 1 : 0) + (f.condition ? 1 : 0)
}

interface Props {
  tops: Category[] // корневые категории (отсортированы)
  childrenByParent: Record<number, Category[]>
  activeTop: number // корень активной ветки (0 = все)
  category: number // выбранная категория (корень или подкатегория)
  onCategory: (id: number) => void
  brandOptions: { id: number; name: string; offersCount: number }[]
  value: CatalogFiltersState
  onChange: (v: CatalogFiltersState) => void
  hideBrands?: boolean // страница бренда: бренд зафиксирован снаружи
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-3" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

const rowStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%',
  textAlign: 'left', background: active ? 'var(--accent-dim)' : 'none', border: 'none', borderRadius: 8,
  padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
  color: active ? 'var(--text)' : 'var(--text-2)', fontWeight: active ? 700 : 400, transition: 'background 0.15s, color 0.15s',
})

export function CatalogFilters({ tops, childrenByParent, activeTop, category, onCategory, brandOptions, value, onChange, hideBrands }: Props) {
  const [brandQ, setBrandQ] = useState('')
  // Черновики текстовых полей — коммит по Enter/blur, чтобы не дёргать запрос на каждый символ.
  const [size, setSize] = useState(value.size)
  const [pMin, setPMin] = useState(value.priceMin)
  const [pMax, setPMax] = useState(value.priceMax)
  useEffect(() => setSize(value.size), [value.size])
  useEffect(() => setPMin(value.priceMin), [value.priceMin])
  useEffect(() => setPMax(value.priceMax), [value.priceMax])

  function commitTexts() {
    const next = { ...value, size: size.trim(), priceMin: pMin.trim(), priceMax: pMax.trim() }
    if (next.size !== value.size || next.priceMin !== value.priceMin || next.priceMax !== value.priceMax) onChange(next)
  }
  const onEnter = (e: React.KeyboardEvent) => e.key === 'Enter' && (e.target as HTMLElement).blur()

  function toggleBrand(b: { id: number; name: string }) {
    const has = value.brands.some((x) => x.id === b.id)
    onChange({ ...value, brands: has ? value.brands.filter((x) => x.id !== b.id) : [...value.brands, { id: b.id, name: b.name }] })
  }

  const shownBrands = brandOptions.filter((b) => !brandQ.trim() || b.name.toLowerCase().includes(brandQ.trim().toLowerCase()))
  const subCats = childrenByParent[activeTop] ?? []

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Section title="Категории">
        <div style={{ display: 'grid', gap: 1 }}>
          <button style={rowStyle(category === 0)} onClick={() => onCategory(0)}>Все категории</button>
          {tops.map((t) => (
            <div key={t.id}>
              <button style={rowStyle(category === t.id)} onClick={() => onCategory(t.id)}>{t.name}</button>
              {activeTop === t.id && (childrenByParent[t.id] ?? []).length > 0 && (
                <div style={{ paddingLeft: 12, display: 'grid', gap: 1, marginTop: 1 }}>
                  {subCats.map((ch) => (
                    <button key={ch.id} style={rowStyle(category === ch.id)} onClick={() => onCategory(ch.id)}>{ch.name}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {!hideBrands && (
        <Section title="Бренды">
          <input
            className="input"
            style={{ fontSize: 13, padding: '7px 10px', marginBottom: 6 }}
            value={brandQ}
            onChange={(e) => setBrandQ(e.target.value)}
            placeholder="найти бренд…"
            aria-label="Поиск по списку брендов"
          />
          <div style={{ maxHeight: 236, overflowY: 'auto', display: 'grid', gap: 1 }}>
            {shownBrands.map((b) => {
              const active = value.brands.some((x) => x.id === b.id)
              return (
                <button key={b.id} style={rowStyle(active)} onClick={() => toggleBrand(b)} aria-pressed={active}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                  <span className="text-3 tnum" style={{ fontSize: 11.5, flexShrink: 0 }}>{active ? '✓' : b.offersCount}</span>
                </button>
              )
            })}
            {shownBrands.length === 0 && <div className="text-3" style={{ fontSize: 12.5, padding: '4px 10px' }}>ничего не найдено</div>}
          </div>
        </Section>
      )}

      <Section title="Размер">
        <input
          className="input"
          style={{ fontSize: 13, padding: '7px 10px' }}
          value={size}
          onChange={(e) => setSize(e.target.value)}
          onBlur={commitTexts}
          onKeyDown={onEnter}
          placeholder="9.5, 43, M, one size…"
          aria-label="Фильтр по размеру"
        />
        <div className="hint" style={{ marginTop: 4 }}>US, EU или буквенный — как указал продавец</div>
      </Section>

      <Section title="Цена, ₽">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            className="input tnum" style={{ fontSize: 13, padding: '7px 10px' }} inputMode="numeric" placeholder="от"
            value={pMin} onChange={(e) => setPMin(e.target.value.replace(/\D/g, '').slice(0, 8))} onBlur={commitTexts} onKeyDown={onEnter}
            aria-label="Цена от"
          />
          <span className="text-3">—</span>
          <input
            className="input tnum" style={{ fontSize: 13, padding: '7px 10px' }} inputMode="numeric" placeholder="до"
            value={pMax} onChange={(e) => setPMax(e.target.value.replace(/\D/g, '').slice(0, 8))} onBlur={commitTexts} onKeyDown={onEnter}
            aria-label="Цена до"
          />
        </div>
      </Section>

      <Section title="Состояние">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['', 'Все'], ['new', 'Новое'], ['used', 'Б/у']] as const).map(([v, label]) => (
            <button key={v} className={value.condition === v ? 'chip chip-active' : 'chip'} onClick={() => onChange({ ...value, condition: v })}>
              {label}
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}
