// Личность пользователя из vk-bridge: подписанные launch-параметры ВК (для авторизации)
// + имя/аватар (для отображения). Подмешивается в запросы продавца.
let vkParams: string | null = null // строка launch-параметров (с sign) для проверки на бэке
let vkUserName: string | null = null
let vkPhoto: string | null = null

export function setVkIdentity(params: string | null, name: string | null, photo: string | null) {
  vkParams = params || null
  vkUserName = name
  vkPhoto = photo
}

// Имя/аватар для UI (раздел «Мой профиль»).
export function vkProfile(): { name: string | null; photo: string | null } {
  return { name: vkUserName, photo: vkPhoto }
}

// Заголовки авторизации. Вне ВК пусто → бэкенд использует dev-продавца.
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  if (vkParams) h['x-vk-params'] = vkParams
  if (vkUserName) h['x-vk-user-name'] = encodeURIComponent(vkUserName)
  return h
}
