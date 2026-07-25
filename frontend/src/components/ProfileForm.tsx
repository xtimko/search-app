import { useEffect, useState } from 'react'
import { fetchMe, updateMe, type SellerProfile } from '../api/seller'

const STATUS: Record<SellerProfile['status'], { text: string; cls: string }> = {
  pending: { text: 'на модерации', cls: 'text-2' },
  approved: { text: 'магазин активен', cls: 'text-success' },
  blocked: { text: 'заблокирован', cls: 'text-danger' },
}

// Профиль продавца: компактная карточка, по «Изменить данные» — форма.
export function ProfileForm() {
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [nick, setNick] = useState('')
  const [contact, setContact] = useState('')
  const [city, setCity] = useState('')
  const [experience, setExperience] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function fill(p: SellerProfile) {
    setProfile(p)
    setNick(p.nick)
    setContact(p.contact)
    setCity(p.city ?? '')
    setExperience(p.experience ?? '')
    setDescription(p.description ?? '')
  }

  useEffect(() => {
    fetchMe()
      .then(fill)
      .catch(() => setError('не удалось загрузить профиль'))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setError('')
    if (!nick.trim() || !contact.trim()) {
      setError('Ник и контакт обязательны')
      return
    }
    setBusy(true)
    try {
      fill(await updateMe({ nick, contact, city, experience, description }))
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="card text-3">загружаем профиль…</div>

  const st = profile ? STATUS[profile.status] : null

  if (!editing) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{profile?.nick}</div>
            <div className="text-2" style={{ fontSize: 13, marginTop: 2 }}>
              {profile?.contact}
              {profile?.city ? ` · ${profile.city}` : ''}
              {profile?.experience ? ` · стаж: ${profile.experience}` : ''}
            </div>
            {profile?.description && <div className="text-3" style={{ fontSize: 13, marginTop: 4 }}>{profile.description}</div>}
          </div>
          {st && <span className={st.cls} style={{ fontSize: 13, fontWeight: 600 }}>{st.text}</span>}
        </div>
        <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>
          Изменить данные
        </button>
        {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 8 }}>{error}</div>}
      </div>
    )
  }

  return (
    <div className="card">
      <span className="label" style={{ marginTop: 0 }}>Ник *</span>
      <input className="input" value={nick} onChange={(e) => setNick(e.target.value)} />
      <span className="label">Контакт (ссылка ВК / Telegram) *</span>
      <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="https://vk.com/... или https://t.me/..." />
      <span className="label">Город</span>
      <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
      <span className="label">Стаж</span>
      <input className="input" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="например: 3 года" />
      <span className="label">Описание</span>
      <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <div className="text-danger" style={{ fontSize: 13, marginTop: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? 'Сохраняю…' : 'Сохранить'}
        </button>
        {profile && (
          <button className="btn btn-outline" onClick={() => { fill(profile); setEditing(false); setError('') }}>
            Отмена
          </button>
        )}
      </div>
    </div>
  )
}
