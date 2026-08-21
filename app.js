"use strict";

// Mini App личного пути. Получает профиль по подписанному Telegram initData.
// Секретов на фронте нет: подпись проверяет бэкенд, он же владеет хранилищем.

const tg = window.Telegram ? window.Telegram.WebApp : null;

const STATUS_LABELS = {
  emerging: "намёк",
  working: "гипотеза",
  confirmed_by_user: "подтверждено",
};

// Уверенность гипотезы показана и знаком, и человеческой подписью: цвет не является
// единственным носителем смысла.
const CONFIDENCE_MOON = {
  low: { shift: 3.5, cap: "едва проявлено" },
  medium: { shift: 9, cap: "проявляется" },
  high: { shift: 15, cap: "ясно видно" },
};

// «Что это» — короткая расшифровка юнгианской рабочей линзы. Это метафоры для
// самонаблюдения, а не устройство психики, диагноз или причинное объяснение.
// Пользователь решает, помогает ли линза заметить что-то в реальной ситуации.
const FACET_GUIDE = {
  life_context: {
    glyph: "✦",
    guide:
      "Контекстная линза: обстоятельства, роли и переходы, на фоне которых можно проверять остальные гипотезы.",
  },
  patterns: {
    glyph: "∞",
    guide:
      "Рабочая линза для поиска сходства между реакциями и выборами. Повтор считается значимым только там, где ты узнаёшь его на конкретных примерах.",
  },
  fears: {
    glyph: "▲",
    guide:
      "Линза для исследования того, что страх защищает или ограничивает. Его смысл нельзя определить без твоего опыта и конкретной ситуации.",
  },
  childhood_wounds: {
    glyph: "✶",
    guide:
      "Линза для проверки возможной связи между ранним опытом и нынешней реакцией. Такая связь является гипотезой, а не установленной причиной.",
  },
  persona: {
    glyph: "◐",
    guide:
      "Юнгианская метафора социальных ролей и ожиданий. Помогает заметить, где выбранная роль поддерживает тебя, а где расходится с твоими потребностями.",
  },
  shadow: {
    glyph: "●",
    guide:
      "Юнгианская метафора качеств и чувств, которые трудно признавать своими. Она приглашает к проверке без стыда, но ничего не доказывает о тебе.",
  },
  anima_animus: {
    glyph: "☽",
    guide:
      "Историческая юнгианская метафора внутренних качеств, которые культура связывала с полом. Здесь мы используем её гендерно-нейтрально: как способ исследовать непривычные качества и ожидания в отношениях.",
  },
  self: {
    glyph: "◎",
    guide:
      "Юнгианская метафора большей целостности: возможности удерживать разные стороны себя и выбирать направление без требования стать «идеальным».",
  },
  mother_complex: {
    glyph: "⊕",
    guide:
      "Рабочая линза для проверки того, как опыт заботы мог отразиться на близости, границах и зависимости. Это не диагноз и не обвинение матери.",
  },
  father_complex: {
    glyph: "⊙",
    guide:
      "Рабочая линза для проверки того, как опыт авторитета мог отразиться на правилах, признании и самостоятельности. Это не диагноз и не обвинение отца.",
  },
};

// Расшифровки архетипов по имени (extraction пишет свободные имена — матчим мягко).
const ARCHETYPE_GUIDE = [
  [/трикстер/i, "Нарушитель правил и хитрец. Ломает застывший порядок, чтобы освободить место живому."],
  [/геро/i, "Тот, кто выходит навстречу испытанию. Сила — в преодолении; риск — не уметь останавливаться."],
  [/мудрец|сенекс|стар(ец|ик)/i, "Ищущий смысл и видящий целое. Опора в хаосе; риск — спрятаться в голове от жизни."],
  [/puer|вечн(ый|ая)/i, "Вечный юноша: полёт, возможности, нелюбовь к ограничениям. Дар лёгкости — и трудность укоренения."],
  [/велик(ая|ой) мат|мать/i, "Питающее и оберегающее начало. В светлой стороне — забота; в тёмной — удержание и поглощение."],
  [/странник|путник|искатель/i, "Идущий своим путём. Дом — дорога; риск — вечно уходить вместо того, чтобы приходить."],
  [/тень/i, "Отвергнутое и вытесненное, ставшее фигурой. Пугает — и хранит запертую энергию."],
  [/анимус/i, "Внутреннее мужское: решимость, слово, структура — как оно звучит в тебе."],
  [/анима/i, "Внутреннее женское: чувство, образ, связь с глубиной — как оно звучит в тебе."],
  [/сирот/i, "Знающий покинутость. Ищет принадлежность; дар — эмпатия к чужой боли."],
  [/творец|художник/i, "Претворяющий внутреннее в форму. Живёт, когда создаёт; страдает, когда копирует."],
  [/правитель|король|королев/i, "Держащий порядок и ответственность. Светлая сторона — опора; тёмная — контроль."],
];
const ARCHETYPE_FALLBACK =
  "Архетип здесь — метафорический образ для самонаблюдения. Его полезность определяешь ты по собственным ассоциациям.";

// Рамка работы с привычкой (/habit): привычка — не враг, а служение потребности.
// Никаких стриков и стыда — срыв здесь материал, а не провал.
const HABIT_GUIDE =
  "Привычка здесь — не враг и не слабость: она служит какой-то настоящей потребности. " +
  "В этой работе мы вслушиваемся, чему именно, — и ищем ритуал замещения, который кормит " +
  "ту же потребность честнее. Срыв — не провал, а материал для следующего шага.";

function archetypeGuide(name) {
  for (const [re, text] of ARCHETYPE_GUIDE) {
    if (re.test(name || "")) return text;
  }
  return ARCHETYPE_FALLBACK;
}

function pluralRu(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function labelSection(section, id, text, className) {
  const heading = el("h2", className, text);
  heading.id = id;
  section.setAttribute("aria-labelledby", id);
  section.appendChild(heading);
  return heading;
}

function setView(node) {
  const app = document.getElementById("app");
  const initialRender =
    app.getAttribute("aria-busy") === "true" || Boolean(app.querySelector('[aria-busy="true"]'));
  app.replaceChildren(node);
  app.setAttribute("aria-busy", "false");
  const heading = node.querySelector && node.querySelector("[data-view-heading]");
  const focusState = node.classList && node.classList.contains("state");
  if (heading && (initialRender || focusState)) queueMicrotask(() => heading.focus());
}

function stateView(title, sub, glyph, actions, kind) {
  const wrap = el("section", "state");
  wrap.setAttribute("role", kind === "error" ? "alert" : "status");
  wrap.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  wrap.appendChild(el("div", "glyph", glyph || "✦"));
  const heading = el("h1", "state-title serif", title);
  heading.tabIndex = -1;
  heading.dataset.viewHeading = "true";
  wrap.appendChild(heading);
  if (sub) wrap.appendChild(el("p", "state-sub", sub));
  if (actions && actions.length) {
    const row = el("div", "state-actions");
    actions.forEach((action, index) => {
      const btn = el("button", index ? "state-action state-action--quiet" : "state-action", action.label);
      btn.type = "button";
      btn.addEventListener("click", action.onClick);
      row.appendChild(btn);
    });
    wrap.appendChild(row);
  }
  return wrap;
}

// --- сеть -------------------------------------------------------------------

function apiHeaders(initData, withJson) {
  const headers = {
    Authorization: "tma " + initData,
  };
  if (withJson) headers["Content-Type"] = "application/json";
  return headers;
}

function freshApiUrl(path) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const sep = path.includes("?") ? "&" : "?";
  return base.replace(/\/$/, "") + path + sep + "ts=" + Date.now();
}

const NETWORK_TIMEOUT_MS = 10000;

async function fetchWithDeadline(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(options || {}), signal: controller.signal });
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error("timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayOfObjects(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

const DEEP_SESSION_STATUSES = new Set([
  "preparing",
  "active",
  "integrating",
  "completed",
  "aborted",
]);
const DEEP_SESSION_STAGES = new Set([
  "prepare",
  "intention",
  "explore",
  "integrate",
  "confirm",
]);

// Raw dialogue and safety flags stay on the backend. Any model interpretation that is
// present in the result is rendered separately and explicitly labelled as a hypothesis.
function normalizeDeepSessions(value) {
  const block = objectOrEmpty(value);
  const summary = objectOrEmpty(block.summary);
  const cleanText = (text) => (typeof text === "string" ? text.trim() : "");
  const exactContract = Array.isArray(value);
  const source = (exactContract ? arrayOfObjects(value) : arrayOfObjects(block.recent)).slice(0, 5);
  const recent = source
    .map((item) => {
      const result = objectOrEmpty(item.result);
      return {
        id: cleanText(item.id),
        status: exactContract
          ? "completed"
          : (DEEP_SESSION_STATUSES.has(item.status) ? item.status : ""),
        stage: exactContract
          ? "confirm"
          : (DEEP_SESSION_STAGES.has(item.stage) ? item.stage : ""),
        intention: cleanText(item.intention),
        started_at: cleanText(item.started_at),
        ended_at: cleanText(item.ended_at),
        follow_up_at: cleanText(item.follow_up_at),
        result: {
          takeaway: cleanText(result.takeaway),
          title: cleanText(result.title),
          user_words: Array.isArray(result.user_words)
            ? result.user_words.map(cleanText).filter(Boolean).slice(0, 3)
            : [],
          model_hypothesis: cleanText(result.model_hypothesis),
          uncertainty: cleanText(result.uncertainty),
          next_step: cleanText(result.next_step),
          follow_up_at: cleanText(result.follow_up_at),
          check_in_days: Math.max(0, Number(result.check_in_days) || 0),
          check_in_on: cleanText(result.check_in_on),
          closing_question: cleanText(result.closing_question),
        },
      };
    })
    .filter((item) => item.id && item.status);
  const completed = recent.filter((item) => item.status === "completed").length;
  const lastCompleted = recent.find((item) => item.status === "completed");
  return {
    summary: {
      total: Math.max(0, Number(summary.total) || recent.length),
      completed: Math.max(0, Number(summary.completed) || completed),
      last_completed_at: cleanText(summary.last_completed_at) ||
        (lastCompleted ? lastCompleted.ended_at : ""),
    },
    recent,
  };
}

function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = { ...raw };
  const completeness = objectOrEmpty(p.completeness);
  p.completeness = {
    percent: Number.isFinite(Number(completeness.percent)) ? Number(completeness.percent) : 0,
    is_sufficient: Boolean(completeness.is_sufficient),
    missing: Array.isArray(completeness.missing) ? completeness.missing.filter((x) => typeof x === "string") : [],
  };
  p.sections = arrayOfObjects(p.sections);
  p.archetypes = arrayOfObjects(p.archetypes);
  p.habits = arrayOfObjects(p.habits);
  p.memories = arrayOfObjects(p.memories);
  p.threads = arrayOfObjects(p.threads).map((thread) => ({
    ...thread,
    members: arrayOfObjects(thread.members),
  }));
  p.billing = objectOrEmpty(p.billing);
  p.access = objectOrEmpty(p.access);
  p.path = objectOrEmpty(p.path);
  p.change_experiment = objectOrEmpty(p.change_experiment);
  p.outcome_prompts = objectOrEmpty(p.outcome_prompts);
  p.outcome_feedback = arrayOfObjects(p.outcome_feedback).map((item) => ({
    event: typeof item.event === "string" ? item.event : "",
    value: typeof item.value === "string" ? item.value : "",
    measurement_point: typeof item.measurement_point === "string"
      ? item.measurement_point
      : "",
    subject_key: typeof item.subject_key === "string" ? item.subject_key : "",
  })).filter((item) => item.event && item.value && item.measurement_point && item.subject_key);
  p.ritual = objectOrEmpty(p.ritual);
  p.live_sync = objectOrEmpty(p.live_sync);
  p.referral = objectOrEmpty(p.referral);
  p.deep_sessions = normalizeDeepSessions(p.deep_sessions);
  p.is_paid = Boolean(p.is_paid);
  p.show_upgrade = Boolean(p.show_upgrade);
  return p;
}

