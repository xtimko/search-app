import { useEffect, useState } from 'react'
import { Group, Header, FormItem, Input, Textarea, Button, Div, Spinner, Footnote, SimpleCell } from '@vkontakte/vkui'
import { fetchMe, updateMe, type SellerProfile } from '../api/seller'

const STATUS: Record<SellerProfile['status'], { text: string; color: string }> = {
  pending: { text: 'на модерации', color: '#b8860b' },
  approved: { text: '✓ проверенный', color: '#1e8e3e' },
  blocked: { text: 'заблокирован', color: '#c0392b' },
}

// Профиль продавца: по умолчанию — компактная карточка, по «Изменить данные» разворачивается форма.
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

  if (loading) {
    return (
      <Group header={<Header>Профиль продавца</Header>}>
        <Div>
          <Spinner />
        </Div>
      </Group>
    )
  }

  const st = profile ? STATUS[profile.status] : null

  // Свёрнутый вид — компактная карточка только для просмотра.
  if (!editing) {
    return (
      <Group header={<Header>Профиль продавца</Header>}>
        <SimpleCell
          disabled
          subtitle={
            <span>
              {profile?.contact}
              {profile?.city ? ` · ${profile.city}` : ''}
              {profile?.experience ? ` · стаж: ${profile.experience}` : ''}
            </span>
          }
          after={st && <span style={{ color: st.color, fontSize: 13, fontWeight: 600 }}>{st.text}</span>}
        >
          {profile?.nick}
        </SimpleCell>
        <Div>
          <Button size="m" mode="secondary" onClick={() => setEditing(true)}>
            Изменить данные
          </Button>
        </Div>
      </Group>
    )
  }

  // Развёрнутая форма.
  return (
    <Group header={<Header>Профиль продавца</Header>}>
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
      <Div style={{ display: 'flex', gap: 8 }}>
        <Button size="l" loading={busy} onClick={save}>
          Сохранить
        </Button>
        {profile && (
          <Button size="l" mode="secondary" onClick={() => { fill(profile); setEditing(false); setError('') }}>
            Отмена
          </Button>
        )}
      </Div>
    </Group>
  )
}
