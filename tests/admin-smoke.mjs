import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const app = await readFile(new URL("../admin.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../admin.css", import.meta.url), "utf8");

assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive"/);
assert.match(html, /role="tablist"/);
assert.match(html, /role="tabpanel"/);
assert.match(html, /inputmode="numeric"/);
assert.match(html, /id="action-status"[^>]*aria-live="polite"/);
assert.match(html, /admin\.css\?v=20260822-admin-1/);
assert.match(html, /admin\.js\?v=20260822-admin-1/);

assert.match(app, /\/api\/admin\/overview/);
assert.match(app, /\/api\/admin\/user\?telegram_id=/);
assert.match(app, /\/api\/admin\/grant/);
assert.match(app, /Authorization: "tma " \+ initData/);
assert.match(app, /new AbortController\(\)/);
assert.match(app, /tg\.showConfirm/);
assert.match(app, /request_id: newRequestId\(\)/);
assert.match(app, /BackButton/);
assert.match(app, /themeChanged/);
assert.match(app, /ArrowLeft/);
assert.doesNotMatch(app, /\.innerHTML\s*=/);
assert.doesNotMatch(app, /localStorage|sessionStorage/);
assert.doesNotMatch(app, /\/api\/profile/);

assert.match(styles, /--tg-theme-bg-color/);
assert.match(styles, /--tg-content-safe-area-inset-bottom/);
assert.match(styles, /--tg-viewport-stable-height/);
assert.match(styles, /min-width: 320px/);
assert.match(styles, /min-height: 48px/);
assert.match(styles, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(styles, /linear-gradient|radial-gradient|backdrop-filter/);

console.log("Jung Control smoke passed");
