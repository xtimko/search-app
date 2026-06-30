# Один образ: бэкенд (Fastify) раздаёт API и собранный фронт (SPA).
FROM node:20-bookworm-slim
WORKDIR /app

# openssl нужен движку Prisma
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Зависимости (кэшируемый слой): сначала манифесты воркспейсов
COPY package*.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm install

# Исходники + генерация Prisma Client и сборка фронта/бэка
COPY . .
RUN npx prisma generate \
 && npm run build -w frontend \
 && npm run build -w backend

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Применяем миграции к БД и запускаем сервер
CMD ["sh", "-c", "npx prisma migrate deploy && node backend/dist/index.js"]
