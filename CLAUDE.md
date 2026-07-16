# CLAUDE.md — Память проекта «СтокПоиск»

> Этот файл Claude Code читает АВТОМАТИЧЕСКИ при каждом запуске.
> Здесь — суть проекта, правила работы и КАРТА ФАЙЛОВ.
> Папка проекта одновременно является волтом Obsidian: открой её как vault.

---

## 1. Суть проекта (в одном абзаце)

**Сайт search-app.ru** (пивот с VK Mini App — см. DECISIONS 2026-07-02) — **мультикатегорийный** агрегатор стока для реселлеров (обувь/кроссовки, одежда, аксессуары — часы, сумки, головные уборы, украшения, люкс, коллекционное). Вход — только через VK ID (один аккаунт на VK-страницу; OAuth — в очереди). Две стороны: **продавцы** массово выгружают свой сток (таблицей или по одной позиции), **покупатели** быстро ищут модель+размер и связываются напрямую. **Ядро продукта — доска запросов «Ищу»** (в разработке): запрос покупателя → авто-матчинг со стоком → предложения продавцов. Монетизация (заложена, не включена): PRO-подписка продавца + промо-слоты на главной. Продавцов вручную проверяет администратор. Цель — полностью заменить чаты реселлеров.

## 2. Главные приоритеты (не нарушать)

1. **Быстрая массовая выгрузка стока** для продавцов (загрузка таблицей, автоподстановка моделей, отметка «продано» в один тап).
2. **Быстрый информативный поиск** для покупателей (запрос вида «Jordan 4 42», фильтры, карточки с ценой + продавцом + контактом).
3. **Единый справочник брендов/моделей** — чтобы поиск не разваливался из-за разнобоя в написании.

## 3. Стек

- Фронтенд: React + TypeScript + Vite, UI — собственная дизайн-система (тёмный street, `frontend/src/styles/theme.css`; VKUI удалён), vk-bridge — legacy для Mini App-контекста
- Бэкенд: Node.js + TypeScript, Fastify
- БД: PostgreSQL + Prisma (ORM)
- Импорт таблиц: SheetJS
- Хостинг (позже): фронт — Vercel, бэк+БД — Railway

## 4. КАРТА ПРОЕКТА (где что лежит — обновлять при изменениях!)

> ⚠️ Прежде чем искать по всему проекту — СНАЧАЛА смотри сюда. Это экономит токены.

