import { useRef, useState } from 'react'
import { downloadTemplate, parseFile, previewImport, commitImport, type PreviewResponse } from '../api/import'

// Массовая загрузка из таблицы: шаблон → файл → предпросмотр → публикация.
export function ImportPanel({ onImported }: { onImported: () => void }) {
  const [raw, setRaw] = useState<Record<string, unknown>[]>([])
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setMsg('')
    setBusy(true)
    try {
      const rows = await parseFile(file)
      setRaw(rows)
      if (rows.length === 0) {
        setPreview(null)
        setError('В файле не найдено строк')
        return
      }
      setPreview(await previewImport(rows))
    } catch (err) {
      setError((err as Error).message)
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const res = await commitImport(raw)
      setMsg(`Добавлено позиций: ${res.created}${res.skipped ? `, пропущено строк: ${res.skipped}` : ''}`)
      setPreview(null)
      setRaw([])
      if (fileRef.current) fileRef.current.value = ''
      onImported()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-outline" onClick={downloadTemplate}>
          Скачать шаблон (.xlsx)
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={busy} style={{ fontSize: 13, color: 'var(--text-2)' }} />
      </div>
      <div className="hint">
        Колонки: бренд, модель, размер, состояние, цена, город, фото, комментарий. В «размер» можно несколько через запятую: <b>8, 9, 10</b> — создастся позиция на каждый. Город можно не указывать.
      </div>

      {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 10 }}>{error}</div>}
      {msg && <div className="text-success" style={{ fontSize: 13, marginTop: 10 }}>{msg}</div>}

      {preview && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            Распознано строк: <b className="text-success">{preview.okCount}</b> · с ошибками:{' '}
            <b className={preview.errorCount ? 'text-danger' : 'text-3'}>{preview.errorCount}</b> · позиций к добавлению: <b>{preview.totalItems}</b>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-elev)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>#</th>
                  <th style={{ padding: '6px 8px' }}>Распознано</th>
                  <th style={{ padding: '6px 8px' }}>Размеры</th>
                  <th style={{ padding: '6px 8px' }}>шт</th>
                  <th style={{ padding: '6px 8px' }}>Сост.</th>
                  <th style={{ padding: '6px 8px' }}>Цена</th>
                  <th style={{ padding: '6px 8px' }}>Проблемы</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} style={{ borderTop: '1px solid var(--border)', background: r.ok ? 'transparent' : 'rgba(255,107,94,0.07)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--text-3)' }}>{r.row}</td>
                    <td style={{ padding: '6px 8px' }}>
                      {r.matched ? (
                        <span>
                          {r.matched.brand} {r.matched.name} <span className="text-3">· {r.matched.category}</span>
                        </span>
                      ) : (
                        <span className="text-danger">
                          {r.brandText} {r.modelText} ✕
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px' }}>{r.sizes.length ? r.sizes.join(', ') : '—'}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-3)' }}>{r.count || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.condition === 'new' ? 'новое' : 'б/у'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.price ? `${r.price.toLocaleString('ru-RU')} ₽` : '—'}</td>
                    <td style={{ padding: '6px 8px' }} className="text-danger">{r.issues.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 12 }} disabled={busy || preview.totalItems === 0} onClick={publish}>
            {busy ? 'Публикую…' : `Опубликовать ${preview.totalItems} позиций`}
          </button>
        </div>
      )}
    </div>
  )
}