async function fetchProfile(refreshOnly) {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");

  const path = refreshOnly ? "/api/profile?refresh=1" : "/api/profile";
  const res = await fetchWithDeadline(freshApiUrl(path), {
    headers: apiHeaders(initData, false),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  return normalizeProfile((await res.json()).profile); // null, если профиля ещё нет
}

// Отклонить гипотезу («это не про меня»). Бэкенд метит раздел dismissed: он выпадает
// из профиля и больше не предлагается моделью. Возвращает обновлённый профиль.
async function dismissSection(key) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");

  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/profile/dismiss", {
    method: "POST",
    headers: apiHeaders(initData, true),
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error("http-" + res.status);
  await res.json();
  return fetchProfile(true);
}

// Удалить один подтверждённый факт по opaque key, который бэкенд уже вернул владельцу.
async function forgetMemory(key) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");

  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/memory/forget", {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ key }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  await res.json();
  return fetchProfile(true);
}

async function deleteDeepSession(sessionId) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/deep-session/delete", {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  const body = await res.json();
  if (!body || body.deleted !== true) throw new Error("invalid-response");
  return fetchProfile(true);
}

async function submitOutcome(event, value, measurementPoint, subjectKey) {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(freshApiUrl("/api/outcomes"), {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({
      event,
      value,
      measurement_point: measurementPoint,
      subject_key: subjectKey,
    }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  return res.json();
}

function newRequestId() {
  const cryptoApi = window.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return (
    "topic_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  ).slice(0, 80);
}

async function postChatIntent(topicKey, requestId) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/chat-intent", {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ topic_key: topicKey, request_id: requestId }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  const body = await res.json();
  if (!body || body.status !== "ready") throw new Error("invalid-response");
  return body;
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

function announceAction(message) {
  const region = document.getElementById("action-status");
  if (!region) return;
  region.textContent = "";
  queueMicrotask(() => {
    region.textContent = message;
  });
}

// --- кусочки UI -------------------------------------------------------------


function stat(value, label) {
  const s = el("div", "stat");
  s.appendChild(el("div", "stat-val", String(value)));
  s.appendChild(el("div", "stat-label", label));
  return s;
}

function confidence(level) {
  // Луна-уверенность: золотой диск, из-за которого уходит тень. Чем увереннее
  // гипотеза, тем больше диска «вышло из тени». Подпись — человеческим языком.
  const m = CONFIDENCE_MOON[level];
  const wrap = el("span", "conf");
  wrap.title = "насколько гипотеза проявилась в наших разговорах";
  const moon = el("span", "moon");
  const shift = m ? m.shift : 0;
  const clipId = "mc" + Math.random().toString(36).slice(2, 8);
  moon.innerHTML = `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <defs><clipPath id="${clipId}"><circle cx="10" cy="10" r="8.5" /></clipPath></defs>
      <circle cx="10" cy="10" r="8.5" fill="currentColor" />
      <circle cx="${(10 - shift).toFixed(1)}" cy="10" r="8.5" fill="var(--surface)" clip-path="url(#${clipId})" />
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1" />
    </svg>`;
  wrap.appendChild(moon);
  wrap.appendChild(el("span", "conf-cap", m ? m.cap : "уверенность —"));
  return wrap;
}

function guideBlock(title, text) {
  // Обучающий слой «что это» — нативный <details>: компактно, доступно, без JS.
  const d = el("details", "card-guide");
  const s = el("summary", "card-guide-q", title);
  d.appendChild(s);
  d.appendChild(el("p", "card-guide-a", text));
  return d;
}

function insightCard(item) {
  const card = el("article", "card");
  if (item.user_confirmed) card.classList.add("card--confirmed");

  const isArchetype = !item.key;
  const facet = item.key ? FACET_GUIDE[item.key] : null;
  const title = item.label || item.name;

  const head = el("div", "card-head");
  const heading = el("div", "card-heading");
  const glyph = el("span", "facet-glyph", isArchetype ? "✧" : facet ? facet.glyph : "✦");
  heading.appendChild(glyph);
  heading.appendChild(el("h3", "card-title", title));
  head.appendChild(heading);
  const st = el("span", "pill pill--status", STATUS_LABELS[item.status] || item.status);
  st.dataset.status = item.status;
  head.appendChild(st);
  card.appendChild(head);

  // (б) что это такое по Юнгу — раскрывается по касанию, не съедая экран
  const guideText = isArchetype ? archetypeGuide(item.name) : facet ? facet.guide : null;
  if (guideText) {
    card.appendChild(guideBlock(isArchetype ? "Что это за архетип?" : "Что это — " + title + "?", guideText));
  }

  // (в) персональная гипотеза — с явной эпистемической рамкой в самом ярлыке
  card.appendChild(
    el("div", "hyp-label", item.user_confirmed ? "гипотеза, подтверждённая тобой" : "гипотеза о тебе"),
  );
  card.appendChild(el("p", "card-summary", item.summary));

  // (г) уверенность + опора на наши разговоры
  const meta = el("div", "card-meta");
  meta.appendChild(confidence(item.confidence));
  if (item.evidence_count) {
    const n = item.evidence_count;
    meta.appendChild(
      el(
        "span",
        "tag-evidence",
        "опора: " + n + " " + pluralRu(n, "наблюдение", "наблюдения", "наблюдений") + " из разговоров",
      ),
    );
  }
  if (item.user_confirmed) meta.appendChild(el("span", "pill pill--ok", "✓ ты подтвердил"));
  card.appendChild(meta);

  // «Это не про меня» — только для insight-разделов (у них есть key); архетипы без key.
  // Профиль обязан уметь ошибаться: человек вправе снять гипотезу, и она не вернётся.
  if (item.key) card.appendChild(dismissRow(item.key, item.label));
  return card;
}

// Поле карточки привычки: подписанный блок «чему служит» / «ритуал замещения».
function habitField(label, text, extraClass) {
  const box = el("div", "habit-field" + (extraClass ? " " + extraClass : ""));
  box.appendChild(el("div", "habit-field-label", label));
  box.appendChild(el("p", "habit-field-text", text));
  return box;
}

// Карточка привычки: {триггер, потребность, замена, минимальная версия, прогресс}.
// Прогресс — луна-уверенность + опора наблюдений, НЕ стрики (бот — спутник, не надзиратель).
function habitCard(item) {
  const card = el("article", "card");
  if (item.user_confirmed) card.classList.add("card--confirmed");

  const head = el("div", "card-head");
  const heading = el("div", "card-heading");
  heading.appendChild(el("span", "facet-glyph", "⟳"));
  heading.appendChild(el("h3", "card-title", item.name));
  head.appendChild(heading);
  const st = el("span", "pill pill--status", STATUS_LABELS[item.status] || item.status);
  st.dataset.status = item.status;
  head.appendChild(st);
  card.appendChild(head);

  card.appendChild(guideBlock("Что это — работа с привычкой?", HABIT_GUIDE));

  card.appendChild(
    el("div", "hyp-label", item.user_confirmed ? "гипотеза, подтверждённая тобой" : "гипотеза о тебе"),
  );
  card.appendChild(el("p", "card-summary", item.summary));

  if (item.trigger) card.appendChild(habitField("когда включается", item.trigger));
  if (item.serves) card.appendChild(habitField("чему служит", item.serves));
  if (item.ritual) card.appendChild(habitField("ритуал замещения", item.ritual, "habit-field--ritual"));
  if (item.fallback) card.appendChild(habitField("минимум на трудный день", item.fallback));

  const meta = el("div", "card-meta");
  meta.appendChild(confidence(item.confidence));
  if (item.evidence_count) {
    const n = item.evidence_count;
    meta.appendChild(
      el(
        "span",
        "tag-evidence",
        "опора: " + n + " " + pluralRu(n, "наблюдение", "наблюдения", "наблюдений") + " из разговоров",
      ),
    );
  }
  if (item.user_confirmed) meta.appendChild(el("span", "pill pill--ok", "✓ ты подтвердил"));
  card.appendChild(meta);
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
      renderedProfileFingerprint = null;
      renderFetchedProfile(updated);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Не вышло — ещё раз";
    }
  });
  row.appendChild(btn);
  return row;
}

// Блок «что изменилось с прошлого визита». d приходит в payload.dynamics с бэкенда:
// первый визит → тёплое приветствие; есть изменения → дельта глубины + новые грани;
// без изменений → мягкое приглашение продолжить в чате. Содержания тут нет — только
// числа и ярлыки граней (152-ФЗ: бэкенд не отдаёт сюда summary/evidence).
// Спарклайн глубины во времени. history — ряд точек {at, score} с бэкенда (только числа
// и даты, без психо-контента — 152-ФЗ). Рисуем мягкую линию роста: осязаемый прогресс
// = причина возвращаться. Нужно ≥2 точек, иначе линию не построить.
function dynamicsBlock(d) {
  if (!d) return null;
  const sec = el("section", "dynamics");
  labelSection(sec, "dynamics-heading", "С прошлого визита", "dynamics-label");

  if (d.is_first_view) {
    sec.appendChild(
      el("p", "dynamics-text", "Это первый снимок твоего образа. В следующий раз покажу, что в нём изменилось."),
    );
  } else if (!d.has_changes) {
    // Без изменений — блока нет (08.07): вечный текст-заполнитель хуже, чем ничего.
    // Блок появляется, только когда ему есть что сказать (дельта/новые грани).
    return null;
  } else {
    const newItems = [
      ...(d.new_sections || []),
      ...(d.new_archetypes || []),
      ...(d.new_habits || []),
    ];
    const refinedItems = [
      ...(d.updated_sections || []),
      ...(d.updated_archetypes || []),
    ];
    const summary = el("div", "dynamics-summary");
    summary.setAttribute("aria-live", "polite");
    if (d.delta_percent) {
      const up = d.delta_percent > 0;
      const pill = el("span", "delta" + (up ? " delta--up" : " delta--down"));
      pill.textContent = (up ? "+" : "−") + Math.abs(d.delta_percent) + "% к полноте образа";
      summary.appendChild(pill);
    }
    let message = "Образ обновился после последних разговоров.";
    if (newItems.length && refinedItems.length) {
      message = "Появилось новое и стали точнее уже знакомые части образа.";
    } else if (newItems.length) {
      message = "В образе проявилось " + newItems.length + " " + pluralRu(newItems.length, "новое направление", "новых направления", "новых направлений") + ".";
    } else if (refinedItems.length) {
      message = refinedItems.length + " " + pluralRu(refinedItems.length, "часть образа стала", "части образа стали", "частей образа стали") + " точнее.";
    }
    summary.appendChild(el("p", "dynamics-title", message));
    sec.appendChild(summary);

    const allItems = [...newItems, ...refinedItems];
    if (allItems.length) {
      const preview = el("p", "dynamics-preview", allItems.slice(0, 3).join(" · "));
      sec.appendChild(preview);
    }

    if (allItems.length > 3) {
      const details = el("details", "dynamics-details");
      const more = el("summary", "dynamics-more", "Показать все изменения (" + allItems.length + ")");
      details.appendChild(more);
      const list = el("ul", "dynamics-list");
      newItems.forEach((name) => {
        const item = el("li", "dynamics-item");
        item.appendChild(el("span", "dynamics-kind", "Новое"));
        item.appendChild(document.createTextNode(name));
        list.appendChild(item);
      });
      refinedItems.forEach((name) => {
        const item = el("li", "dynamics-item");
        item.appendChild(el("span", "dynamics-kind dynamics-kind--refined", "Точнее"));
        item.appendChild(document.createTextNode(name));
        list.appendChild(item);
      });
      details.appendChild(list);
      sec.appendChild(details);
    }
  }
  return sec;
}

// Карточка «позвать близкого»: оффер цифрами + прогресс + нативный share-лист Telegram
// с реф-ссылкой юзера (payload.invite_url). ВАЖНО (152-ФЗ): текст обезличен — ни граней,
// ни ID приглашённых; статистика — СОБСТВЕННЫЕ агрегаты юзера (сколько привёл/заработал).
function shareRow(referral, inviteUrl) {
  const r = referral || {};
  const days = r.reward_days || 14;
  const bonus = r.bonus_messages || 5;
  const daysWord = pluralRu(days, "день", "дня", "дней");
  const sec = el("section", "referral");
  sec.appendChild(el("div", "referral-label", "Расти вместе"));
  // Оффер в заголовке — ценность цифрами перед глазами, а не абстрактно «бонусные дни».
  sec.appendChild(el("h2", "referral-title serif", "Позови близкого — тебе +" + days + " " + daysWord));

  // Прогресс показываем, только когда уже кто-то приглашён: ценность уже осязаема.
  if (r.invited) {
    const stats = el("div", "referral-stats");
    stats.appendChild(stat(r.invited, "приглашено"));
    stats.appendChild(stat(r.rewarded || 0, "оформили подписку"));
    stats.appendChild(stat("+" + (r.earned_days || 0), "дней тебе"));
    sec.appendChild(stats);
  }

  sec.appendChild(
    el(
      "p",
      "referral-text",
      r.rewarded
        ? "Спасибо, что делишься путём. Когда останется ещё один близкий — тебе снова +" + days + " " + daysWord + "."
        : "Близкому откроется 7-дневный маршрут и +" + bonus + " дополнительных ответов. После его первой оплаты тебе +" + days + " " + daysWord + " подписки.",
    ),
  );

  const btn = el("button", "share-btn", "Позвать близкого");
  btn.type = "button";
  btn.addEventListener("click", () => {
    const text =
      "Я прохожу 7-дневный маршрут с ИИ-проводником: замечаю повторяющиеся сценарии и проверяю маленькие шаги в жизни. Тебе по моей ссылке дадут +" + bonus + " ответов 🌑";
    const link = "https://t.me/share/url?url=" + encodeURIComponent(inviteUrl) + "&text=" + encodeURIComponent(text);
    if (tg && typeof tg.openTelegramLink === "function") tg.openTelegramLink(link);
    else window.open(link, "_blank");
  });
  sec.appendChild(btn);
  return sec;
}

// Запросить у бэкенда нативную ссылку на Telegram Stars invoice.
async function requestInvoice(period) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/invoice", {
    method: "POST",
    headers: apiHeaders(initData, true),
    body: JSON.stringify({ period: period || "monthly" }),
  });
  if (!res.ok) throw new Error("http-" + res.status);
  return (await res.json()).url;
}

