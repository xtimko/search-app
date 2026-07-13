import type { FastifyInstance } from 'fastify'
import fastifyMultipart from '@fastify/multipart'
import path from 'node:path'
import crypto from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { getCurrentSellerId } from './listings'

// Загрузка фото (модели каталога и объявления). Файл пере-кодируется в WebP
// (ресайз до 1000px, это же санитизация от «не-картинок»), кладётся в UPLOAD_DIR
// и раздаётся статикой по /uploads/… На проде каталог примонтирован volume'ом.

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads')
mkdirSync(UPLOAD_DIR, { recursive: true }) // до регистрации @fastify/static (ему нужен существующий root)
const MAX_BYTES = 8 * 1024 * 1024 // 8 МБ

export async function uploadRoutes(app: FastifyInstance) {
  await app.register(fastifyMultipart, { limits: { fileSize: MAX_BYTES, files: 1 } })

  // POST /api/upload/photo (multipart, поле file) → { url: "/uploads/<hash>.webp" }
  app.post('/api/upload/photo', async (req, reply) => {
    const me = await getCurrentSellerId(req)
    if (!me) return reply.code(401).send({ error: 'нужен вход' })

    const part = await req.file()
    if (!part) return reply.code(400).send({ error: 'файл не передан (поле file)' })
    if (!/^image\//.test(part.mimetype)) return reply.code(400).send({ error: 'можно загружать только изображения' })

    let buf: Buffer
    try {
      buf = await part.toBuffer()
    } catch {
      return reply.code(400).send({ error: `файл больше ${MAX_BYTES / 1024 / 1024} МБ` })
    }

    let webp: Buffer
    try {
      webp = await sharp(buf)
        .rotate() // уважаем EXIF-ориентацию с телефонов
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
    } catch {
      return reply.code(400).send({ error: 'не удалось обработать изображение — файл повреждён?' })
    }

    const name = `${crypto.randomBytes(12).toString('hex')}.webp`
    await writeFile(path.join(UPLOAD_DIR, name), webp)
    return reply.code(201).send({ url: `/uploads/${name}` })
  })
}
