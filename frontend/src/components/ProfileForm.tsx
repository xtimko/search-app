import { useEffect, useState } from 'react'
import { Group, Header, FormItem, Input, Textarea, Button, Div, Spinner, Footnote } from '@vkontakte/vkui'
import { fetchMe, updateMe, type SellerProfile } from '../api/seller'

const STATUS: Record<SellerProfile['status'], { text: string; color: string }> = {
  pending: { text: 'на модерации', color: '#b8860b' },
  approved: { text: '✓ проверенный', color: '#1e8e3e' },
  blocked: { text: 'заблокирован', color: '#c0392b' },
}

// Профиль продавца: контакт привязывается ко всем товарам (ТЗ 4.4).
export function ProfileForm() {
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [nick, setNick] = useState('')
  const [contact, setContact] = useState('')
  const [city, setCity] = useState('')
  const [experience, setExperience] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMe()
      .then((p) => {
        setProfile(p)
        setNick(p.nick)
        setContact(p.contact)
        setCity(p.city ?? '')
        setExperience(p.experience ?? '')
        setDescription(p.description ?? '')
      })
      .catch(() => setError('не удалось загрузить профиль'))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setMsg('')
    setError('')
    if (!nick.trim() || !contact.trim()) {
      setError('Ник и контакт обязательны')
      return
    }
    setBusy(true)
    try {
      const p = await updateMe({ nick, contact, city, experience, description })
      setProfile(p)
      setMsg('Профиль сохранён')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Group header={<Header>Профиль продавца</Header>}>
        <Div><Spinner /></Div>
      </Group>
    )
  }

  const st = profile ? STATUS[profile.status] : null

  return (
    <Group header={<Header>Профиль продавца</Header>}>
      {st && (
        <Div>
          Статус: <b style={{ color: st.color }}>{st.text}</b>
        </Div>
      )}
      <FormItem top="Ник *">
        <Input value={nick} onChange={(e) => setNick(e.target.value)} />
      </FormItem>
      <FormItem top="Контакт (ссылка ВК / Telegram) *">
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="https://vk.com/... или https://t.me/..." />
      </FormItem>
      <FormItem top="Город">
        <Input value={city} onChange={(e) => setCity(e.target.value)} />
      </FormItem>
      <FormItem top="Стаж">
        <Input value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="например: 3 года" />
      </FormItem>
      <FormItem top="Описание">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormItem>
      {error && (
        <FormItem>
          <Footnote style={{ color: '#c0392b' }}>{error}</Footnote>
        </FormItem>
      )}
      {msg && (
        <FormItem>
          <Footnote style={{ color: '#1e8e3e' }}>{msg}</Footnote>
        </FormItem>
      )}
      <Div>
        <Button size="l" stretched loading={busy} onClick={save}>
          Сохранить профиль
        </Button>
      </Div>
    </Group>
  )
}
