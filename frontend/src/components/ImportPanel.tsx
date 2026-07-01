import { useRef, useState } from 'react'
import { Group, Header, Div, Button, Footnote } from '@vkontakte/vkui'
import { downloadTemplate, parseFile, previewImport, commitImport, type PreviewResponse } from '../api/import'

// Панель массовой загрузки стока из таблицы: шаблон → файл → предпросмотр → публикация.
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
      setMsg(`Добавлено позиций: ${res.created}${res.skipped ? `, пропущено: ${res.skipped}` : ''}`)
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
    <Group header={<Header>Массовая загрузка из таблицы</Header>}>
      <Div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button mode="secondary" onClick={downloadTemplate}>
          Скачать шаблон (.xlsx)
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={busy} style={{ fontSize: 14 }} />
      </Div>
      <Div>
        <Footnote>Колонки: бренд, модель, размер, состояние, цена, фото, комментарий.</Footnote>
      </Div>

      {error && <Div><Footnote style={{ color: '#c0392b' }}>{error}</Footnote></Div>}
      {msg && <Div><Footnote style={{ color: '#1e8e3e' }}>{msg}</Footnote></Div>}

      {preview && (
        <Div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            Распознано строк: <b style={{ color: '#1e8e3e' }}>{preview.okCount}</b> · с ошибками:{' '}
            <b style={{ color: preview.errorCount ? '#c0392b' : '#888' }}>{preview.errorCount}</b> · позиций к добавлению:{' '}
            <b>{preview.totalItems}</b>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e3e3e3', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f6f7f9', textAlign: 'left' }}>
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
                  <tr key={r.row} style={{ borderTop: '1px solid #eee', background: r.ok ? 'transparent' : '#fdecea' }}>
                    <td style={{ padding: '6px 8px', color: '#999' }}>{r.row}</td>
                    <td style={{ padding: '6px 8px' }}>
                      {r.matched ? (
                        <span>
                          {r.matched.brand} {r.matched.name} <span style={{ color: '#999' }}>· {r.matched.category}</span>
                        </span>
                      ) : (
                        <span style={{ color: '#c0392b' }}>
                          {r.brandText} {r.modelText} ❌
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px' }}>{r.sizes.length ? r.sizes.join(', ') : '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#999' }}>{r.count || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.condition === 'new' ? 'новое' : 'б/у'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.price ? `${r.price.toLocaleString('ru-RU')} ₽` : '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#c0392b' }}>{r.issues.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12 }}>
            <Button size="l" stretched loading={busy} disabled={preview.totalItems === 0} onClick={publish}>
              Опубликовать {preview.totalItems} позиций
            </Button>
          </div>
        </Div>
      )}
    </Group>
  )
}
