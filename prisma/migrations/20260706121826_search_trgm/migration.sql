-- Нечёткий поиск: расширение pg_trgm (триграммы) + GIN-индексы по названиям.
-- Даёт устойчивость к опечаткам и ранжирование по похожести (similarity/word_similarity).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS model_name_trgm ON "Model" USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS brand_name_trgm ON "Brand" USING gin (lower(name) gin_trgm_ops);
