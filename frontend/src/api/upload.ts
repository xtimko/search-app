// Клиент загрузки фото: файл → сервер (WebP) → URL вида /uploads/<hash>.webp.

export async function uploadPhoto(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload/photo', { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return ((await res.json()) as { url: string }).url
}