// Оплата прямо из мини-аппа: человек увидел свой образ → открывает нативный Stars invoice.
// Telegram.WebApp.openInvoice даёт статус закрытия, после успешной оплаты перечитываем
// профиль. Fallback открывает invoice link обычным способом на старых клиентах.
function setPaymentFeedback(node, message, kind) {
  if (!node) return;
  node.textContent = message || "";
  node.dataset.kind = kind || "info";
  node.hidden = !message;
}

function lockUpgradeButtons(locked) {
  document.querySelectorAll(".upgrade-btn").forEach((button) => {
    button.disabled = locked;
  });
}

function startUpgrade(btn, period, feedback) {
  const original = btn.textContent;
  lockUpgradeButtons(true);
  btn.setAttribute("aria-busy", "true");
  btn.textContent = "Открываю оплату…";
  setPaymentFeedback(feedback, "", "info");
  const restore = () => {
    lockUpgradeButtons(false);
    btn.removeAttribute("aria-busy");
    btn.textContent = original;
  };
  requestInvoice(period)
    .then((url) => {
      if (tg && typeof tg.openInvoice === "function") {
        tg.openInvoice(url, (status) => {
          if (status === "paid") {
            activationPending = true;
            clearRefreshTimer();
            setView(
              stateView(
                "Платёж получен",
                "Активирую подписку. Обычно это занимает несколько секунд.",
                "✦",
              ),
            );
            pollForActivation();
            return;
          }
          restore();
          if (status === "failed") {
            setPaymentFeedback(
              feedback,
              "Платёж не прошёл. Stars не списаны. Проверь баланс и попробуй ещё раз.",
              "error",
            );
          } else if (status === "pending") {
            setPaymentFeedback(
              feedback,
              "Telegram ещё обрабатывает платёж. Подожди немного и обнови профиль из чата.",
              "pending",
            );
          } else if (status === "cancelled") {
            setPaymentFeedback(feedback, "Оплата отменена. Тариф можно выбрать позже.", "info");
          } else {
            setPaymentFeedback(feedback, "Статус оплаты не изменился. Можно повторить.", "info");
          }
        });
      } else if (tg && typeof tg.openTelegramLink === "function") {
        tg.openTelegramLink(url);
        restore();
      } else {
        window.open(url, "_blank");
        restore();
      }
    })
    .catch(() => {
      restore();
      setPaymentFeedback(
        feedback,
        "Не получилось открыть оплату. Проверь связь и повтори или отправь /upgrade в чате.",
        "error",
      );
    });
}

// После успешного Stars invoice слегка поллим профиль: successful_payment может прийти
// в long-polling на секунду позже callback Mini App.
function pollForActivation() {
  activationPending = true;
  let attempts = 0;
  const tick = async () => {
    attempts += 1;
    try {
      const profile = await fetchProfile(true);
      if (profile && profile.is_paid) {
        activationPending = false;
        if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === "function")
          tg.HapticFeedback.notificationOccurred("success");
        setView(
          stateView(
            "Подписка активна",
            "Спасибо 🌑 Возвращайся в чат: продолжим твой путь без пауз, с того места, где остановились.",
            "✦",
            [{ label: "Вернуться в чат", onClick: closeToChat }],
          ),
        );
        return; // готово — поллинг прекращаем
      }
    } catch (e) {
      /* сеть моргнула — попробуем на следующем тике */
    }
    if (attempts < 18) {
      setTimeout(tick, 10000); // ~3 минуты ждём завершения оплаты
      return;
    }
    setView(
      stateView(
        "Проверим оплату ещё раз",
        "Telegram принял платёж, но активация задержалась. Обнови статус или вернись в чат и напиши /paysupport.",
        "○",
        [
          { label: "Обновить статус", onClick: pollForActivation },
          { label: "Вернуться в чат", onClick: closeToChat },
        ],
        "error",
      ),
    );
    activationPending = false;
  };
  setTimeout(tick, 8000); // первая проверка — после возможной быстрой оплаты
}

// Панель подписки (только для free): после показа реального образа продаём переход
// от понимания к действию, а память делает этот путь непрерывным. Существующие грани не прячем (это данные юзера,
// 152-ФЗ «ты хозяин данных») — показываем, что открывает подписка, и кнопку оплаты.
function upgradeSection(billing, access) {
  const sec = el("section", "upgrade");
  sec.appendChild(el("div", "upgrade-label", "Полный доступ"));
  sec.appendChild(el("h2", "upgrade-title serif", "Продолжать путь без пауз"));
  sec.appendChild(
    el(
      "p",
      "upgrade-text",
      "Подписка сохраняет непрерывность: замечаем сценарий, выбираем шаг, проверяем его " +
        "в жизни и спокойно корректируем. Твой уже собранный образ остаётся доступен и без оплаты.",
    ),
  );
  const perks = el("ul", "upgrade-perks");
  [
    "Разговоры без дневного лимита после пробного маршрута",
    "Память о согласованных шагах и о том, что уже помогло",
    "Глубинные сессии с подготовкой и сохранённым тобой итогом",
    "Разборы снов и работа с привычками",
    "Бережные напоминания между разговорами",
  ].forEach((t) => {
    const li = el("li", "upgrade-perk");
    li.appendChild(el("span", "perk-mark", "✓"));
    li.appendChild(el("span", "perk-text", t));
    perks.appendChild(li);
  });
  sec.appendChild(perks);
  const b = billing || {};
  const monthly = Number(b.monthly_xtr) || 500;
  const annual = Number(b.annual_xtr) || 5000;
  const annualAvailable = b.annual_available !== false;
  if (b.payments_available === false) {
    const closed = el("div", "checkout-closed");
    closed.appendChild(el("strong", null, "Новое оформление временно закрыто"));
    closed.appendChild(
      el(
        "p",
        null,
        "Бесплатный маршрут работает. Если платёж уже был или нужен доступ, напиши /paysupport в чате.",
      ),
    );
    const terms = el("dl", "checkout-closed-terms");
    [["30 дней", monthly + " Stars"], ["365 дней", annual + " Stars · разово"]].forEach(
      ([period, price]) => {
        const row = el("div", "checkout-closed-term");
        row.appendChild(el("dt", null, period));
        row.appendChild(el("dd", null, price));
        terms.appendChild(row);
      },
    );
    closed.appendChild(terms);
    closed.appendChild(
      el(
        "p",
        "checkout-closed-note",
        "Не покупай Stars специально для MindCoach, пока оформление закрыто. После открытия их можно будет пополнить через @PremiumBot и сверить сумму в счёте Telegram.",
      ),
    );
    const status = el("p", "command-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    closed.appendChild(commandAction("/paysupport", "Скопировать /paysupport", status));
    closed.appendChild(status);
    sec.appendChild(closed);
    return sec;
  }
  const plans = el("div", "upgrade-plans");
  const feedback = el("p", "payment-feedback");
  feedback.hidden = true;
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  const btn = el(
    "button",
    "upgrade-btn",
    "30 дней · " + monthly + " ⭐",
  );
  btn.type = "button";
  btn.addEventListener("click", () => startUpgrade(btn, "monthly", feedback));
  plans.appendChild(btn);
  if (annualAvailable) {
    const ybtn = el(
      "button",
      "upgrade-btn upgrade-btn-annual",
      "365 дней · " + annual + " ⭐",
    );
    ybtn.type = "button";
    ybtn.appendChild(el("span", "upgrade-saving", "цена десяти месяцев"));
    ybtn.addEventListener("click", () => startUpgrade(ybtn, "annual", feedback));
    plans.appendChild(ybtn);
  }
  sec.appendChild(plans);
  sec.appendChild(feedback);
  const guide = el("div", "stars-guide");
  guide.appendChild(el("strong", "stars-guide-title", "Как купить Stars"));
  const steps = el("ol", "stars-guide-steps");
  [
    "Открой @PremiumBot и нажми /start.",
    "Выбери «Звёзды Telegram».",
    "Пополни баланс минимум на " + monthly + " ⭐ для месяца" +
      (annualAvailable ? " или " + annual + " ⭐ для года." : "."),
    "Проверь рублёвую цену у платёжного провайдера.",
    "Вернись сюда, выбери тариф и сверь сумму в счёте Telegram.",
  ].forEach((instruction) => steps.appendChild(el("li", null, instruction)));
  guide.appendChild(steps);
  const premiumBtn = el("button", "premiumbot-btn", "Купить Stars в @PremiumBot");
  premiumBtn.type = "button";
  premiumBtn.addEventListener("click", () => {
    const url = "https://t.me/PremiumBot";
    if (tg && typeof tg.openTelegramLink === "function") tg.openTelegramLink(url);
    else window.open(url, "_blank");
  });
  guide.appendChild(premiumBtn);
  guide.appendChild(
    el(
      "p",
      "stars-guide-note",
      "Доступные пакеты и способы оплаты зависят от клиента Telegram и региона.",
    ),
  );
  sec.appendChild(guide);
  sec.appendChild(
    el(
      "p",
      "upgrade-hint",
      annualAvailable
        ? "Месяц продлевается каждые 30 дней. Год оплачивается один раз на 365 дней."
        : "Месяц продлевается каждые 30 дней. Отменить можно в настройках Telegram.",
    ),
  );
  return sec;
}

function groupBlock(title, items, sub) {
  const sec = el("section", "group");
  sec.appendChild(el("h2", "group-title", title));
  if (sub) sec.appendChild(el("p", "group-sub", sub));
  items.forEach((it) => sec.appendChild(insightCard(it)));
  return sec;
}

// --- блок «Сегодня» ---------------------------------------------------------

const CHANGE_EXPERIMENT_STATUSES = new Set([
  "planned",
  "attempted",
  "adjusted",
  "completed",
  "paused",
]);

function dateOnlyParts(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) return null;
  return { key: value, year, month, day };
}

