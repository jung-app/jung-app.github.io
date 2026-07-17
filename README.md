# jung-app — Telegram Mini App «Мой юнгианский профиль»

Статическая страница мини-аппа для [jung-bot](../jung-bot). Показывает пользователю
его юнгианский профиль: заполненность, разделы-гипотезы (тень, персона, паттерны…)
с уровнем уверенности и активные архетипы.

Данные тянутся с бэкенда бота (`GET /api/profile`) по подписанному Telegram
`initData`. Секретов на фронте нет.

## Файлы

- `index.html` — разметка + подключение Telegram SDK.
- `app.js` — загрузка профиля и рендер (чистый JS, без сборки).
- `styles.css` — стили, цвета из Telegram `themeParams` (свет/тьма).
- `config.js` — **единственное, что правится при деплое:** `API_BASE` (URL бэкенда).
- `landing.html`, `landing.css`, `landing.js` — публичный лендинг `mindcoachbot.ru` с
  CSS 3D-композицией, privacy-safe событиями конверсии и Telegram CTA.
- `robots.txt`, `sitemap.xml`, `site.webmanifest`, `og-image-v2.png` — SEO и social preview.
- `tests/landing-smoke.mjs` — статический smoke критического пути до Telegram.

## Деплой (GitHub Pages)

1. Создать публичный repo `jung-app`, запушить эти файлы.
2. Settings → Pages → Deploy from branch → `main` / root. Получить URL вида
   `https://<user>.github.io/jung-app/`.
3. Вписать в `config.js` → `API_BASE` публичный HTTPS-адрес бэкенда бота.
4. В `.env` бота задать `WEBAPP_URL` (= URL этой страницы) и
   `WEBAPP_ALLOWED_ORIGIN` (= `https://<user>.github.io`), перезапустить бота —
   он сам поставит кнопку-меню «Мой профиль».

## Бэкенд

Production работает на FirstVDS под `systemd`, за Caddy на постоянном
`https://api.mindcoachbot.ru`. Этот адрес задан в `config.js`; туннели и `launchd` больше
не входят в production-контур. Данные остаются в managed Supabase/PostgreSQL.
