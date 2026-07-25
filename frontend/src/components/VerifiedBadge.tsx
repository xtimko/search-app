// Знак «официальный/подтверждённый продавец» (Слой 2): ставит только админ,
// клон известного продавца его не получит. Заметный, в отличие от прежней
// мелкой серой галочки статуса. + ссылка на неподделываемую страницу ВК (Слой 1).

// Неподделываемый URL страницы ВК, вычисленный из vkId (выдан при входе через
// VK ID). НЕ путать с editable-полем «контакт» — то продавец может подменить.
export function vkProfileUrl(vkId: string | number): string {
  return `https://vk.com/id${vkId}`
}

// Заметная галочка. label=true — с подписью «Проверенный» (карточки/профиль),
// без label — компактный значок (строки офферов).
export function VerifiedBadge({ label = false, size = 16 }: { label?: boolean; size?: number }) {
  const check = (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="11" fill="var(--success)" />
      <path d="M7 12.3l3.2 3.2L17 8.8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (!label) {
    return (
      <span title="Официальный продавец — подтверждён администратором" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
        {check}
      </span>
    )
  }
  return (
    <span
      title="Официальный продавец — администратор подтвердил, что это тот самый человек"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--success)', fontWeight: 700, fontSize: 13 }}
    >
      {check}
      Проверенный
    </span>
  )
}
