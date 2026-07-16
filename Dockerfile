# Один образ: бэкенд (Fastify) раздаёт API и собранный фронт (SPA).
FROM node:20-bookworm-slim
WORKDIR /app

# openssl нужен движку Prisma
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Зависимости (кэшируемый слой): сначала манифесты воркспейсов.
# npm ci — строго по package-lock (никаких «свежих» версий в проде).
COPY package*.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci

# Исходники + генерация Prisma Client и сборка фронта/бэка.
# --no-install: только локальная Prisma CLI из лока; без флага npx при её
# отсутствии молча качает latest из сети — мажор Prisma ломает сборку
# (Prisma 7 не понимает схему Prisma 6, ровно так упал деплой 2026-07-17).
COPY . .
RUN npx --no-install prisma generate \
 && npm run build -w frontend \
 && npm run build -w backend

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Применяем миграции к БД и запускаем сервер (--no-install — см. выше)
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node backend/dist/index.js"]
