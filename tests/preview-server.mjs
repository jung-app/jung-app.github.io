// Local, synthetic QA only. No Telegram token, production API or user data.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = new Set(["app.js", "styles.css", "today-prompt.js", "favicon.svg", "admin.js", "admin.css"]);
const mime = { js: "text/javascript", css: "text/css", svg: "image/svg+xml" };
let revision = 0;

function fixture() {
  return {
    pseudonym: "Тестовый профиль",
    updated_at: new Date(Date.now() + revision++ * 1000).toISOString(),
    completeness: { percent: 0, missing: ["Детские раны"] },
    path: { activation: { stage: "portrait_ready" } },
    live_sync: { last_turn_at: "2026-09-05T12:00:00Z", pending_profile_update: false },
    outcome_prompts: { conversation_key: "synthetic-conversation-01" },
    memory_center: {
      writes_paused: false,
      manual_types: [{ value: "goal", label: "Цель" }, { value: "preference", label: "Предпочтение" }],
      groups: [{ class: "semantic", label: "Важное", description: "Синтетическая запись для проверки",
        items: [{ key: "synthetic-memory-01", type: "goal", type_label: "Цель",
          content: "После обеда попробовать короткую прогулку", editable: true,
          source: "Добавлено тобой", why: "Явное сохранение", recorded_on: "2026-09-05" }] }],
    },
    show_upgrade: true,
    billing: { monthly_xtr: 500, annual_xtr: 5000, annual_available: true, payments_available: true },
    access: { mode: "free" },
  };
}

const runtime = `
  const query = new URLSearchParams(location.search);
  window.JUNG_CONFIG = {API_BASE: location.origin + '/fixture/' + (query.get('state') || 'profile')};
  window.Telegram = {WebApp: {
    initData: 'synthetic-preview-only', colorScheme: query.get('theme') || 'light', themeParams: {},
    ready() {}, expand() {}, onEvent() {}, setHeaderColor() {}, setBackgroundColor() {},
    setBottomBarColor() {}, close() {document.getElementById('preview-status').textContent = 'Возврат в чат';},
    BackButton: {show(){}, hide(){}, onClick(){}}, HapticFeedback: {selectionChanged(){}},
    openInvoice(url, done) {done('cancelled');}
  }};
  if (document.getElementById('preview-refresh')) document.getElementById('preview-refresh').onclick = () => refreshProfileView();
`;

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:8765");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (url.pathname.startsWith("/fixture/")) {
      res.setHeader("Content-Type", "application/json");
      if (url.pathname === "/fixture/admin/api/admin/overview") {
        res.end(JSON.stringify({outcomes: {step_attempt: {done: 2, partly: 1, not_yet: 3}}})); return;
      }
      if (url.pathname.startsWith("/fixture/step")) {
        if (req.method === "POST" && url.pathname.startsWith("/fixture/step-offline/")) {
          res.writeHead(503); res.end('{}'); return;
        }
        if (req.method === "POST" && url.pathname.startsWith("/fixture/step-conflict/")) {
          res.writeHead(409); res.end('{}'); return;
        }
        // Real local API + in-memory synthetic profile. Never proxy production.
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const backend = await fetch("http://127.0.0.1:8766" + url.pathname.replace(/^\/fixture\/[^/]+/, "") + url.search, {
          method: req.method,
          headers: {Authorization: "tma synthetic", "Content-Type": "application/json"},
          body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
        });
        res.writeHead(backend.status);
        res.end(await backend.text()); return;
      }
      if (url.pathname.includes("/error/")) { res.writeHead(503); res.end('{}'); return; }
      if (url.pathname.includes("/unauthorized/")) { res.writeHead(401); res.end('{}'); return; }
      if (url.pathname.includes("/empty/")) { res.end('{"profile":null}'); return; }
      if (req.method === "POST") {
        if (url.pathname.endsWith("/invoice")) {
          res.end(JSON.stringify({invoice_url: "https://t.me/$synthetic-invoice"})); return;
        }
        res.end(JSON.stringify({profile: fixture(), recorded: true})); return;
      }
      res.end(JSON.stringify({profile: fixture()})); return;
    }
    if (url.pathname === "/preview-runtime.js") {
      res.setHeader("Content-Type", "text/javascript"); res.end(runtime); return;
    }
    if (url.pathname === "/admin-preview") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      const html = (await readFile(new URL("admin.html", root), "utf8"))
        .replace(/<link[\s\S]*?>/g, match => match.includes("fonts.google") ? "" : match)
        .replace('<script src="https://telegram.org/js/telegram-web-app.js"></script>', "")
        .replace(/\.\/config\.js\?v=[^\"]+/, "/preview-runtime.js")
        .replace('<body>', '<body><aside style="padding:8px">Синтетический стенд. Все числа вымышлены.</aside>');
      res.end(html); return;
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; script-src 'self'; img-src 'self' data:");
      res.end(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <title>Синтетическая проверка MindCoach</title><link rel="icon" href="/favicon.svg">
        <link rel="stylesheet" href="/styles.css"></head><body>
        <aside style="font:12px system-ui;padding:8px">Синтетический стенд. Все данные вымышлены.
        <button type="button" id="preview-refresh">Смоделировать обновление</button>
        <span id="preview-status" role="status"></span></aside>
        <main class="app" id="app"></main><p id="action-status" class="sr-only" role="status" aria-live="polite"></p>
        <script src="/preview-runtime.js"></script><script src="/today-prompt.js"></script><script src="/app.js"></script>
        </body></html>`); return;
    }
    const name = url.pathname.slice(1);
    if (!files.has(name)) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", mime[name.split('.').pop()]);
    res.end(await readFile(new URL(name, root)));
  } catch (_) { res.writeHead(500); res.end(); }
}).listen(8765, "127.0.0.1", () => {
  console.log("Synthetic preview: http://127.0.0.1:8765/?theme=light&state=profile");
});
