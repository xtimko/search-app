import crypto from 'node:crypto'

// Проверка подписи launch-параметров VK Mini App.
// query — строка вида "vk_user_id=..&vk_app_id=..&...&sign=.." (без ведущего '?').
// Возвращает доверенный vk_user_id, если подпись валидна секретным ключом приложения, иначе null.
export function verifyVkLaunch(query: string): number | null {
  const secret = process.env.VK_APP_SECRET
  if (!secret || !query) return null

  // Разбираем пары, сохраняя исходную (url-encoded) форму значений — как их подписывал ВК.
  const pairs = query.split('&').map((p) => {
    const i = p.indexOf('=')
    return [i === -1 ? p : p.slice(0, i), i === -1 ? '' : p.slice(i + 1)] as [string, string]
  })

  const sign = pairs.find(([k]) => k === 'sign')?.[1]
  if (!sign) return null

  const vkPairs = pairs.filter(([k]) => k.startsWith('vk_')).sort((a, b) => a[0].localeCompare(b[0]))
  if (!vkPairs.length) return null

  const base = vkPairs.map(([k, v]) => `${k}=${v}`).join('&')
  const expected = crypto
    .createHmac('sha256', secret)
    .update(base)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  if (expected !== decodeURIComponent(sign)) return null

  const appId = process.env.VK_APP_ID
  if (appId && pairs.find(([k]) => k === 'vk_app_id')?.[1] !== appId) return null

  const uid = Number(vkPairs.find(([k]) => k === 'vk_user_id')?.[1])
  return Number.isFinite(uid) && uid > 0 ? uid : null
}
