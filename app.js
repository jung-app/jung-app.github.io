"use strict";

// Мини-апп «Глубинный профиль». Тянет профиль с бэкенда бота по подписанному
// Telegram initData и рисует его. Секретов на фронте нет: initData — подписанный
// токен, бэкенд проверяет подпись и сам ходит в Supabase.

const tg = window.Telegram ? window.Telegram.WebApp : null;

const STATUS_LABELS = {
  emerging: "намёк",
  working: "гипотеза",
  confirmed_by_user: "подтверждено",
};
const CONFIDENCE_RANK = { low: 1, medium: 2, high: 3 };
const CONFIDENCE_LABELS = { low: "низкая уверенность", medium: "средняя уверенность", high: "высокая уверенность" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function setView(node) {
  document.getElementById("app").replaceChildren(node);
}

function stateView(title, sub, glyph) {
  const wrap = el("section", "state");
  wrap.appendChild(el("div", "glyph", glyph || "✦"));
  wrap.appendChild(el("p", "state-title serif", title));
  if (sub) wrap.appendChild(el("p", "state-sub", sub));
  return wrap;
}

// --- сеть -------------------------------------------------------------------

async function fetchProfile() {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");

  const res = await fetch(base.replace(/\/$/, "") + "/api/profile", {
    headers: { Authorization: "tma " + initData },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  return (await res.json()).profile; // null, если профиля ещё нет
}

// Отклонить гипотезу («это не про меня»). Бэкенд метит раздел dismissed: он выпадает
// из профиля и больше не предлагается моделью. Возвращает обновлённый профиль.
async function dismissSection(key) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");

  const res = await fetch(base.replace(/\/$/, "") + "/api/profile/dismiss", {
    method: "POST",
    headers: { Authorization: "tma " + initData, "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error("http-" + res.status);
  return (await res.json()).profile;
}

// Подтверждение действия: нативное у Telegram, иначе обычный confirm.
function confirmAction(message) {
  return new Promise((resolve) => {
    if (tg && typeof tg.showConfirm === "function") {
      tg.showConfirm(message, (ok) => resolve(!!ok));
    } else {
      resolve(window.confirm(message));
    }
  });
}

// --- кусочки UI -------------------------------------------------------------

function ring(percent) {
  const p = Math.max(0, Math.min(100, percent));
  const r = 48;
  const circ = 2 * Math.PI * r;
  const wrap = el("div", "ring");
  wrap.innerHTML = `
    <svg viewBox="0 0 108 108" class="ring-svg" aria-hidden="true">
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e8c074" />
          <stop offset="100%" stop-color="#c79a48" />
        </linearGradient>
      </defs>
      <circle class="ring-track" cx="54" cy="54" r="${r}" />
      <circle class="ring-prog" cx="54" cy="54" r="${r}"
        stroke-dasharray="${circ.toFixed(1)}"
        stroke-dashoffset="${(circ * (1 - p / 100)).toFixed(1)}" />
    </svg>
    <div class="ring-label"><span class="ring-num">${p}%</span><span class="ring-cap">глубина</span></div>`;
  return wrap;
}

function stat(value, label) {
  const s = el("div", "stat");
  s.appendChild(el("div", "stat-val", String(value)));
  s.appendChild(el("div", "stat-label", label));
  return s;
}

function confidence(level) {
  const rank = CONFIDENCE_RANK[level] || 0;
  const wrap = el("span", "conf");
  const dots = el("span", "conf-dots");
  for (let i = 1; i <= 3; i++) {
    const d = el("span", "conf-dot" + (i <= rank ? " on" : ""));
    dots.appendChild(d);
  }
  wrap.appendChild(dots);
  wrap.appendChild(el("span", "conf-cap", CONFIDENCE_LABELS[level] || "уверенность —"));
  return wrap;
}

function insightCard(item) {
  const card = el("article", "card");
  if (item.user_confirmed) card.classList.add("card--confirmed");

  const head = el("div", "card-head");
  head.appendChild(el("h3", "card-title", item.label || item.name));
  const st = el("span", "pill pill--status", STATUS_LABELS[item.status] || item.status);
  st.dataset.status = item.status;
  head.appendChild(st);
  card.appendChild(head);

  card.appendChild(el("p", "card-summary", item.summary));

  const meta = el("div", "card-meta");
  meta.appendChild(confidence(item.confidence));
  if (item.user_confirmed) meta.appendChild(el("span", "pill pill--ok", "✓ ты подтвердил"));
  if (item.evidence_count) meta.appendChild(el("span", "tag-evidence", item.evidence_count + " наблюд."));
  card.appendChild(meta);

  // «Это не про меня» — только для insight-разделов (у них есть key); архетипы без key.
  // Профиль обязан уметь ошибаться: человек вправе снять гипотезу, и она не вернётся.
  if (item.key) card.appendChild(dismissRow(item.key, item.label));
  return card;
}

function dismissRow(key, label) {
  const row = el("div", "card-actions");
  const btn = el("button", "card-dismiss", "Это не про меня");
  btn.type = "button";
  btn.addEventListener("click", async () => {
    const ok = await confirmAction(
      "Убрать «" + (label || "эту грань") + "» из профиля? Я больше не буду к ней возвращаться.",
    );
    if (!ok) return;
    btn.disabled = true;
    btn.textContent = "Убираю…";
    try {
      const updated = await dismissSection(key);
      setView(updated ? renderProfile(updated) : renderEmpty());
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Не вышло — ещё раз";
    }
  });
  row.appendChild(btn);
  return row;
}

function groupBlock(title, items) {
  const sec = el("section", "group");
  sec.appendChild(el("h2", "group-title", title));
  items.forEach((it) => sec.appendChild(insightCard(it)));
  return sec;
}

// --- сборка профиля ---------------------------------------------------------

function renderProfile(p) {
  const root = el("div", "profile");
  const c = p.completeness;

  // верхняя строка: бренд + дата
  const top = el("header", "topbar");
  const brand = el("div", "brand");
  brand.appendChild(el("div", "brand-kicker", "Глубинный профиль"));
  brand.appendChild(el("div", "brand-name", p.pseudonym || "Аноним"));
  top.appendChild(brand);
  const upd = fmtDate(p.updated_at);
  if (upd) top.appendChild(el("div", "datepill", "обновлён " + upd));
  root.appendChild(top);

  // герой: интро + кольцо глубины
  const hero = el("section", "hero");
  const left = el("div", "hero-text");
  left.appendChild(el("h1", "hero-title", "Что я о тебе понял"));
  left.appendChild(
    el(
      "p",
      "hero-sub",
      c.is_sufficient
        ? "Образ сложился — дальше он только углубляется в наших разговорах."
        : "Образ ещё проявляется. Чем больше говорим — тем отчётливее картина.",
    ),
  );
  hero.appendChild(left);
  hero.appendChild(ring(c.percent));
  root.appendChild(hero);

  // нить разговоров (новое: meta.chat.summary)
  if (p.conversation_summary) {
    const thread = el("section", "thread");
    thread.appendChild(el("div", "thread-label", "Нить наших разговоров"));
    thread.appendChild(el("p", "thread-text", p.conversation_summary));
    root.appendChild(thread);
  }

  // метрики
  const confirmed = p.sections.filter((s) => s.user_confirmed).length;
  const stats = el("section", "stats");
  stats.appendChild(stat(p.sections.length, "раскрыто граней"));
  stats.appendChild(stat(p.archetypes ? p.archetypes.length : 0, "активных архетипов"));
  stats.appendChild(stat(confirmed, "подтверждено тобой"));
  root.appendChild(stats);

  // разделы
  const core = p.sections.filter((s) => s.group === "core");
  const enrichment = p.sections.filter((s) => s.group === "enrichment");

  if (core.length) {
    root.appendChild(groupBlock("Основа личности", core));
  } else {
    const s = el("section", "group");
    s.appendChild(el("h2", "group-title", "Основа личности"));
    const note = el("div", "empty-note");
    note.textContent = "Базовые грани пока не проявились — расскажи мне о себе побольше в чате.";
    s.appendChild(note);
    root.appendChild(s);
  }

  if (enrichment.length) root.appendChild(groupBlock("Глубинные слои", enrichment));
  if (p.archetypes && p.archetypes.length) root.appendChild(groupBlock("Активные архетипы", p.archetypes));

  // что ещё стоит исследовать (если профиль не дозрел)
  if (!c.is_sufficient && c.missing && c.missing.length) {
    const ex = el("section", "explore");
    ex.appendChild(el("h2", "explore-title serif", "Что стоит исследовать"));
    ex.appendChild(el("p", "explore-sub", "Эти грани пока в тени. Заговори о них в чате — и образ станет полнее."));
    const chips = el("div", "chips");
    c.missing.forEach((m) => chips.appendChild(el("span", "chip", m)));
    ex.appendChild(chips);
    root.appendChild(ex);
  }

  const foot = el("footer", "footer");
  foot.appendChild(
    el("p", null, "Всё здесь — рабочие гипотезы, а не диагноз. Что-то не так — поправь меня в разговоре."),
  );
  root.appendChild(foot);
  return root;
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const m = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return d.getDate() + " " + m[d.getMonth()];
}

function renderEmpty() {
  return stateView(
    "Образ ещё не проявлен",
    "Мы пока толком не разговаривали. Напиши боту что-нибудь о себе — и я начну тебя понимать.",
    "○",
  );
}

// --- запуск -----------------------------------------------------------------

async function main() {
  if (tg) {
    tg.ready();
    tg.expand();
  }
  try {
    const profile = await fetchProfile();
    setView(profile ? renderProfile(profile) : renderEmpty());
  } catch (e) {
    const msg =
      e.message === "unauthorized"
        ? "Не удалось подтвердить, что это ты. Открой мини-апп кнопкой из чата с ботом."
        : e.message === "no-init-data"
          ? "Эту страницу нужно открывать из Telegram — кнопкой «Мой профиль»."
          : "Не получилось дотянуться до профиля. Попробуй чуть позже.";
    setView(stateView("Не сейчас", msg, "✦"));
  }
}

main();
