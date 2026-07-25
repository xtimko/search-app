// Клиент встроенных чатов (бэкенд /api/chats). Сессия — в cookie, уходит автоматически.

export interface ChatPeer {
  id: number
  nick: string
  vkName: string | null
  photo: string | null
  status: 'pending' | 'approved' | 'blocked'
  verified: boolean
}

export interface ChatListing {
  id: number
  price: number
  sizeUs: string | null
  sizeEu: string | null
  size: string | null
  colorway: string | null
  inStock: boolean
  reserved: boolean
  model: { name: string; brand: { name: string } }
}

export type OfferStatus = 'active' | 'accepted' | 'declined' | 'superseded'

export interface Deal {
  id: number
  conversationId: number
  listingId: number
  buyerId: number
  sellerId: number
  price: number
  status: 'open' | 'completed' | 'cancelled'
  buyerConfirmed: boolean
  sellerConfirmed: boolean
  review?: { id: number; rating: number } | null
  guarantor?: string | null
  createdAt: string
  closedAt: string | null
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
  deals: Deal[] // открытая сделка (0 или 1)
  _count: { messages: number } // непрочитанные для меня
  updatedAt: string
}

export interface ChatMessage {
  id: number
  senderId: number
  text: string
  kind: 'text' | 'offer' | 'system'
  offerPrice: number | null
  offerStatus: OfferStatus | null
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

export function sendOffer(chatId: number, price: number): Promise<ChatMessage> {
  return req<ChatMessage>(`/api/chats/${chatId}/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price }),
  })
}

export function acceptOffer(chatId: number, messageId: number): Promise<Deal> {
  return req<Deal>(`/api/chats/${chatId}/offers/${messageId}/accept`, { method: 'POST' })
}

export function declineOffer(chatId: number, messageId: number): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>(`/api/chats/${chatId}/offers/${messageId}/decline`, { method: 'POST' })
}

export interface DealFull extends Deal {
  listing: {
    id: number
    sizeUs: string | null
    sizeEu: string | null
    size: string | null
    colorway: string | null
    model: { name: string; brand: { name: string } }
  }
  buyer: ChatPeer
  seller: ChatPeer
}

export function fetchDeals(): Promise<DealFull[]> {
  return req<DealFull[]>('/api/deals')
}

export function confirmDeal(id: number): Promise<DealFull> {
  return req<DealFull>(`/api/deals/${id}/confirm`, { method: 'POST' })
}

export function cancelDeal(id: number): Promise<DealFull> {
  return req<DealFull>(`/api/deals/${id}/cancel`, { method: 'POST' })
}

export function setDealGuarantor(id: number, name: string): Promise<DealFull> {
  return req<DealFull>(`/api/deals/${id}/guarantor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export function reviewDeal(id: number, rating: number, text: string): Promise<{ id: number }> {
  return req<{ id: number }>(`/api/deals/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, text }),
  })
}