function localDateKey(now) {
  const date = now || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function fmtDateOnly(value) {
  const parsed = dateOnlyParts(value);
  if (!parsed) return null;
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return parsed.day + " " + months[parsed.month - 1];
}

function changeExperimentView(raw) {
  const experiment = objectOrEmpty(raw);
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const action = text(experiment.action);
  const trigger = text(experiment.trigger);
  const fallback = text(experiment.fallback);
  const successSignal = text(experiment.success_signal);
  const outcome = text(experiment.outcome);
  const learning = text(experiment.learning);
  const measurementKey = text(experiment.measurement_key);
  const status = CHANGE_EXPERIMENT_STATUSES.has(experiment.status)
    ? experiment.status
    : "";
  if (!action || !status) return null;

  const today = localDateKey();
  const planned = dateOnlyParts(experiment.planned_for);
  const checkIn = dateOnlyParts(experiment.check_in_on);
  let state = "Шаг согласован";
  let next = action;
  let cta = "Вернуться к плану";

  if (status === "attempted") {
    state = "Опыт уже есть";
    next = outcome
      ? "Ты отметил: " + outcome + " Разберём, что из этого взять дальше."
      : "Расскажи, что фактически получилось, а что оказалось трудным.";
    cta = "Разобрать результат";
  } else if (status === "adjusted") {
    state = "План скорректирован";
    next = action;
    cta = "Продолжить с поправкой";
  } else if (status === "completed") {
    state = "Эксперимент завершён";
    next = learning
      ? "Ты заметил: " + learning
      : "Выбери, что хочется сохранить или проверить следующим.";
    cta = "Выбрать следующий шаг";
  } else if (status === "paused") {
    state = "Пауза тоже часть пути";
    next = "Можно оставить этот шаг или уменьшить его без стыда и гонки.";
    cta = "Пересобрать без давления";
  } else if (checkIn && checkIn.key <= today) {
    state = "Время сверить результат";
    next = "Что фактически произошло с шагом: «" + action + "»?";
    cta = "Отметить, что получилось";
  } else if (planned && planned.key < today) {
    state = "Шаг ждёт честной сверки";
    next = "Получилось попробовать «" + action + "» или контекст оказался другим?";
    cta = "Рассказать без оценки";
  } else if (planned && planned.key === today) {
    state = "Маленький шаг на сегодня";
  } else if (planned) {
    state = "Шаг на " + fmtDateOnly(planned.key);
  }

  const details = [];
  if (trigger) details.push(["Когда", trigger]);
  if (fallback) details.push(["Минимум", fallback]);
  if (successSignal) details.push(["Признак", successSignal]);
  if (checkIn) details.push(["Сверка", fmtDateOnly(checkIn.key)]);
  if (status !== "attempted" && outcome) {
    details.push(["Что произошло", outcome]);
  }
  if (status !== "completed" && learning) {
    details.push(["Что берём дальше", learning]);
  }
  const feedbackDue = Boolean(
    measurementKey && (
      ["attempted", "adjusted", "completed"].includes(status) ||
      (checkIn && checkIn.key <= today) ||
      (planned && planned.key < today)
    )
  );
  return { state, next, cta, details, measurementKey, feedbackDue };
}

function experimentDetails(rows) {
  if (!rows || !rows.length) return null;
  const list = el("dl", "experiment-grid");
  rows.forEach(([label, value]) => {
    const row = el("div", "experiment-row");
    row.appendChild(el("dt", "experiment-key", label));
    row.appendChild(el("dd", "experiment-value", value));
    list.appendChild(row);
  });
  return list;
}

function existingOutcome(feedback, event, point, subjectKey) {
  return (feedback || []).find((item) =>
    item.event === event &&
    item.measurement_point === point &&
    item.subject_key === subjectKey,
  ) || null;
}

function hasOutcome(feedback, event) {
  return (feedback || []).some((item) => item.event === event);
}

function outcomeQuestion({
  label,
  event,
  point,
  subjectKey,
  options,
  feedback,
}) {
  const group = el("fieldset", "outcome-question");
  const legend = el("legend", "outcome-question-label", label);
  group.appendChild(legend);
  const status = el("p", "outcome-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const saved = existingOutcome(feedback, event, point, subjectKey);
  if (saved) {
    const selected = options.find(([value]) => value === saved.value);
    status.textContent = selected
      ? "Ответ сохранён: " + selected[1].toLocaleLowerCase("ru-RU") + "."
      : "Ответ сохранён.";
    group.appendChild(status);
    return group;
  }

  const buttons = el("div", "outcome-options");
  options.forEach(([value, text]) => {
    const button = el("button", "outcome-option", text);
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", async () => {
      const allButtons = Array.from(buttons.querySelectorAll("button"));
      allButtons.forEach((item) => { item.disabled = true; });
      button.setAttribute("aria-busy", "true");
      status.textContent = "Сохраняю…";
      try {
        await submitOutcome(event, value, point, subjectKey);
        button.removeAttribute("aria-busy");
        button.setAttribute("aria-pressed", "true");
        status.textContent = "Спасибо. Сохранился только этот вариант, без текста разговора.";
        const haptic = tg && tg.HapticFeedback;
        if (haptic && typeof haptic.notificationOccurred === "function") {
          haptic.notificationOccurred("success");
        }
      } catch (_) {
        allButtons.forEach((item) => { item.disabled = false; });
        button.removeAttribute("aria-busy");
        status.textContent = "Не удалось сохранить. Проверь связь и попробуй ещё раз.";
      }
    });
    buttons.appendChild(button);
  });
  group.appendChild(buttons);
  group.appendChild(status);
  return group;
}

function conversationOutcomeBlock(p) {
  const key = typeof p.outcome_prompts.conversation_key === "string"
    ? p.outcome_prompts.conversation_key
    : "";
  const stage = p.path && p.path.activation ? p.path.activation.stage : "";
  const eligible = ["pattern_named", "step_chosen", "outcome_shared", "loop_completed"]
    .includes(stage);
  if (
    !key || !eligible ||
    (p.live_sync && p.live_sync.pending_profile_update) ||
    (hasOutcome(p.outcome_feedback, "conversation_insight") &&
      hasOutcome(p.outcome_feedback, "next_step_clarity"))
  ) return null;

  const section = el("section", "outcome-card");
  labelSection(section, "conversation-outcome-heading", "Короткая сверка", "section-eyebrow");
  section.appendChild(el(
    "p",
    "outcome-intro",
    "Помоги проверить пользу разговора. В аналитику уйдут только выбранные варианты, без текста и темы.",
  ));
  if (!hasOutcome(p.outcome_feedback, "conversation_insight")) {
    section.appendChild(outcomeQuestion({
      label: "Разговор помог увидеть что-то новое?",
      event: "conversation_insight",
      point: "first_result",
      subjectKey: key,
      options: [["yes", "Да"], ["partly", "Частично"], ["no", "Нет"]],
      feedback: p.outcome_feedback,
    }));
  }
  if (!hasOutcome(p.outcome_feedback, "next_step_clarity")) {
    section.appendChild(outcomeQuestion({
      label: "Следующий шаг стал понятнее?",
      event: "next_step_clarity",
      point: "first_result",
      subjectKey: key,
      options: [["clearer", "Понятнее"], ["same", "Так же"], ["less_clear", "Менее ясно"]],
      feedback: p.outcome_feedback,
    }));
  }
  return section;
}

function stepAttemptBlock(p) {
  const experiment = changeExperimentView(p.change_experiment);
  if (!experiment || !experiment.feedbackDue || !experiment.measurementKey) return null;
  const section = el("section", "outcome-card outcome-card--step");
  labelSection(section, "step-outcome-heading", "Фактический результат", "section-eyebrow");
  section.appendChild(el(
    "p",
    "outcome-intro",
    "Любой исход подходит. Это помогает скорректировать план, а не оценить тебя.",
  ));
  section.appendChild(outcomeQuestion({
    label: "Удалось попробовать выбранный шаг?",
    event: "step_attempt",
    point: "change_checkin",
    subjectKey: experiment.measurementKey,
    options: [["done", "Да"], ["partly", "Частично"], ["not_yet", "Пока нет"]],
    feedback: p.outcome_feedback,
  }));
  return section;
}

