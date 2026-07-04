// Конфигурация фронтенда мини-аппа. Правится при деплое — не трогает app.js.
//
// API_BASE — базовый адрес aiohttp-бэкенда бота (эндпоинты /api/*).
// PROD (VPS Beget, mindcoachbot.ru): мини-апп и бэкенд same-origin за Caddy, поэтому
// API_BASE пустой → app.js шлёт относительные запросы, без CORS и без туннеля.
// (Историч.: на ноуте через launchd нужен был cloudflared-туннель — больше не используется.)
window.JUNG_CONFIG = {
  API_BASE: "https://employment-interviews-previous-characteristic.trycloudflare.com",
};