| Что | Где |
|-----|-----|
| Корень монорепо: npm workspaces, скрипты dev/build/db | `package.json` |
| Пример .env для БД (Prisma) | `.env.example` |
| Прод-образ: бэкенд раздаёт API + собранный фронт | `Dockerfile` |
| Оркестрация: app + PostgreSQL | `docker-compose.yml` |
| Сниппет nginx (поддомен → контейнер :8080) | `deploy/nginx-stockpoisk.conf` |
| **Фронтенд** (Vite + React + TS) | `frontend/` |
| — точка входа React | `frontend/src/main.tsx` |
| — дизайн-система (Ice Monochrome: Unbounded+Onest (кириллица!), белый акцент, glow-поиск `.search-hero`, классы btn/chip/card/input/page-title) | `frontend/src/styles/theme.css` |
| — оболочка: 2-строчный хедер (поиск в центре, категории+Бренды) + нижний таб-бар (мобайл) | `frontend/src/App.tsx` |
| — глобальный поиск хедера с живыми подсказками (`/api/suggest`) | `frontend/src/components/HeaderSearch.tsx` |
| — полоска «Сейчас ищут» под хедером (`/api/trends`) | `frontend/src/components/TrendsBar.tsx` |
| — главная: hero-поиск, промо-слот, ряды-карусели (`/api/home`), плитки брендов, тизер запросов | `frontend/src/components/HomePage.tsx` |
| — горизонтальный ряд карточек (главная, PDP: похожие/недавние) | `frontend/src/components/CardRow.tsx` |
| — карточка товара в выдаче (поиск + главная) | `frontend/src/components/ResultCard.tsx` |
| — стор избранного «Слежу» (Set id, useSyncExternalStore, оптимистичный toggle) | `frontend/src/favorites.ts` |
| — клиент избранного (`/api/favorites*`) | `frontend/src/api/favorites.ts` |
| — каталог-браузер: сайдбар/шит фильтров, чипы, пагинация «Показать ещё» | `frontend/src/components/SearchPage.tsx` |
| — панель фильтров каталога (категории, бренды-мультивыбор, размер, цена, состояние) | `frontend/src/components/CatalogFilters.tsx` |
| — страница бренда `/brand/:id`: шапка + каталог бренда | `frontend/src/components/BrandPage.tsx` |
| — страница продавца: разделы Сток / Добавить / Импорт, вид таблица/карточки | `frontend/src/components/SellerPage.tsx` |
| — компактная таблица стока (инлайн: цена, размеры, продано) | `frontend/src/components/StockTable.tsx` |
| — раздел «Профиль»: VK-карточка + профиль продавца + задел рейтинга | `frontend/src/components/ProfilePage.tsx` |
| — форма профиля продавца (карточка ↔ форма) | `frontend/src/components/ProfileForm.tsx` |
| — админ-страница: модерация продавцов + справочник + раздел «Карточки моделей» | `frontend/src/components/AdminPage.tsx` |
| — админ: карточки моделей (очередь модерации, правка имя/артикул/категория/алиасы/фото/паспорт) | `frontend/src/components/AdminModelCards.tsx` |
| — клиент профиля (`/api/seller/me`) | `frontend/src/api/seller.ts` |
| — клиент админки (`/api/admin/*`) | `frontend/src/api/admin.ts` |
| — клиент авторизации VK ID (`/api/auth/*`) | `frontend/src/api/auth.ts` |
| — клиент чатов и сделок (`/api/chats*`, `/api/deals*`) | `frontend/src/api/chats.ts` |
| — клиент публичного профиля продавца | `frontend/src/api/sellers.ts` |
| — мини-профиль продавца (модал: метрики, отзывы, товары) | `frontend/src/components/SellerModal.tsx` |
| — доска запросов: форма + лента + отклик (`RequestsPage`) | `frontend/src/components/RequestsPage.tsx` |
| — клиент доски запросов | `frontend/src/api/requests.ts` |
| — раздел «Аналитика спроса» (PRO): дефицит, что ищут, продажи, unmet | `frontend/src/components/AnalyticsPage.tsx` |
| — клиент аналитики (`/api/analytics/*`) | `frontend/src/api/analytics.ts` |
| — раздел «Чаты»: диалоги + окно (офферы, плашка сделки) + под-вкладка «Сделки» | `frontend/src/components/ChatsPage.tsx` |
| — гейт «Войти через VK» для приватных разделов | `frontend/src/components/LoginGate.tsx` |
| — vk-bridge: init + мягкая авторизация (личность по vk_id, Mini App-контекст) | `frontend/src/vk.ts` |
| — заголовки авторизации к API (`x-vk-user-id`) | `frontend/src/api/client.ts` |
| — массовая загрузка (xlsx-шаблон, парсинг, preview/commit) | `frontend/src/components/ImportPanel.tsx` |
| — клиент поиска (`/api/search`) | `frontend/src/api/search.ts` |
| — каталог: `GET /api/catalog` (агрегаты; фильтры brands/size/price/condition; `?ids=` батч; offset+total), `GET /api/catalog/:id` (товар+офферы+sales+related), `GET /api/home` (ряды главной), suggest/trends, `/api/brands/top`+`/api/brands/:id` | `backend/src/routes/catalog.ts` |
| — клиент каталога | `frontend/src/api/catalog.ts` |
| — карточка модели в каталоге + сердечко HeartButton | `frontend/src/components/ProductCard.tsx` |
| — страница товара: крошки, офферы по размерам, график цен (SVG), «Детали товара» (паспорт), бейдж «−N% от ритейла», похожие, недавно смотрели | `frontend/src/components/ProductPage.tsx` |
| — недавно просмотренные модели (localStorage, для PDP и главной) | `frontend/src/recent.ts` |
| — клиент импорта (SheetJS) | `frontend/src/api/import.ts` |
| — загрузка фото: multipart → sharp → WebP → `/uploads` (volume) | `backend/src/routes/upload.ts` |
| — клиент загрузки фото | `frontend/src/api/upload.ts` |
| — выбор фото: файл или ссылка + превью (админка, формы) | `frontend/src/components/PhotoPicker.tsx` |
| — клиент справочника (fetch `/api/brands`, `/api/models`) | `frontend/src/api/directory.ts` |
| — клиент стока (`createListing`, `fetchMyListings`) | `frontend/src/api/listings.ts` |
| — компонент автоподстановки (debounce, навигация клавишами) | `frontend/src/components/Autocomplete.tsx` |
| — форма добавления позиции (размеры зависят от категории) | `frontend/src/components/ListingForm.tsx` |
| — карточка группы стока: размеры-чипы (продано в тап), правка цены/размеров, удаление | `frontend/src/components/StockGroupCard.tsx` |
| — конфиг Vite (dev-прокси `/health` и `/api` → бэкенд) | `frontend/vite.config.ts` |
| Конфиг превью-сервера (для dev-просмотра) | `.claude/launch.json` |
| **Бэкенд** (Fastify + TS) | `backend/` |
| — сервер: `/health`, регистрация роутов, раздача SPA (прод), закрытие БД | `backend/src/index.ts` |
| — VK ID OAuth: login/callback/me/logout | `backend/src/routes/auth.ts` |
| — чаты: диалоги по товару, сообщения, unread (`/api/chats*`) | `backend/src/routes/chats.ts` |
| — сделки: офферы в чате, accept/confirm/cancel, резерв, отзыв (`/api/deals*`) | `backend/src/routes/deals.ts` |
| — публичный профиль продавца: метрики/отзывы/товары (`/api/sellers/:id/profile`) | `backend/src/routes/sellers.ts` |
| — доска запросов «Ищу»: матчинг, отклик=чат+оффер (`/api/requests*`) | `backend/src/routes/requests.ts` |
| — аналитика спроса (PRO): `/api/analytics/demand` (спрос/дефицит/продажи/unmet) | `backend/src/routes/analytics.ts` |
| — подписанные сессии (httpOnly-cookie, HMAC) | `backend/src/session.ts` |
| — ретро-атрибуция спроса: новые модели подхватывают старые «не нашли»-поиски | `backend/src/demand.ts` |
| — «Слежу»: `GET/POST/DELETE /api/favorites*` (избранные модели, фундамент уведомлений) | `backend/src/routes/favorites.ts` |
| — экземпляр Prisma Client | `backend/src/db.ts` |
| — справочник: `GET /api/categories`/`brands`/`models` (поиск) + `POST /api/models` (своя модель) | `backend/src/routes/directory.ts` |
| — эндпоинты стока: `POST`/`GET`/`PATCH`/`DELETE /api/listings` (пока от dev-продавца) | `backend/src/routes/listings.ts` |
| — поиск покупателя: `GET /api/search` (парсер строки + нечёткий поиск pg_trgm + ранжирование + фильтры) | `backend/src/routes/search.ts` |
| — массовый импорт: `POST /api/import/preview`/`commit` | `backend/src/routes/import.ts` |
| — профиль продавца: `GET`/`PATCH /api/seller/me` | `backend/src/routes/seller.ts` |
| — админка: модерация + справочник + карточки моделей (`GET/POST/PATCH/DELETE /api/admin/models`) | `backend/src/routes/admin.ts` |
| **Схема БД** (PostgreSQL): Category(дерево), Brand, Model(+sku/status/imageUrl+паспорт: colorway/retailPrice/releaseYear/description), Listing, Seller, Favorite(«Слежу»), Conversation, Message, Deal, Review, Request(+Response), SearchLog | `prisma/schema.prisma` |
| История миграций (init + catalog_revision) | `prisma/migrations/` |
| Seed справочника (категории + бренды + модели, с алиасами) | `prisma/seed.ts` |
| Анализ реального чата запросов (спрос, форматы) | `docs/research/vk_chat_analysis.md` |

## 5. Правила работы Claude (ВАЖНО)

- **Перед правкой** — свериться с этой картой и с `docs/STATUS.md`. Не читать весь проект без необходимости.
- **После выполнения задачи** — ОБНОВИТЬ: карту файлов выше (если появились новые файлы), `docs/STATUS.md` (что сделано/в работе), при важном выборе — `docs/DECISIONS.md`.
- **Не переобсуждать** уже принятые решения — они в `docs/DECISIONS.md`.
- Менять минимально необходимое. Не рефакторить без запроса.
- Один язык на весь проект — TypeScript.
- Спрашивать, если задача неоднозначна, а не угадывать.

## 6. Связанные документы

- `docs/STATUS.md` — текущий статус, задачи, прогресс
- `docs/ROADMAP.md` — план «до уровня StockX» (7 фаз, выполняем по одной)
- `docs/DECISIONS.md` — журнал принятых решений
- `docs/ARCHITECTURE.md` — структура данных и устройство модулей
- `docs/DEPLOY.md` — инструкция деплоя (Vercel + Railway) + регистрация Mini App
- `docs/TZ.md` — полное техническое задание (бизнес-требования)
