import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const boot = await readFile(new URL("../miniapp-boot.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /role="status"[^>]*aria-live="polite"/);
assert.match(boot, /config\.onerror = showFailure/);
assert.match(boot, /app\.onerror = showFailure/);
assert.match(boot, /today\.onerror = showFailure/);
assert.match(boot, /setTimeout\(showFailure, 15000\)/);

assert.match(app, /new AbortController\(\)/);
assert.match(app, /NETWORK_TIMEOUT_MS = 10000/);
assert.match(app, /\/api\/profile\?refresh=1/);
assert.match(app, /function normalizeProfile\(raw\)/);
assert.match(app, /if \(p\.show_upgrade\) root\.appendChild\(upgradeNudge\(p\)\)/);
assert.match(app, /if \(p\.show_upgrade\) root\.appendChild\(upgradeSection/);
assert.match(app, /svgEl\.style\.touchAction = "pan-y"/);
assert.doesNotMatch(app, /disableVerticalSwipes/);
assert.doesNotMatch(app, /last_user_preview/);
assert.doesNotMatch(app, /last_assistant_preview/);
assert.doesNotMatch(app, /latestProfileCue|todayPrompt/);
assert.match(app, /Ответить в чате/);
assert.doesNotMatch(app, /Выбери 500 ⭐|5000 ⭐ для года/);
assert.match(app, /Сессия завершилась/);
assert.match(app, /Обновить статус/);
assert.match(app, /Первый цикл изменений/);
assert.match(app, /Разбери трудный момент без стыда/);

console.log("Mini App resilience smoke passed");
