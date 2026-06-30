// Личность текущего пользователя (из vk-bridge). Подмешивается в запросы продавца.
let vkUserId: string | null = null
let vkUserName: string | null = null

export function setVkIdentity(id: string | null, name: string | null) {
  vkUserId = id
  vkUserName = name
}

// Заголовки мягкой авторизации. Вне ВК пусто → бэкенд использует dev-продавца.
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  if (vkUserId) {
    h['x-vk-user-id'] = vkUserId
    if (vkUserName) h['x-vk-user-name'] = encodeURIComponent(vkUserName)
  }
  return h
}