// Один следующий шаг вместо двух слабых блоков «Сегодня» и «Мой путь».
// Показываем состояние реального цикла изменения, а не общий вопрос ради ежедневности.
function todayBlock(p) {
  const stage = p.path && p.path.activation ? p.path.activation.stage : "";
  const stages = {
    portrait_ready: {
      state: "Образ собран",
      next: "Назови один повторяющийся сценарий, который хочется изменить.",
    },
    pattern_named: {
      state: "Сценарий замечен",
      next: "Выбери маленький шаг, которым можно проверить новое действие.",
    },
    step_chosen: {
      state: "Маленький шаг выбран",
      next: "Попробуй его и вернись рассказать, что получилось или помешало.",
    },
    outcome_shared: {
      state: "Результат отмечен",
      next: "Разбери трудный момент без стыда и скорректируй следующий шаг.",
    },
    loop_completed: {
      state: "Первый цикл завершён",
      next: "Выбери следующую тему, где знакомый сценарий повторяется.",
    },
  };
  let step = stages[stage];
  let ctaLabel = "Продолжить в чате";
  let labelText = "Следующий шаг";
  const experiment = changeExperimentView(p.change_experiment);
  let showExperiment = Boolean(experiment);
  if (experiment) {
    step = experiment;
    ctaLabel = experiment.cta;
  }
  const latestMemory = (p.memories || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      item &&
      item.summary &&
      ["goal", "commitment", "effective_strategy"].includes(item.kind),
    )
    .sort(
      (a, b) =>
        (Date.parse(b.item.last_updated || "") || 0) -
          (Date.parse(a.item.last_updated || "") || 0) ||
        // Один extraction может сохранить несколько целей с одинаковым timestamp.
        // Последняя в durable_facts обычно является новой темой, а не старой обновлённой целью.
        b.index - a.index,
    )[0]?.item;
  if (!step && latestMemory) {
    step = {
      state:
        latestMemory.kind === "effective_strategy"
          ? "Нашлась рабочая опора"
          : "Вернёмся к важной теме",
      next: latestMemory.summary,
    };
    labelText = "К чему вернуться";
    ctaLabel = "Продолжить эту тему";
  }
  if (!step && p.completeness && p.completeness.missing && p.completeness.missing.length) {
    step = {
      state: "Образ ещё уточняется",
      next: "Расскажи о ситуации, где особенно заметна тема «" + p.completeness.missing[0] + "».",
    };
  }
  if (!step) {
    step = {
      state: "Выбери живую тему",
      next: "Открой одну тему на карте ниже и продолжи её в разговоре.",
    };
  }
  if (p.live_sync && p.live_sync.pending_profile_update) {
    step = {
      state: "Последний разговор уже здесь",
      next: "Я обновляю образ по новой теме. В чате можно продолжить с того же места.",
    };
    ctaLabel = "Вернуться к разговору";
    showExperiment = false;
  }
  const sec = el("section", "today");
  if (showExperiment) sec.classList.add("today--experiment");
  labelSection(sec, "today-heading", labelText, "today-label");
  sec.appendChild(el("strong", "today-state", step.state));
  sec.appendChild(el("p", "today-q", step.next));
  if (showExperiment) {
    const details = experimentDetails(experiment.details);
    if (details) sec.appendChild(details);
  }
  if (p.live_sync && p.live_sync.pending_profile_update) {
    sec.appendChild(
      el("p", "today-sync", "Последний разговор уже принят. Образ обновляется в фоне."),
    );
  }
  const btn = el("button", "today-cta", ctaLabel);
  btn.type = "button";
  btn.addEventListener("click", closeToChat);
  sec.appendChild(btn);
  return sec;
}

function closeToChat() {
  if (tg && typeof tg.close === "function") tg.close();
}

function topicSelectionFeedback() {
  const haptic = tg && tg.HapticFeedback;
  if (haptic && typeof haptic.selectionChanged === "function") {
    haptic.selectionChanged();
  }
}

function topicHandoffFeedback(kind) {
  const haptic = tg && tg.HapticFeedback;
  if (haptic && typeof haptic.notificationOccurred === "function") {
    haptic.notificationOccurred(kind);
  }
}

function topicHandoffKey(item) {
  if (item && item.itemType === "facet" && FACET_GUIDE[item.key]) return item.key;
  if (item && item.itemType === "archetype") return "archetypes";
  return null;
}

function topicHandoffStatus(readout, text, kind) {
  const current = readout.querySelector(".topic-handoff-status");
  if (current) current.remove();
  const status = el("div", "topic-handoff-status topic-handoff-status--" + kind);
  status.setAttribute("role", kind === "error" ? "alert" : "status");
  status.appendChild(el("p", null, text));
  readout.appendChild(status);
  return status;
}

async function handoffTopicToChat(item, cta, readout, requestId) {
  if (cta.dataset.closeOnly === "true") {
    closeToChat();
    return;
  }
  const topicKey = topicHandoffKey(item);
  if (!topicKey) {
    topicHandoffStatus(
      readout,
      "Эту новую тему пока нельзя передать автоматически. Вернись в чат и назови её своими словами.",
      "error",
    );
    cta.textContent = "Вернуться в чат без передачи";
    cta.dataset.closeOnly = "true";
    return;
  }
  if (cta.disabled) return;
  cta.disabled = true;
  cta.setAttribute("aria-busy", "true");
  cta.textContent = "Передаю тему…";
  const current = readout.querySelector(".topic-handoff-status");
  if (current) current.remove();
  try {
    await postChatIntent(topicKey, requestId);
    topicHandoffFeedback("success");
    topicHandoffStatus(
      readout,
      "Готово. В чате уже появился вопрос по выбранной теме.",
      "success",
    );
    cta.textContent = "Тема передана";
    window.setTimeout(() => {
      closeToChat();
      cta.disabled = false;
      cta.removeAttribute("aria-busy");
      cta.dataset.closeOnly = "true";
      cta.textContent = "Вернуться в чат";
    }, 220);
  } catch (error) {
    topicHandoffFeedback("error");
    const expired = error && (error.message === "unauthorized" || error.message === "no-init-data");
    const status = topicHandoffStatus(
      readout,
      expired
        ? "Сессия мини-аппа завершилась. Вернись в чат и открой «Мой образ» заново."
        : "Тема осталась здесь. Проверь связь и повтори передачу, либо вернись в чат без неё.",
      "error",
    );
    const back = el("button", "topic-handoff-back", "Вернуться без темы");
    back.type = "button";
    back.addEventListener("click", closeToChat);
    status.appendChild(back);
    cta.disabled = false;
    cta.removeAttribute("aria-busy");
    cta.textContent = expired ? "Открыть чат" : "Повторить передачу";
    if (expired) cta.dataset.closeOnly = "true";
  }
}

