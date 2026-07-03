// Клиент публичного профиля продавца (метрики, отзывы, товары).

export interface SellerStats {
  avgRating: number | null
  reviewsCount: number
  dealsCompleted: number
  completionRate: number | null
  medianResponseMin: number | null
}

export interface SellerReview {
  id: number
  rating: number
  text: string | null
  createdAt: string
  author: { nick: string; vkName: string | null; photo: string | null }
}

export interface SellerListing {
  id: number
  price: number
  sizeUs: string | null
  sizeEu: string | null
  size: string | null
  colorway: string | null
  condition: 'new' | 'used'
  model: { name: string; brand: { name: string } }
}

export interface SellerProfile {
  seller: {
    id: number
    nick: string
    vkName: string | null
    photo: string | null
    city: string | null
    experience: string | null
    description: string | null
    status: 'pending' | 'approved' | 'blocked'
    createdAt: string
  }
  stats: SellerStats
  reviews: SellerReview[]
  listings: SellerListing[]
}

export async function fetchSellerProfile(id: number): Promise<SellerProfile> {
  const res = await fetch(`/api/sellers/${id}/profile`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// «отвечает за ~N» — человекочитаемая скорость ответа.
export function responseLabel(min: number | null): string | null {
  if (min == null) return null
  if (min < 60) return `~${Math.max(min, 1)} мин`
  if (min < 60 * 24) return `~${Math.round(min / 60)} ч`
  return `~${Math.round(min / 1440)} дн`
}
