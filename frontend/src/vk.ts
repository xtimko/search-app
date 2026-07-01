import bridge from '@vkontakte/vk-bridge'
import { setVkIdentity } from './api/client'

// Инициализация vk-bridge и авторизация по launch-параметрам ВК.
// launch-параметры ВК добавляет в query URL при открытии Mini App — их (с подписью)
// отправляем на бэкенд для проверки. Имя/аватар берём из VKWebAppGetUserInfo для UI.
export async function initVk(): Promise<void> {
  const launch = window.location.search.replace(/^\?/, '') // vk_user_id=..&sign=..
  try {
    await bridge.send('VKWebAppInit')
    const user = await bridge.send('VKWebAppGetUserInfo')
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
    setVkIdentity(launch || null, name || null, user.photo_100 || null)
  } catch {
    // не в окружении ВК — launch пустой, работает dev-продавец
    setVkIdentity(launch || null, null, null)
  }
}