async function copyPlainText(text) {
  const clipboard = window.navigator && window.navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

function memoryBlock(items) {
  if (!items || !items.length) return null;
  const sec = el("section", "memory-card");
  labelSection(sec, "memory-heading", "Что я держу в уме", "memory-label");
  sec.appendChild(
    el(
      "p",
      "memory-note",
      "Только важные факты, которые ты сообщил прямо. Рабочие гипотезы живут отдельно.",
    ),
  );
  const list = el("ul", "memory-list");
  items.slice(0, 6).forEach((item) => {
    const row = el("li", "memory-item");
    row.appendChild(el("span", "memory-mark", "✓"));
    const summary = item.summary || "";
    row.appendChild(el("span", "memory-item-text", summary));
    const forget = el("button", "memory-forget", "Забыть");
    const forgetStatus = el("span", "memory-forget-status");
    forgetStatus.setAttribute("role", "status");
    forgetStatus.setAttribute("aria-live", "polite");
    forget.type = "button";
    forget.setAttribute("aria-label", "Забыть запись: " + summary);
    forget.addEventListener("click", async () => {
      const ok = await confirmAction(
        "Забыть именно эту запись? Она исчезнет из долговременной памяти и не восстановится автоматически. Исходный разговор останется в истории; полностью очистить его можно через /reset.",
      );
      if (!ok) return;
      forget.disabled = true;
      forget.setAttribute("aria-busy", "true");
      forget.textContent = "Забываю…";
      forgetStatus.textContent = "";
      try {
        const updated = await forgetMemory(item.key);
        announceAction("Запись забыта.");
        activeProfileTab = "memory";
        renderedProfileFingerprint = null;
        renderFetchedProfile(updated);
        queueMicrotask(() => {
          const tab = document.getElementById("tab-memory");
          if (tab) tab.focus();
        });
      } catch (_) {
        forget.disabled = false;
        forget.removeAttribute("aria-busy");
        forget.textContent = "Повторить";
        forgetStatus.textContent = "Не удалось забыть запись. Проверь связь.";
        announceAction("Не удалось забыть запись. Проверь связь и повтори.");
      }
    });
    row.appendChild(forget);
    row.appendChild(forgetStatus);
    list.appendChild(row);
  });
  sec.appendChild(list);
  if (items.length > 6) {
    sec.appendChild(el("p", "memory-more", "Ещё " + (items.length - 6) + " — в /memory и /export."));
  }
  return sec;
}

// Быстрая карта тем. В предыдущей версии одна область одновременно поддерживала drag,
// pan, pinch-zoom и double-tap reset. В Telegram WebView эти жесты конкурировали со
// скроллом и скрывали подписи. Теперь каждая тема — обычная доступная кнопка: все названия
// видны, выбор предсказуем, а связи раскрываются текстом.
function psycheMap(sections, archetypes) {
  const items = [
    ...(sections || []).map((item) => ({ ...item, itemType: "facet" })),
    ...(archetypes || []).map((item) => ({
      ...item,
      key: "archetype:" + (item.name || ""),
      label: item.name || "Архетип",
      itemType: "archetype",
    })),
  ].filter((item) => item && item.label && item.summary);
  if (!items.length) return null;

  const sec = el("section", "sky topic-map-section");
  labelSection(sec, "topic-map-heading", "Карта тем", "sky-label");
  sec.appendChild(
    el(
      "p",
      "sky-sub",
      "Здесь видны рабочие темы из разговоров. Это метафорические линзы для проверки на " +
        "реальных ситуациях, не диагнозы и не установленные механизмы. Нажми на любую: " +
        "покажу смысл и возможную связь.",
    ),
  );

  const confirmed = items.filter((item) => item.user_confirmed).length;
  const working = items.filter((item) => !item.user_confirmed && item.status === "working").length;
  const emerging = Math.max(0, items.length - confirmed - working);
  const progress = el("div", "topic-map-progress");
  [
    [confirmed, "подтверждено"],
    [working, "проверяем"],
    [emerging, "проявляется"],
  ].forEach(([value, label]) => {
    const part = el("span", "topic-map-progress-item");
    part.appendChild(el("strong", null, String(value)));
    part.appendChild(document.createTextNode(" " + label));
    progress.appendChild(part);
  });
  sec.appendChild(progress);

  const byTheme = new Map();
  items.forEach((item, index) => {
    if (!item.theme) return;
    const members = byTheme.get(item.theme) || [];
    members.push(index);
    byTheme.set(item.theme, members);
  });

  const grid = el("div", "topic-map-grid");
  const buttons = [];
  const readout = el("div", "topic-map-readout");
  readout.setAttribute("aria-live", "polite");
  readout.setAttribute("aria-atomic", "true");

  const selectTopic = (index) => {
    const item = items[index];
    buttons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === index;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    readout.replaceChildren();
    const status = item.user_confirmed
      ? "Подтверждено тобой"
      : item.status === "working"
        ? "Сейчас проверяем"
        : "Только проявляется";
    readout.appendChild(el("span", "topic-map-readout-status", status));
    readout.appendChild(el("h3", "topic-map-readout-title serif", item.label));
    readout.appendChild(el("p", "topic-map-readout-text", item.summary));

    const relatedIndexes = item.theme
      ? (byTheme.get(item.theme) || []).filter((memberIndex) => memberIndex !== index)
      : [];
    if (relatedIndexes.length) {
      const related = relatedIndexes.map((memberIndex) => items[memberIndex].label).join(", ");
      readout.appendChild(
        el("p", "topic-map-related", "Может быть связано с темами: " + related + "."),
      );
    }
    const cta = el("button", "sky-readout-cta", "Продолжить эту тему в разговоре");
    cta.type = "button";
    const requestId = newRequestId();
    cta.addEventListener("click", () => handoffTopicToChat(item, cta, readout, requestId));
    readout.appendChild(cta);
  };

  items.forEach((item, index) => {
    const button = el("button", "topic-map-node");
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Открыть тему «" + item.label + "»");
    button.dataset.status = item.user_confirmed ? "confirmed" : item.status || "emerging";
    const glyph = item.itemType === "facet" && FACET_GUIDE[item.key]
      ? FACET_GUIDE[item.key].glyph
      : "✦";
    button.appendChild(el("span", "topic-map-glyph", glyph));
    const copy = el("span", "topic-map-node-copy");
    copy.appendChild(el("strong", null, item.label));
    copy.appendChild(
      el(
        "small",
        null,
        item.user_confirmed ? "подтверждено" : STATUS_LABELS[item.status] || "гипотеза",
      ),
    );
    button.appendChild(copy);
    button.addEventListener("click", () => {
      topicSelectionFeedback();
      selectTopic(index);
    });
    buttons.push(button);
    grid.appendChild(button);
  });
  sec.appendChild(grid);
  sec.appendChild(readout);

  const growth = el("details", "topic-map-growth");
  growth.appendChild(el("summary", "topic-map-growth-toggle", "Как растёт карта"));
  growth.appendChild(
    el(
      "p",
      "topic-map-growth-text",
      "Новая тема появляется после реального разговора, когда есть достаточно опоры. " +
        "Гипотеза становится подтверждённой только после твоего согласия или уточнения. " +
        "Связи показываются лишь там, где несколько тем действительно сходятся в одном мотиве.",
    ),
  );
  sec.appendChild(growth);

  const firstConfirmed = items.findIndex((item) => item.user_confirmed);
  selectTopic(firstConfirmed >= 0 ? firstConfirmed : 0);
  return sec;
}

// --- Mini App IA: путь, сессии, память, ещё -------------------------------

const PROFILE_TABS = [
  { key: "path", label: "Путь" },
  { key: "sessions", label: "Сессии" },
  { key: "memory", label: "Память" },
  { key: "more", label: "Ещё" },
];

let activeProfileTab = "path";
let switchProfileTab = null;
let nativeBackBound = false;

function jaguarMark() {
  const mark = el("span", "jaguar-mark");
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML =
    '<svg viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M8 13 5 5l10 5c2.7-1.3 5.7-2 9-2s6.3.7 9 2L43 5l-3 8c1.9 2.4 3 5.2 3 8.1C43 28.2 34.5 33 24 33S5 28.2 5 21.1C5 18.2 6.1 15.4 8 13Z"/>' +
    '<path d="M13 20c2.3-1.7 5.1-1.7 7.5 0M27.5 20c2.4-1.7 5.2-1.7 7.5 0M20 25h8l-4 3-4-3Z"/>' +
    '<circle cx="15" cy="15" r="1"/><circle cx="33" cy="15" r="1"/>' +
    '</svg>';
  return mark;
}

function syncNativeBackButton(tabKey) {
  const back = tg && tg.BackButton;
  if (!back) return;
  if (!nativeBackBound && typeof back.onClick === "function") {
    back.onClick(() => {
      if (typeof switchProfileTab === "function" && activeProfileTab !== "path") {
        switchProfileTab("path", true);
      }
    });
    nativeBackBound = true;
  }
  if (tabKey === "path") {
    if (typeof back.hide === "function") back.hide();
  } else if (typeof back.show === "function") {
    back.show();
  }
}

function profileTabShell(panels) {
  const shell = el("div", "profile-shell");
  const nav = el("nav", "profile-tabs");
  nav.setAttribute("aria-label", "Разделы личного пути");
  nav.setAttribute("role", "tablist");
  const buttons = [];

  const select = (key, moveFocus) => {
    if (!panels[key]) key = "path";
    activeProfileTab = key;
    PROFILE_TABS.forEach((item) => {
      const selected = item.key === key;
      const button = buttons.find((candidate) => candidate.dataset.tabKey === item.key);
      const panel = panels[item.key];
      if (button) {
        button.setAttribute("aria-selected", selected ? "true" : "false");
        button.tabIndex = selected ? 0 : -1;
        if (selected && moveFocus) button.focus();
      }
      if (panel) panel.hidden = !selected;
    });
    syncNativeBackButton(key);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  switchProfileTab = select;

  PROFILE_TABS.forEach((item, index) => {
    const button = el("button", "profile-tab", item.label);
    button.type = "button";
    button.id = "tab-" + item.key;
    button.dataset.tabKey = item.key;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", "panel-" + item.key);
    button.addEventListener("click", () => select(item.key, false));
    button.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowLeft") next = (index - 1 + PROFILE_TABS.length) % PROFILE_TABS.length;
      if (event.key === "ArrowRight") next = (index + 1) % PROFILE_TABS.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = PROFILE_TABS.length - 1;
      select(PROFILE_TABS[next].key, true);
    });
    buttons.push(button);
    nav.appendChild(button);
  });
  shell.appendChild(nav);

  PROFILE_TABS.forEach((item) => {
    const panel = panels[item.key];
    panel.id = "panel-" + item.key;
    panel.classList.add("profile-panel");
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", "tab-" + item.key);
    panel.querySelectorAll("[data-open-tab]").forEach((button) => {
      button.addEventListener("click", () => select(button.dataset.openTab, true));
    });
    shell.appendChild(panel);
  });

  select(PROFILE_TABS.some((item) => item.key === activeProfileTab) ? activeProfileTab : "path", false);
  return shell;
}

function changePathBlock(p) {
  const sec = el("section", "change-path");
  labelSection(sec, "change-path-heading", "Твой цикл изменения", "section-eyebrow");
  sec.appendChild(
    el(
      "p",
      "change-path-intro",
      "Не отчёт и не серия достижений. Это место, где понимание превращается в проверяемый шаг.",
    ),
  );
  const stage = (p.path && p.path.activation && p.path.activation.stage) ||
    (p.access && p.access.activation_stage) || "portrait_ready";
  const stages = [
    ["portrait_ready", "Замечаю", "Называю повторяющийся сценарий"],
    ["pattern_named", "Выбираю", "Нахожу маленькое действие"],
    ["step_chosen", "Пробую", "Проверяю его в реальной ситуации"],
    ["outcome_shared", "Сверяю", "Приношу результат без оценки себя"],
    ["loop_completed", "Продолжаю", "Сохраняю полезное и уточняю путь"],
  ];
  const currentIndex = Math.max(0, stages.findIndex(([key]) => key === stage));
  const list = el("ol", "change-path-list");
  stages.forEach(([key, title, text], index) => {
    const item = el("li", "change-path-step");
    if (index < currentIndex || stage === "loop_completed") item.dataset.state = "done";
    else if (index === currentIndex) {
      item.dataset.state = "current";
      item.setAttribute("aria-current", "step");
    } else item.dataset.state = "next";
    item.appendChild(el("span", "change-path-marker", index < currentIndex || stage === "loop_completed" ? "✓" : String(index + 1)));
    const copy = el("span", "change-path-copy");
    copy.appendChild(el("strong", null, title));
    copy.appendChild(el("small", null, text));
    item.appendChild(copy);
    list.appendChild(item);
  });
  sec.appendChild(list);
  return sec;
}

function profileInsightsBlock(p) {
  const wrap = el("details", "profile-details");
  wrap.appendChild(el("summary", "profile-details-toggle", "Темы и рабочие гипотезы"));
  const body = el("div", "profile-details-body");
  body.appendChild(
    el(
      "p",
      "profile-details-intro",
      "Это линзы для самонаблюдения, не диагнозы и не окончательные выводы. Ты можешь подтвердить, уточнить или отклонить каждую тему.",
    ),
  );
  const map = psycheMap(p.sections, p.archetypes);
  if (map) body.appendChild(map);

  const core = p.sections.filter((section) => section.group === "core");
  const enrichment = p.sections.filter((section) => section.group === "enrichment");
  if (core.length) body.appendChild(groupBlock("Основные темы", core));
  if (enrichment.length) body.appendChild(groupBlock("Глубинные темы", enrichment));
  if (p.archetypes.length) {
    body.appendChild(
      groupBlock(
        "Архетипические образы",
        p.archetypes,
        "Метафорические образы, которые можно проверить на собственных ассоциациях.",
      ),
    );
  }
  if (p.habits.length) {
    const habits = el("section", "group");
    habits.appendChild(el("h2", "group-title", "Работа с привычкой"));
    habits.appendChild(el("p", "group-sub", "Триггер, потребность, замена и минимальная версия на трудный день."));
    p.habits.forEach((habit) => habits.appendChild(habitCard(habit)));
    body.appendChild(habits);
  }
  if (!body.querySelector(".sky, .group")) {
    body.appendChild(el("p", "empty-note", "Темы появятся после нескольких содержательных разговоров."));
  }
  wrap.appendChild(body);
  return wrap;
}

function commandAction(command, label, statusNode) {
  const button = el("button", "command-action", label);
  button.type = "button";
  button.addEventListener("click", async () => {
    const copied = await copyPlainText(command);
    statusNode.textContent = copied
      ? "Команда " + command + " скопирована. Вернись в чат и вставь её."
      : "Не удалось скопировать автоматически. Отправь в чат команду " + command + ".";
    if (copied) button.textContent = "Скопировано";
  });
  return button;
}

