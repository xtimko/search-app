import bridge from '@vkontakte/vk-bridge'
import { setVkIdentity } from './api/client'

// Инициализация vk-bridge и мягкое получение личности продавца.
// Вне ВК (обычный браузер) VKWebAppGetUserInfo не сработает — остаёмся на dev-продавце.
export async function initVk(): Promise<void> {
  try {
    await bridge.send('VKWebAppInit')
    const user = await bridge.send('VKWebAppGetUserInfo')
    if (user && typeof user.id === 'number') {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
      setVkIdentity(String(user.id), name || null)
    }
  } catch {
    // не в окружении ВК — заголовки не отправляем, работает dev-продавец
  }
}
