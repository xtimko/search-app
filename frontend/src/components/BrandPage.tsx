import { useEffect, useState } from 'react'
import { fetchBrandInfo, type BrandInfo } from '../api/catalog'
import { SearchPage } from './SearchPage'

const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many

// Страница бренда /brand/:id — шапка (имя + счётчики наличия) + его каталог
// (SearchPage с зафиксированным брендом: секция брендов скрыта, поиск внутри бренда).
export function BrandPage({ brandId, onOpenProduct }: { brandId: number; onOpenProduct: (modelId: number) => void }) {
  const [info, setInfo] = useState<BrandInfo | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setInfo(null)
    setMissing(false)
    fetchBrandInfo(brandId).then(setInfo).catch(() => setMissing(true))
  }, [brandId])

  useEffect(() => {
    if (info) document.title = `${info.name} — Search-app`
  }, [info])

  if (missing) {
    return (
      <div style={{ paddingTop: 24 }}>
        <p className="text-danger">бренд не найден</p>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 20 }} className="fade-up">
      <div className="text-3" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Бренд</div>
      {info ? (
        <>
          <h1 className="page-title" style={{ marginTop: 4 }}>{info.name}</h1>
          <div className="text-2" style={{ fontSize: 13, marginTop: 4 }}>
            {info.modelsInStock} {plural(info.modelsInStock, 'модель', 'модели', 'моделей')} в наличии · {info.offersCount}{' '}
            {plural(info.offersCount, 'предложение', 'предложения', 'предложений')}
          </div>
          <SearchPage lockedBrand={{ id: info.id, name: info.name }} onOpenProduct={onOpenProduct} />
        </>
      ) : (
        <div className="skeleton" style={{ height: 40, maxWidth: 280, marginTop: 8 }} />
      )}
    </div>
  )
}
