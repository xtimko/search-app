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
sudo docker compose exec app npx prisma db seed
```
Зальёт бренды/модели/категории (идемпотентно).

## 6. nginx: поддомен + HTTPS
```bash
sudo cp deploy/nginx-stockpoisk.conf /etc/nginx/sites-available/stockpoisk.conf
sudo nano /etc/nginx/sites-available/stockpoisk.conf      # впиши свой server_name
sudo ln -s /etc/nginx/sites-available/stockpoisk.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d stockpoisk.твойдомен.ru           # выпустит HTTPS
```
Проверка: открой `https://stockpoisk.твойдомен.ru` — приложение работает, поиск отдаёт данные.

## 7. Регистрация VK Mini App
1. https://dev.vk.com → создать приложение типа **Mini App (VK Apps)**.
2. **Базовый URL** = `https://stockpoisk.твойдомен.ru`.
3. Открой Mini App внутри ВК — vk-bridge подхватит личность (мягкая авторизация уже встроена).

## Обновление версии
```bash
cd /opt/stockpoisk && sudo git pull
sudo docker compose up -d --build     # пересоберёт и перезапустит; миграции применятся
```

## Бэкап БД
```bash
sudo docker compose exec db pg_dump -U stockpoisk stockpoisk > backup_$(date +%F).sql
```

## Дальше (см. docs/STATUS.md «очередь»)
- **Безопасная VK-авторизация**: серверная проверка подписи launch-параметров (нужны `app_id`/`secret`).
- **Реальная аутентификация админа**: сейчас `x-admin-token=dev` зашит во фронт (`frontend/src/api/admin.ts`); перед открытием доступа к админке заменить и задать секретный `ADMIN_TOKEN`.
- Близость по размеру в поиске, lazy-load `xlsx`.
