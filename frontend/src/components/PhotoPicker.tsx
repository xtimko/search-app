import { useRef, useState } from 'react'
import { uploadPhoto } from '../api/upload'

// Универсальный выбор фото: загрузка файла (→ /uploads/…) или вставка ссылки.
// value — текущий URL (или ''), onChange — новый URL.
export function PhotoPicker({ value, onChange, hint }: { value: string; onChange: (url: string) => void; hint?: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [imgOk, setImgOk] = useState(true)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const url = await uploadPhoto(file)
      setImgOk(true)
      onChange(url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Загружаю…' : value ? 'Заменить фото' : 'Загрузить фото'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
        <input
          className="input"
          style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
          value={value}
          onChange={(e) => {
            setImgOk(true)
            onChange(e.target.value)
          }}
          placeholder="…или вставь ссылку https://"
        />
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" title="убрать фото" onClick={() => onChange('')}>
            ✕
          </button>
        )}
      </div>
      {hint && <div className="hint">{hint}</div>}
      {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 6 }}>{error}</div>}
      {value.trim() && (
        <div style={{ marginTop: 8 }}>
          {imgOk ? (
            <img
              src={value.trim()}
              alt="превью"
              onError={() => setImgOk(false)}
              style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }}
            />
          ) : (
            <div className="text-danger" style={{ fontSize: 13 }}>Не удалось загрузить фото — проверь ссылку</div>
          )}
        </div>
      )}
    </div>
  )
}
