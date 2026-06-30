import * as XLSX from 'xlsx'
import { authHeaders } from './client'

// Клиент массового импорта: шаблон + парсинг файла (SheetJS) + preview/commit.

export interface PreviewRow {
  row: number
  brandText: string
  modelText: string
  sizeText: string
  priceText: string
  matched: { id: number; name: string; brand: string; category: string } | null
  condition: 'new' | 'used'
  price: number | null
  issues: string[]
  ok: boolean
}

export interface PreviewResponse {
  rows: PreviewRow[]
  okCount: number
  errorCount: number
}

const TEMPLATE_HEADERS = ['бренд', 'модель', 'размер', 'состояние', 'цена', 'фото', 'комментарий']

// Скачать .xlsx-шаблон с нужными колонками и примерами.
export function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ['Nike', 'Air Force 1', '9.5us', 'новое', '12000', 'https://example.com/photo.jpg', 'без дефектов'],
    ['New Balance', '2002R', '43', 'новое', '15000', '', ''],
    ['Supreme', 'Box Logo Hoodie', 'M', 'б/у', '30000', '', ''],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'сток')
  XLSX.writeFile(wb, 'stockpoisk-шаблон.xlsx')
}

// Распарсить загруженный файл (xlsx/csv) в массив строк-объектов по заголовкам.
export async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf)
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

async function post<T>(url: string, rows: Record<string, unknown>[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ rows }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function previewImport(rows: Record<string, unknown>[]): Promise<PreviewResponse> {
  return post<PreviewResponse>('/api/import/preview', rows)
}

export function commitImport(rows: Record<string, unknown>[]): Promise<{ created: number; skipped: number }> {
  return post<{ created: number; skipped: number }>('/api/import/commit', rows)
}