function deepSessionPreparation(showUpgrade) {
  const sec = el("section", "session-prep");
  sec.appendChild(el("span", "section-eyebrow", "Перед началом"));
  sec.appendChild(el("h2", "session-prep-title serif", "Освободи место для разговора"));
  sec.appendChild(
    el(
      "p",
      "session-prep-intro",
      "Глубинная сессия помогает спокойно разобрать один актуальный вопрос: заметить триггер, проверить возможную связь и выбрать маленький шаг. Это не терапия и не диагностика.",
    ),
  );
  const list = el("ul", "session-checklist");
  [
    "Выдели 20–30 минут без срочных дел и отвлечений.",
    "Начинай трезвым, в безопасном спокойном месте, не за рулём и не на работе.",
    "Держи рядом воду и назови намерение одним предложением.",
    "Ты можешь замедлить или прекратить сессию в любой момент.",
  ].forEach((text) => {
    const item = el("li", "session-check");
    item.appendChild(el("span", "session-check-mark", "✓"));
    item.appendChild(el("span", null, text));
    list.appendChild(item);
  });
  sec.appendChild(list);
  sec.appendChild(
    el(
      "p",
      "session-safety",
      "Если сейчас небезопасно или нужна срочная помощь, не начинай сессию. Обратись к экстренной службе или к человеку рядом.",
    ),
  );
  const status = el("p", "command-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  if (showUpgrade) {
    const upgrade = el("button", "session-start", "Открыть глубинные сессии");
    upgrade.type = "button";
    upgrade.dataset.openTab = "more";
    sec.appendChild(upgrade);
  } else {
    sec.appendChild(commandAction("/imagine", "Скопировать /imagine", status));
    const back = el("button", "session-back", "Вернуться в чат");
    back.type = "button";
    back.addEventListener("click", closeToChat);
    sec.appendChild(back);
  }
  sec.appendChild(status);
  return sec;
}

const DEEP_SESSION_STATUS_LABELS = {
  preparing: "Подготовка",
  active: "Сессия идёт",
  integrating: "Интеграция",
  completed: "Завершена",
  aborted: "Остановлена",
};
const DEEP_SESSION_STAGE_LABELS = {
  prepare: "Подготовка",
  intention: "Намерение",
  explore: "Исследование",
  integrate: "Интеграция",
  confirm: "Подтверждение итога",
};

function fmtSessionDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

function deepSessionCard(session, feedback) {
  const card = el("article", "deep-session-card");
  card.dataset.status = session.status;
  const head = el("div", "deep-session-head");
  const heading = el("div", "deep-session-heading");
  heading.appendChild(el("span", "deep-session-status", DEEP_SESSION_STATUS_LABELS[session.status]));
  const date = fmtSessionDate(session.ended_at || session.started_at);
  if (date) heading.appendChild(el("span", "deep-session-date", date));
  head.appendChild(heading);
  if (session.stage && session.status !== "completed") {
    head.appendChild(el("span", "deep-session-stage", DEEP_SESSION_STAGE_LABELS[session.stage]));
  }
  card.appendChild(head);
  const result = session.result || {};
  if (result.title) card.appendChild(el("h4", "deep-session-title serif", result.title));
  if (session.intention) {
    const intention = el("div", "deep-session-intention");
    intention.appendChild(el("span", "deep-session-result-label", "Намерение"));
    intention.appendChild(el("p", null, session.intention));
    card.appendChild(intention);
  }

  if (["preparing", "active", "integrating"].includes(session.status)) {
    const copy = session.status === "integrating"
      ? "Собери словами то, что действительно откликается. В итог попадёт только подтверждённая тобой формулировка."
      : "Сессия продолжается в чате. Можно остановиться, попросить паузу или изменить темп.";
    card.appendChild(el("p", "deep-session-progress", copy));
    const back = el("button", "deep-session-continue", "Вернуться в чат");
    back.type = "button";
    back.addEventListener("click", closeToChat);
    card.appendChild(back);
  } else if (session.status === "aborted") {
    card.appendChild(el("p", "deep-session-progress", "Сессию остановили. Возвращаться к ней или начинать новую не обязательно."));
  } else {
    if (result.user_words && result.user_words.length) {
      const outcome = el("div", "deep-session-outcome");
      outcome.appendChild(el("span", "deep-session-result-label", "Дословно из твоих сообщений"));
      const words = el("ul", "deep-session-words");
      result.user_words.forEach((word) => words.appendChild(el("li", null, word)));
      outcome.appendChild(words);
      card.appendChild(outcome);
    } else if (result.takeaway) {
      const outcome = el("div", "deep-session-outcome");
      outcome.appendChild(el("span", "deep-session-result-label", "Итог, который ты подтвердил"));
      outcome.appendChild(el("p", "deep-session-takeaway", result.takeaway));
      card.appendChild(outcome);
    } else {
      card.appendChild(el("p", "deep-session-progress", "Подтверждённый итог пока не сохранён."));
    }
    if (result.model_hypothesis) {
      const hypothesis = el("details", "deep-session-hypothesis");
      hypothesis.appendChild(el("summary", null, "Гипотеза проводника, не факт"));
      hypothesis.appendChild(el("p", null, result.model_hypothesis));
      if (result.uncertainty) {
        hypothesis.appendChild(el("p", "deep-session-uncertainty", "Граница уверенности: " + result.uncertainty));
      }
      card.appendChild(hypothesis);
    }
    if (result.next_step) {
      const next = el("div", "deep-session-next");
      next.appendChild(el("span", "deep-session-result-label", "Следующий шаг"));
      next.appendChild(el("p", null, result.next_step));
      card.appendChild(next);
    }
    if (result.closing_question) {
      const question = el("div", "deep-session-question");
      question.appendChild(el("span", "deep-session-result-label", "Вопрос на возвращение"));
      question.appendChild(el("p", null, result.closing_question));
      card.appendChild(question);
    }
    const followUp = fmtSessionDate(
      session.follow_up_at || result.follow_up_at || result.check_in_on,
    );
    if (followUp) card.appendChild(el("p", "deep-session-followup", "Вернуться к этому: " + followUp));

    const immediate = existingOutcome(
      feedback,
      "deep_helpfulness",
      "session_close",
      session.id,
    );
    if (!immediate) {
      const measure = el("section", "deep-session-measure");
      measure.appendChild(outcomeQuestion({
        label: "Этот итог был полезен?",
        event: "deep_helpfulness",
        point: "session_close",
        subjectKey: session.id,
        options: [["yes", "Да"], ["partly", "Частично"], ["no", "Нет"]],
        feedback,
      }));
      card.appendChild(measure);
    } else {
      const due = dateOnlyParts(session.follow_up_at || result.check_in_on);
      const followupPoint = result.check_in_days > 4 ? "d7" : "d3";
      if (
        due && due.key <= localDateKey() &&
        !existingOutcome(feedback, "deep_followup", followupPoint, session.id)
      ) {
        const measure = el("section", "deep-session-measure");
        measure.appendChild(outcomeQuestion({
          label: "Спустя несколько дней итог помог действовать иначе?",
          event: "deep_followup",
          point: followupPoint,
          subjectKey: session.id,
          options: [
            ["helped", "Помог"],
            ["not_sure", "Пока неясно"],
            ["did_not_help", "Не помог"],
          ],
          feedback,
        }));
        card.appendChild(measure);
      }
    }
  }

  if (["completed", "aborted"].includes(session.status)) {
    const deleteStatus = el("p", "deep-session-delete-status");
    deleteStatus.setAttribute("role", "status");
    deleteStatus.setAttribute("aria-live", "polite");
    const remove = el("button", "deep-session-delete", "Удалить итог");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      const ok = await confirmAction(
        "Удалить этот итог глубинной сессии? Связанный с ним текущий шаг тоже будет удалён. Действие нельзя отменить.",
      );
      if (!ok) return;
      remove.disabled = true;
      remove.setAttribute("aria-busy", "true");
      remove.textContent = "Удаляю…";
      try {
        const updated = await deleteDeepSession(session.id);
        activeProfileTab = "sessions";
        renderedProfileFingerprint = null;
        renderFetchedProfile(updated);
        announceAction("Итог глубинной сессии удалён.");
        queueMicrotask(() => {
          const tab = document.getElementById("tab-sessions");
          if (tab) tab.focus();
        });
      } catch (_) {
        remove.disabled = false;
        remove.removeAttribute("aria-busy");
        remove.textContent = "Повторить удаление";
        deleteStatus.textContent = "Не удалось удалить итог. Проверь связь и повтори.";
      }
    });
    card.appendChild(remove);
    card.appendChild(deleteStatus);
  }
  return card;
}

function deepSessionsPanel(p) {
  const panel = el("section", "sessions-panel");
  const intro = el("header", "panel-header");
  intro.appendChild(el("span", "section-eyebrow", "Глубинные сессии"));
  intro.appendChild(el("h2", "panel-title serif", "Разговор, после которого остаётся твой итог"));
  intro.appendChild(
    el(
      "p",
      "panel-intro",
      "Здесь нет стенограммы. Только сохранённый итог с явным разделением твоего описания и рабочей гипотезы.",
    ),
  );
  panel.appendChild(intro);

  const sessions = p.deep_sessions || normalizeDeepSessions(null);
  const summary = sessions.summary || {};
  if (summary.total || summary.completed) {
    const stats = el("dl", "session-summary");
    [[summary.total, "всего"], [summary.completed, "завершено"]].forEach(([value, label]) => {
      const item = el("div", "session-summary-item");
      item.appendChild(el("dt", null, label));
      item.appendChild(el("dd", null, String(value)));
      stats.appendChild(item);
    });
    panel.appendChild(stats);
  }

  const active = sessions.recent.filter((session) => ["preparing", "active", "integrating"].includes(session.status));
  const history = sessions.recent.filter((session) => ["completed", "aborted"].includes(session.status));
  if (active.length) {
    const current = el("section", "session-group");
    current.appendChild(el("h3", "session-group-title", "Сейчас"));
    active.forEach((session) => current.appendChild(deepSessionCard(session, p.outcome_feedback)));
    panel.appendChild(current);
  }

  panel.appendChild(deepSessionPreparation(p.show_upgrade));

  const past = el("section", "session-group");
  past.appendChild(el("h3", "session-group-title", "Последние сессии"));
  if (history.length) {
    history.forEach((session) => past.appendChild(deepSessionCard(session, p.outcome_feedback)));
  } else {
    const empty = el("div", "session-empty");
    empty.appendChild(el("strong", null, "Здесь пока тихо"));
    empty.appendChild(el("p", null, "После первой сессии здесь появится сохранённый итог и, если выберешь, следующий шаг."));
    past.appendChild(empty);
  }
  panel.appendChild(past);
  return panel;
}

