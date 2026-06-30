import Fastify from 'fastify'
import path from 'node:path'
import { existsSync } from 'node:fs'
import fastifyStatic from '@fastify/static'
import { prisma } from './db'
import { directoryRoutes } from './routes/directory'
import { listingRoutes } from './routes/listings'
import { searchRoutes } from './routes/search'
import { importRoutes } from './routes/import'
import { sellerRoutes } from './routes/seller'
import { adminRoutes } from './routes/admin'

const app = Fastify({ logger: true })

// Тестовый эндпоинт — проверка, что бэкенд жив и связан с фронтом.
app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'stockpoisk-backend',
    time: new Date().toISOString(),
  }
})

// Эндпоинты единого справочника брендов/моделей.
app.register(directoryRoutes)
// Эндпоинты стока (листинги продавца).
app.register(listingRoutes)
// Эндпоинт поиска покупателя.
app.register(searchRoutes)
// Эндпоинты массового импорта стока.
app.register(importRoutes)
// Профиль продавца.
app.register(sellerRoutes)
// Админ-панель (модерация + справочник).
app.register(adminRoutes)

// Прод: бэкенд раздаёт собранный фронт (SPA) с того же origin.
// В dev фронт обслуживает Vite, dist может отсутствовать — тогда пропускаем.
const frontendDist = path.join(__dirname, '../../frontend/dist')
if (existsSync(frontendDist)) {
  app.register(fastifyStatic, { root: frontendDist })
  app.setNotFoundHandler((req, reply) => {
    const url = req.raw.url || ''
    if (req.method === 'GET' && !url.startsWith('/api') && url !== '/health') {
      return reply.sendFile('index.html')
    }
    return reply.code(404).send({ error: 'not found' })
  })
}

// Корректно закрываем соединение с БД при остановке сервера.
app.addHook('onClose', async () => {
  await prisma.$disconnect()
})

const port = Number(process.env.PORT) || 3000

app
  .listen({ port, host: '0.0.0.0' })
  .then((address) => app.log.info(`backend готов: ${address}`))
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
