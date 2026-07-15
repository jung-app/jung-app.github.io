// Конфигурация фронтенда мини-аппа. Правится при деплое — не трогает app.js.
//
// API_BASE — базовый адрес aiohttp-бэкенда бота (эндпоинты /api/*).
// Постоянный API живёт на VPS за Caddy. DNS и TLS обслуживают
// api.mindcoachbot.ru, поэтому адрес не меняется после перезапусков.
window.JUNG_CONFIG = {
  API_BASE: "https://api.mindcoachbot.ru",
};
