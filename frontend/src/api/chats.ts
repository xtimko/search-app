// Клиент встроенных чатов (бэкенд /api/chats). Сессия — в cookie, уходит автоматически.

export interface ChatPeer {
  id: number
  nick: string
  vkName: string | null
  photo: string | null
  status: 'pending' | 'approved' | 'blocked'
}

export interface ChatListing {
  id: number
  price: number
  sizeUs: string | null
  sizeEu: string | null
  size: string | null
  colorway: string | null
  inStock: boolean
  model: { name: string; brand: { name: string } }
}

export interface Conversation {
  id: number
  listingId: number
  buyerId: number
  sellerId: number
  listing: ChatListing
  buyer: ChatPeer
  seller: ChatPeer
  messages: { text: string; senderId: number; createdAt: string }[]
  _count: { messages: number } // непрочитанные для меня
  updatedAt: string
}

export interface ChatMessage {
  id: number
  senderId: number
  text: string
  createdAt: string
  readAt: string | null
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function openChat(listingId: number): Promise<Conversation> {
  return req<Conversation>('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId }),
  })
}

export function fetchChats(): Promise<Conversation[]> {
  return req<Conversation[]>('/api/chats')
}

export function fetchUnread(): Promise<{ count: number }> {
  return req<{ count: number }>('/api/chats/unread')
}

export function fetchMessages(chatId: number): Promise<ChatMessage[]> {
  return req<ChatMessage[]>(`/api/chats/${chatId}/messages`)
}

export function sendMessage(chatId: number, text: string): Promise<ChatMessage> {
  return req<ChatMessage>(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}
