import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Прокси: запросы фронта на /health уходят на бэкенд (Fastify, порт 3000),
// чтобы в dev фронт и бэк были связаны без CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
})
