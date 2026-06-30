# ARCHITECTURE — Устройство проекта

> Структура данных и модулей. Claude обновляет при изменении схемы/архитектуры.

---

## Сущности данных (актуально схеме `prisma/schema.prisma`, Фаза 4)

### Category (категория) — справочник, ДЕРЕВО
- id, name, slug (uniq), parentId (self-relation → parent/children)
- старт: Обувь / Одежда / Аксессуары (→ Часы, Сумки, Головные уборы, Украшения) / Коллекционное
- ведёт администратор, расширяется без миграций

### Brand (бренд) — справочник
- id, name (uniq), **aliases: String[]** (сленг/транслит: nb, нб, форсы…)

### Model (модель/референс) — справочник
- id, brandId, **categoryId**, name, **aliases: String[]**, sku (артикул, опц.)
- uniq (brandId, name)

### Listing (товар в стоке)
- id, sellerId, modelId
- размеры: sizeUs, sizeEu (обувь) + **size** (одежда/аксессуары: S/M/L, 42mm, one size) — RU убран
- **colorway** (расцветка), condition (new/used), hasBox, **fitting** (примерка да/нет)
- price (₽), city, photo, comment
- inStock (true/false — «продано» в один тап выключает)

### Seller (продавец)
- id, vkId (uniq), nick, contact (ссылка ВК/ТГ), city, experience (стаж), description
- status: pending / approved / blocked (модерация)

### SavedSearch (подписка покупателя, Этап 2 — ещё НЕ в схеме)
- id, userId, параметры запроса (модель, размер…)

---

## Модули (заполняется по мере разработки)

- **frontend/** — React + VKUI приложение
- **backend/** — Fastify API
- **prisma/** — схема БД и миграции

(детали путей — в карте файлов в CLAUDE.md)

---

## Ключевые потоки

1. **Выгрузка стока (массово):** продавец грузит таблицу → SheetJS парсит → сопоставление с справочником моделей → предпросмотр → запись Listing.
2. **Поиск:** запрос «модель + размер» → парсинг → SQL-запрос с фильтрами по индексам → список Listing с данными Seller.
3. **Модерация:** новый продавец → status=pending → админ одобряет → status=approved → может выгружать.