function memoryControlsBlock() {
  const sec = el("section", "memory-controls");
  sec.appendChild(el("h2", "memory-controls-title serif", "Ты управляешь памятью"));
  sec.appendChild(
    el(
      "p",
      "memory-controls-intro",
      "Факты памяти отделены от рабочих гипотез. В чате можно проверить формулировки, получить копию или удалить всё.",
    ),
  );
  const status = el("p", "command-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const list = el("div", "memory-command-list");
  [
    ["/memory", "Посмотреть и исправить", "Все сохранённые факты"],
    ["/export", "Получить копию", "Экспорт твоих данных"],
    ["/deleteall", "Удалить всё", "Подтверждение произойдёт в чате"],
  ].forEach(([command, label, note]) => {
    const row = el("div", "memory-command-row");
    const copy = el("div", "memory-command-copy");
    copy.appendChild(el("strong", null, label));
    copy.appendChild(el("span", null, note));
    row.appendChild(copy);
    row.appendChild(commandAction(command, command, status));
    list.appendChild(row);
  });
  sec.appendChild(list);
  sec.appendChild(status);
  const back = el("button", "memory-chat", "Вернуться в чат");
  back.type = "button";
  back.addEventListener("click", closeToChat);
  sec.appendChild(back);
  return sec;
}

function memoryPanel(p) {
  const panel = el("section", "memory-panel");
  const header = el("header", "panel-header");
  header.appendChild(el("span", "section-eyebrow", "Память"));
  header.appendChild(el("h2", "panel-title serif", "Что остаётся между разговорами"));
  header.appendChild(el("p", "panel-intro", "Только сообщённые тобой факты. Гипотезы о смысле находятся в отдельном разделе и не выдаются за факты."));
  panel.appendChild(header);
  const memories = memoryBlock(p.memories);
  if (memories) panel.appendChild(memories);
  else {
    const empty = el("div", "memory-empty");
    empty.appendChild(el("strong", null, "Память пока пуста"));
    empty.appendChild(el("p", null, "Если ты попросишь что-то запомнить или подтвердить важный факт, он появится здесь."));
    panel.appendChild(empty);
  }
  panel.appendChild(memoryControlsBlock());
  return panel;
}

function legalLinks() {
  const nav = el("nav", "legal-links");
  nav.setAttribute("aria-label", "Условия и данные");
  [["./privacy.html", "Приватность"], ["./offer.html", "Оферта"], ["./refund.html", "Возврат"]].forEach(([href, label]) => {
    const link = el("a", null, label);
    link.href = href;
    nav.appendChild(link);
  });
  return nav;
}

function morePanel(p) {
  const panel = el("section", "more-panel");
  const header = el("header", "panel-header");
  header.appendChild(el("span", "section-eyebrow", "Доступ и настройки"));
  header.appendChild(el(
    "h2",
    "panel-title serif",
    p.show_upgrade ? "Продолжить путь" : (p.is_paid ? "Подписка активна" : "Доступ открыт"),
  ));
  header.appendChild(el(
    "p",
    "panel-intro",
    p.show_upgrade
      ? "Сначала ты видишь собственный путь и данные. Здесь можно решить, нужна ли непрерывная работа."
      : p.is_paid
        ? "Полный доступ работает. Управлять регулярной оплатой можно в настройках Telegram."
        : "Сейчас полный доступ открыт. Актуальные условия и остаток маршрута видны в чате.",
  ));
  panel.appendChild(header);
  if (p.show_upgrade) panel.appendChild(upgradeSection(p.billing, p.access));
  else {
    const active = el("section", "subscription-active");
    active.appendChild(el("span", "subscription-active-mark", "✓"));
    active.appendChild(el("strong", null, p.is_paid ? "Полный доступ открыт" : "Доступ действует сейчас"));
    active.appendChild(el("p", null, "Глубинные сессии, практики и разговоры доступны в чате."));
    const back = el("button", "subscription-chat", "Вернуться в чат");
    back.type = "button";
    back.addEventListener("click", closeToChat);
    active.appendChild(back);
    panel.appendChild(active);
  }
  if (p.invite_url) panel.appendChild(shareRow(p.referral, p.invite_url));
  panel.appendChild(legalLinks());
  const foot = el("footer", "footer");
  foot.appendChild(el("p", null, "MindCoach помогает с самонаблюдением, но не ставит диагнозов и не заменяет специалиста."));
  panel.appendChild(foot);
  return panel;
}

function pathPanel(p) {
  const panel = el("section", "path-panel");
  const header = el("header", "panel-header path-panel-header");
  header.appendChild(el("span", "section-eyebrow", "Путь сегодня"));
  header.appendChild(el("h2", "panel-title serif", "Понимание становится маленьким действием"));
  header.appendChild(el("p", "panel-intro", "Один следующий шаг важнее десятка метрик. Здесь видно, что проверить в жизни и к чему вернуться в разговоре."));
  panel.appendChild(header);
  panel.appendChild(todayBlock(p));
  const stepOutcome = stepAttemptBlock(p);
  if (stepOutcome) panel.appendChild(stepOutcome);
  panel.appendChild(changePathBlock(p));
  const conversationOutcome = conversationOutcomeBlock(p);
  if (conversationOutcome) panel.appendChild(conversationOutcome);
  const dynamics = dynamicsBlock(p.dynamics);
  if (dynamics) panel.appendChild(dynamics);
  panel.appendChild(profileInsightsBlock(p));
  return panel;
}

// --- сборка профиля ---------------------------------------------------------

function renderProfile(p) {
  const root = el("div", "profile");

  const top = el("header", "topbar");
  const identity = el("div", "brand");
  identity.appendChild(jaguarMark());
  const brandHeading = el("h1", "brand-heading");
  brandHeading.tabIndex = -1;
  brandHeading.dataset.viewHeading = "true";
  brandHeading.appendChild(el("span", "brand-name", "MindCoach"));
  brandHeading.appendChild(
    el("span", "brand-kicker", "Путь · " + (p.pseudonym || "без имени")),
  );
  identity.appendChild(brandHeading);
  top.appendChild(identity);
  const updated = fmtDate(p.updated_at);
  if (updated) top.appendChild(el("div", "datepill", "обновлено " + updated));
  root.appendChild(top);

  root.appendChild(
    profileTabShell({
      path: pathPanel(p),
      sessions: deepSessionsPanel(p),
      memory: memoryPanel(p),
      more: morePanel(p),
    }),
  );
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
    "Путь ещё не начался",
    "Напиши боту о ситуации, которая повторяется или не даёт покоя. Первый шаг появится здесь после разговора.",
    "○",
    [{ label: "Начать разговор", onClick: closeToChat }],
  );
}

let refreshTimer = null;
let refreshInFlight = null;
let refreshQueued = false;
let renderedProfileFingerprint = null;
let sessionExpired = false;
let activationPending = false;

function profileRenderFingerprint(profile) {
  if (!profile) return "null";
  // Dynamics timestamps are presentation-only and must not remount the whole page.
  const stable = { ...profile };
  delete stable.dynamics;
  return JSON.stringify(stable);
}

function renderFetchedProfile(profile) {
  // Polling/lifecycle events usually return the same document. Replacing the whole DOM
  // in that case resets scroll, focus and the star map, making a quiet refresh look like
  // a page reload. Only reconcile the view when the payload actually changed.
  const fingerprint = profileRenderFingerprint(profile);
  if (fingerprint === renderedProfileFingerprint) return false;
  renderedProfileFingerprint = fingerprint;
  setView(profile ? renderProfile(profile) : renderEmpty());
  return true;
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function refreshProfileView() {
  // focus, visibilitychange, Telegram activated и минутный таймер могут сработать
  // почти одновременно. Один запрос за раз не даёт более старому ответу перерисовать
  // уже свежий профиль и не создаёт лишнюю нагрузку перед трафиком.
  if (sessionExpired || activationPending) return Promise.resolve();
  if (refreshInFlight) {
    refreshQueued = true;
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const profile = await fetchProfile(true);
      renderFetchedProfile(profile);
      scheduleRefresh(profile);
    } catch (error) {
      if (error && (error.message === "unauthorized" || error.message === "no-init-data")) {
        sessionExpired = true;
        clearRefreshTimer();
        setView(
          stateView(
            "Сессия завершилась",
            "Чтобы не показывать старые личные данные, открой «Мой профиль» заново из чата.",
            "○",
            [{ label: "Вернуться в чат", onClick: closeToChat }],
            "error",
          ),
        );
      } else {
        scheduleRefresh(null);
      }
    } finally {
      refreshInFlight = null;
      if (refreshQueued) {
        refreshQueued = false;
        queueMicrotask(refreshProfileView);
      }
    }
  })();
  return refreshInFlight;
}

function scheduleRefresh(profile) {
  clearRefreshTimer();
  if (sessionExpired || document.hidden) return;
  const pending = profile && profile.live_sync && profile.live_sync.pending_profile_update;
  const delay = pending ? 5000 : 60000;
  refreshTimer = setTimeout(refreshProfileView, delay);
}

// --- запуск -----------------------------------------------------------------

// Грузим config.js динамически с cache-buster. Telegram-webview агрессивно кэширует
// статичные ресурсы (~10 мин): при ротации туннеля телефон держал старый API_BASE и
// стучался в мёртвый origin. ?v=timestamp = свежий URL на каждое открытие → свежий config.
// Гейт: если JUNG_CONFIG уже задан инлайн (demo-стенд), ничего не грузим — стенд цел.
function loadConfig() {
  if (window.JUNG_CONFIG) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "./config.js?v=" + Date.now();
    s.onload = resolve;
    // Сбой загрузки config — не валим мини-апп: fetchProfile упадёт в понятное
    // «не дотянулся до профиля» и предложит переоткрыть.
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

function syncTelegramTheme() {
  const root = document.documentElement;
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const scheme = tg ? (tg.colorScheme === "dark" ? "dark" : "light") : (prefersDark ? "dark" : "light");
  root.dataset.telegramTheme = scheme;
  const params = objectOrEmpty(tg && tg.themeParams);
  const fallback = scheme === "dark" ? "#101915" : "#f5f4ed";
  const background = params.bg_color || fallback;
  const bottom = params.bottom_bar_bg_color || params.secondary_bg_color || background;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", background);
  if (!tg) return;
  try {
    if (typeof tg.setHeaderColor === "function") tg.setHeaderColor(background);
    if (typeof tg.setBackgroundColor === "function") tg.setBackgroundColor(background);
    if (typeof tg.setBottomBarColor === "function") tg.setBottomBarColor(bottom);
  } catch (_) {
    /* Старые клиенты используют CSS-тему страницы. */
  }
}

async function main() {
  await loadConfig();
  syncTelegramTheme();
  if (tg) {
    tg.ready();
    tg.expand();
  }
  try {
    const profile = await fetchProfile();
    renderFetchedProfile(profile);
    scheduleRefresh(profile);
  } catch (e) {
    const msg =
      e.message === "unauthorized"
        ? "Не удалось подтвердить, что это ты. Открой мини-апп кнопкой из чата с ботом."
        : e.message === "no-init-data"
          ? "Эту страницу нужно открывать из Telegram — кнопкой «Мой профиль»."
          : "Не получилось дотянуться до профиля. Попробуй чуть позже.";
    const terminal = e.message === "unauthorized" || e.message === "no-init-data";
    sessionExpired = terminal;
    setView(
      stateView(
        terminal ? "Открой из чата" : "Не получилось загрузить профиль",
        msg,
        "✦",
        terminal
          ? [{ label: "Вернуться в чат", onClick: closeToChat }]
          : [
              { label: "Повторить", onClick: () => window.location.reload() },
              { label: "Вернуться в чат", onClick: closeToChat },
            ],
        "error",
      ),
    );
    if (!terminal) scheduleRefresh(null);
  }

  // Telegram 8.0+ явно сообщает, когда сохранённый WebView снова стал активным.
  // focus/visibility/pageshow остаются fallback для старых клиентов и браузеров.
  if (tg && typeof tg.onEvent === "function") {
    tg.onEvent("activated", refreshProfileView);
    tg.onEvent("themeChanged", syncTelegramTheme);
  }
  window.addEventListener("focus", refreshProfileView);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshProfileView();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshProfileView();
  });
}

main();
