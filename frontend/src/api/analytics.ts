// Клиент аналитики спроса (бэкенд /api/analytics).

export interface ModelStat {
  modelId: number
  name: string
  brand: string
  category: string
  count: number
}

export interface SaleStat extends ModelStat {
  avgPrice: number | null
}

export interface GapStat {
  modelId: number
  name: string
  brand: string
  category: string
  demand: number
  supply: number
}

export interface DemandAnalytics {
  period: 'week' | 'month'
  topRequested: ModelStat[]
  topSearched: ModelStat[]
  topSales: SaleStat[]
  gap: GapStat[]
  unmet: { query: string; count: number }[]
}

export async function fetchDemand(period: 'week' | 'month'): Promise<DemandAnalytics> {
  const res = await fetch(`/api/analytics/demand?period=${period}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
