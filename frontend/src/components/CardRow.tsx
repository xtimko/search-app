import type { CatalogItem } from '../api/catalog'
import { ProductCard } from './ProductCard'

// Горизонтальный ряд карточек каталога (карусель): ряды главной,
// «похожие» и «недавно смотрели» на странице товара.
export function CardRow({ items, onOpen }: { items: CatalogItem[]; onOpen: (id: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4, scrollSnapType: 'x proximity' }}>
      {items.map((it) => (
        <div key={it.model.id} style={{ width: 190, flexShrink: 0, scrollSnapAlign: 'start' }}>
          <ProductCard item={it} onOpen={onOpen} />
        </div>
      ))}
    </div>
  )
}
