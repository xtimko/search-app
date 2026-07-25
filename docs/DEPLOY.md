# DEPLOY — «СтокПоиск» на свой VPS (Docker + nginx)

> Сервер: Ubuntu 24.04, nginx уже стоит (:80/:443), PostgreSQL — в контейнере.
> Приложение изолировано: свой контейнер БД + контейнер app, наружу только
> `127.0.0.1:8080`, публичный доступ даёт nginx по поддомену с HTTPS.
> Текущий проект на сервере НЕ затрагивается (свой порт, своя БД).
> Конфиги в репозитории: `Dockerfile`, `docker-compose.yml`, `deploy/nginx-stockpoisk.conf`.

## 0. DNS
Сделай A-запись поддомена на IP сервера, напр. `stockpoisk.твойдомен.ru → <IP VPS>`.

## 1. Код на сервер
Вариант через GitHub:
```bash
# на сервере
cd /opt && sudo git clone https://github.com/<ТЫ>/<repo>.git stockpoisk && cd stockpoisk
```
(или загрузи папку через scp/rsync, исключая node_modules и .env).

## 2. Установить Docker (его на сервере нет)
```bash
curl -fsSL https://get.docker.com | sudo sh      # ставит docker + compose-плагин
sudo systemctl enable --now docker
docker --version && docker compose version        # проверка
```

## 3. Секреты приложения — `.env` рядом с docker-compose.yml
```bash
cd /opt/stockpoisk
cat > .env <<'EOF'
DB_PASSWORD=ПРИДУМАЙ_ДЛИННЫЙ_ПАРОЛЬ
ADMIN_TOKEN=dev
VK_APP_ID=ID_ПРИЛОЖЕНИЯ_ВК
VK_APP_SECRET=ЗАЩИЩЁННЫЙ_КЛЮЧ_ВК
EOF
```
- `DB_PASSWORD` — пароль контейнерного PostgreSQL (любой надёжный).
- `ADMIN_TOKEN` — пока оставь `dev` (фронт админки шлёт `dev`; смену на секрет см. «Дальше»).
- `VK_APP_ID` / `VK_APP_SECRET` — из **dev.vk.com** → настройки Mini App (`VK_APP_SECRET` = «Защищённый ключ»). Включают безопасную авторизацию по подписи. Без них — работает общий dev-продавец.

## 4. Запуск
```bash
sudo docker compose up -d --build
```
- соберётся образ, поднимется Postgres, применятся миграции (`prisma migrate deploy`), стартует сервер.
- проверка на сервере: `curl http://127.0.0.1:8080/health` → `{"status":"ok",...}`.

## 5. Стартовый справочник (один раз)
```bash
sudo docker compose exec app npx --no-install prisma db seed
```
Зальёт бренды/модели/категории (идемпотентно).

> ⚠️ **Никогда не запускай `npm install` / `npm i` / голый `npx` на сервере в
> `/opt/stockpoisk`** — это переписывает `package.json`/`package-lock.json`
> на «свежие» версии, docker собирает из этой грязной копии, и сборка ломается
> (так словили Prisma 7 при схеме Prisma 6, инцидент 2026-07-17). Всё npm-ное —
> только внутри контейнера (`docker compose exec app npx --no-install …`).
> Проверка чистоты перед деплоем: `git status --short` — должно быть пусто;
> если показывает `M package-lock.json` / `M package.json`:
> `git checkout -- package.json package-lock.json`.

## 6. nginx: поддомен + HTTPS
```bash
sudo cp deploy/nginx-stockpoisk.conf /etc/nginx/sites-available/stockpoisk.conf
sudo nano /etc/nginx/sites-available/stockpoisk.conf      # впиши свой server_name
sudo ln -s /etc/nginx/sites-available/stockpoisk.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d stockpoisk.твойдомен.ru           # выпустит HTTPS
```
Проверка: открой `https://stockpoisk.твойдомен.ru` — приложение работает, поиск отдаёт данные.

## 7. VK ID OAuth («Войти через ВК» на сайте) — ПОДКЛЮЧЁН (app 54693313)
Схема — **серверный OAuth 2.1 + PKCE** (наши `/api/auth/vk/login` → `…/callback`),
НЕ виджет-SDK OneTap: секрет остаётся на сервере, сессия — наша httpOnly-cookie.
Готовый SDK-сниппет из кабинета VK (OneTap, `redirectUrl` в корень) **не используем.**

1. Кабинет id.vk.com / dev.vk.com → приложение **54693313**:
   - **Базовый домен**: `search-app.ru`
   - **Доверенный redirect URL**: `https://search-app.ru/api/auth/vk/callback`
     (именно этот путь, не корень домена — корень был для SDK-виджета).
   - Доступы: базовые (имя, фамилия, фото) — этого хватает.
2. В `/opt/stockpoisk/.env`:
   - `VK_APP_ID=54693313`
   - `SESSION_SECRET=` → `openssl rand -hex 32`
   - `VK_APP_SECRET` — СНАЧАЛА оставить пустым (VK ID 2.1 = PKCE public client).
     Если в логах обмен кода падает с ошибкой про `client_secret` — вписать
     «Защищённый ключ» из кабинета и пересобрать.
   - `ALLOW_TEST_LOGIN` — оставить пустым (тестовый вход выключен).
3. Пересобрать: `sudo docker compose up -d --build` (env берётся из `.env` через compose).
4. Проверка: «Войти» в шапке → окно VK ID → возврат на сайт с именем и аватаром.
   Если вернулось `…/?auth=failed` — смотри причину: `sudo docker compose logs -f app | grep "vk id"`.

> В проде разделы «Мой сток», «Профиль», «Чаты» без входа недоступны (401 + гейт входа).
> Локально (не production) без входа работает dev-продавец; тестовый вход по имени —
> только в dev-сборке фронта и при `ALLOW_TEST_LOGIN=1` на бэке (аварийный доступ).

## Обновление версии
```bash
cd /opt/stockpoisk
git status --short                    # должно быть ПУСТО (см. ⚠️ в разделе 5)
sudo git pull
sudo docker compose up -d --build     # пересоберёт и перезапустит; миграции применятся
```

## Бэкап БД

> Фото живут в named volume `uploads` — бэкапить вместе с БД:
> `sudo docker run --rm -v stockpoisk_uploads:/u -v $(pwd):/b alpine tar czf /b/uploads-backup.tgz -C /u .`

```bash
sudo docker compose exec db pg_dump -U stockpoisk stockpoisk > backup_$(date +%F).sql
```

## Дальше (см. docs/STATUS.md «очередь»)
- **Безопасная VK-авторизация**: серверная проверка подписи launch-параметров (нужны `app_id`/`secret`).
- **Реальная аутентификация админа**: сейчас `x-admin-token=dev` зашит во фронт (`frontend/src/api/admin.ts`); перед открытием доступа к админке заменить и задать секретный `ADMIN_TOKEN`.
- Близость по размеру в поиске, lazy-load `xlsx`.
