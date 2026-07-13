// Конфигурация фронтенда мини-аппа. Правится при деплое — не трогает app.js.
//
// API_BASE — базовый адрес aiohttp-бэкенда бота (эндпоинты /api/*).
// СЕЙЧАС (бот на ноуте, launchd): cloudflared quick tunnel. URL эфемерный — при каждой
// ротации туннеля сюда коммитится свежий адрес (актуальный: grep по logs/cloudflared.log
// в ~/jung-bot, см. vault operations.md).
// ПОСЛЕ переезда на VPS (mindcoachbot.ru за Caddy): мини-апп и бэкенд same-origin,
// API_BASE станет пустой строкой → относительные запросы, без CORS и без туннеля.
window.JUNG_CONFIG = {
  API_BASE: "https://merit-eds-enforcement-glenn.trycloudflare.com",
};
