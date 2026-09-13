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

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function practiceKeyOrNull(value) {
  const key = cleanText(value);
  return /^[0-9a-f]{24}$/.test(key) ? key : null;
}

function currentRitualHabit(habits) {
  const candidates = arrayOfObjects(habits).filter((habit) => cleanText(habit.ritual));
  const current = candidates.filter((habit) => habit.is_current_practice === true);
  if (current.length === 1) return current[0];
  return candidates.length === 1 ? candidates[0] : null;
}

function reminderHourOrNull(value) {
  // Number(null) and Number("") are both 0. Treating either as a real hour invents a
  // midnight reminder that the person never enabled.
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^(?:[0-9]|1[0-9]|2[0-3])$/.test(value.trim())) {
    return null;
  }
  const hour = typeof value === "string" ? Number(value.trim()) : value;
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function utcOffsetMinutesOrNull(value) {
  if (
    value === null || value === undefined || typeof value === "boolean" ||
    typeof value === "object" ||
    (typeof value === "string" && value.trim() === "")
  ) return null;
  const offset = Number(value);
  return Number.isInteger(offset) && offset >= -720 && offset <= 840 ? offset : null;
}

function utcOffsetLabel(minutes) {
  const offset = utcOffsetMinutesOrNull(minutes);
  if (offset === null) return "UTC";
  if (offset === 0) return "UTC";
  const sign = offset > 0 ? "+" : "−";
  const absolute = Math.abs(offset);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return "UTC" + sign + String(hours) + (rest ? ":" + String(rest).padStart(2, "0") : "");
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
  p.habits = arrayOfObjects(p.habits).map((habit) => ({
    ...habit,
    name: cleanText(habit.name),
    summary: cleanText(habit.summary),
    trigger: cleanText(habit.trigger),
    serves: cleanText(habit.serves),
    ritual: cleanText(habit.ritual),
    fallback: cleanText(habit.fallback),
    practice_key: practiceKeyOrNull(habit.practice_key),
    is_current_practice: habit.is_current_practice === true,
  })).filter((habit) => habit.name);
  p.memories = arrayOfObjects(p.memories);
  const memoryCenter = objectOrEmpty(p.memory_center);
  p.memory_center = {
    writes_paused: Boolean(memoryCenter.writes_paused),
    manual_types: arrayOfObjects(memoryCenter.manual_types)
      .map((item) => ({
        value: typeof item.value === "string" ? item.value : "",
        label: typeof item.label === "string" ? item.label : "",
      }))
      .filter((item) => item.value && item.label),
    groups: arrayOfObjects(memoryCenter.groups).map((group) => ({
      class: typeof group.class === "string" ? group.class : "",
      label: typeof group.label === "string" ? group.label : "",
      description: typeof group.description === "string" ? group.description : "",
      items: arrayOfObjects(group.items).map((item) => ({
        key: typeof item.key === "string" ? item.key : "",
        type: typeof item.type === "string" ? item.type : "",
        type_label: typeof item.type_label === "string" ? item.type_label : "Важное",
        content: typeof item.content === "string" ? item.content : "",
        source: typeof item.source === "string" ? item.source : "",
        why: typeof item.why === "string" ? item.why : "",
        recorded_on: typeof item.recorded_on === "string" ? item.recorded_on : "",
        expires_on: typeof item.expires_on === "string" ? item.expires_on : "",
        needs_confirmation: Boolean(item.needs_confirmation),
        editable: Boolean(item.editable),
      })).filter((item) => item.key && item.content),
    })).filter((group) => group.class && group.label),
  };
  p.threads = arrayOfObjects(p.threads).map((thread) => ({
    ...thread,
    members: arrayOfObjects(thread.members),
  }));
  p.billing = objectOrEmpty(p.billing);
  p.safety_pause = Boolean(p.safety_pause);
  p.access = objectOrEmpty(p.access);
  const path = objectOrEmpty(p.path);
  p.path = {
    ...path,
    ritual_done_count: Math.max(0, Number(path.ritual_done_count) || 0),
    growth_done_count: Math.max(0, Number(path.growth_done_count) || 0),
    ritual_done_at: cleanText(path.ritual_done_at),
    growth_done_at: cleanText(path.growth_done_at),
    growth_name: cleanText(path.growth_name),
    growth_step: cleanText(path.growth_step),
    growth_reminder_hour: reminderHourOrNull(path.growth_reminder_hour),
    practice_timezone: cleanText(path.practice_timezone),
    practice_utc_offset_minutes: utcOffsetMinutesOrNull(path.practice_utc_offset_minutes),
    practice_fallback_utc_offset_minutes: utcOffsetMinutesOrNull(
      path.practice_fallback_utc_offset_minutes,
    ),
    nudges_paused_at: cleanText(path.nudges_paused_at),
  };
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
  const ritual = objectOrEmpty(p.ritual);
  p.ritual = {
    ...ritual,
    reminder_hour: reminderHourOrNull(ritual.reminder_hour),
    done_count: Math.max(0, Number(ritual.done_count) || 0),
  };
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

async function confirmSection(key) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/profile/confirm", {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error("http-" + res.status);
  await res.json();
  return fetchProfile(true);
}

// Удалить один подтверждённый факт по opaque key, который бэкенд уже вернул владельцу.
async function controlMemory(action, payload) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/memory/control", {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ action, ...(payload || {}) }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  await res.json();
  return fetchProfile(true);
}

async function downloadMemoryExport() {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(freshApiUrl("/api/memory/export"), {
    headers: apiHeaders(initData, false),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = el("a");
  link.href = url;
  link.download = "jung-bot-my-data.zip";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

async function submitPracticeCheckIn(kind, practiceKey) {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(freshApiUrl("/api/practice/check-in"), {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({
      kind,
      ...(kind === "ritual" && practiceKey ? { practice_key: practiceKey } : {}),
    }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  const body = await res.json();
  if (
    !body || body.kind !== kind ||
    !Number.isInteger(Number(body.count)) || typeof body.counted !== "boolean" ||
    (kind === "ritual" && practiceKey && body.practice_key !== practiceKey)
  ) throw new Error("invalid-response");
  return body;
}

let experimentMutationEpoch = 0;

async function controlExperiment(operation, revision, payload) {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(freshApiUrl("/api/experiment/control"), {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ operation, revision, payload,
      ...(operation === "edit" ? { clock: practiceClockMetadata() } : {}),
    }),
  });
  if (!res.ok) throw new Error("http-" + res.status);
  const body = await res.json();
  if (!body.change_experiment || !body.change_experiment.revision) {
    throw new Error("invalid-response");
  }
  return body.change_experiment;
}

function practiceClockMetadata() {
  let timezone = null;
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof resolved === "string" && resolved.trim()) timezone = resolved.trim();
  } catch (_) {
    timezone = null;
  }
  const rawOffset = -new Date().getTimezoneOffset();
  const utcOffsetMinutes = Number.isInteger(rawOffset) && rawOffset >= -720 && rawOffset <= 840
    ? rawOffset
    : 0;
  return { timezone, utc_offset_minutes: utcOffsetMinutes };
}

async function submitPracticeReminder(kind, hour, practiceKey) {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const clock = practiceClockMetadata();
  const res = await fetchWithDeadline(freshApiUrl("/api/practice/reminder"), {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({
      kind,
      hour,
      timezone: clock.timezone,
      utc_offset_minutes: clock.utc_offset_minutes,
      ...(kind === "ritual" && practiceKey ? { practice_key: practiceKey } : {}),
    }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  const body = await res.json();
  if (
    !body || body.kind !== kind ||
    reminderHourOrNull(body.reminder_hour) !== hour ||
    (kind === "ritual" && hour !== null && practiceKey && body.practice_key !== practiceKey)
  ) throw new Error("invalid-response");
  return body;
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
  if (item.key) card.appendChild(dismissRow(item.key, item.label, item.user_confirmed));
  const discuss = el("button", "command-action", "Обсудить в чате");
  discuss.type = "button";
  const requestId = newRequestId();
  discuss.addEventListener("click", () => handoffTopicToChat(
    {...item, itemType: item.key ? "facet" : "archetype"}, discuss, card, requestId,
  ));
  card.appendChild(discuss);
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

function dismissRow(key, label, alreadyConfirmed) {
  const row = el("div", "card-actions");
  const confirm = el("button", "card-confirm", "Да, это про меня");
  confirm.type = "button";
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    confirm.textContent = "Подтверждаю…";
    try {
      const updated = await confirmSection(key);
      announceAction("Гипотеза подтверждена тобой.");
      renderedProfileFingerprint = null;
      renderFetchedProfile(updated);
    } catch (_) {
      confirm.disabled = false;
      confirm.textContent = "Повторить подтверждение";
      announceAction("Не удалось подтвердить гипотезу. Проверь связь.");
    }
  });
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
  if (!alreadyConfirmed) row.appendChild(confirm);
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
        : "Близкому откроется 7-дневный маршрут и +" + bonus + " дополнительных ответов. После его первой оплаты тебе +" + days + " " + daysWord + " подписки. Ты не увидишь его сообщения, профиль или ответы.",
    ),
  );

  const btn = el("button", "share-btn", "Позвать близкого");
  btn.type = "button";
  btn.addEventListener("click", () => {
    const text =
      "Я прохожу 7-дневный маршрут с ИИ-проводником: замечаю повторяющиеся сценарии и проверяю маленькие шаги в жизни. Тебе по моей ссылке дадут +" + bonus + " ответов. Я не увижу, о чём ты пишешь 🌑";
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
  const url = (await res.json()).url;
  if (!isTelegramInvoiceUrl(url)) throw new Error("invalid-invoice-url");
  return url;
}

function isTelegramInvoiceUrl(value) {
  if (typeof value !== "string" || value.length > 240) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "t.me" &&
      /^\/\$[A-Za-z0-9_-]{1,160}$/.test(url.pathname) &&
      !url.search && !url.hash && !url.username && !url.password;
  } catch (error) {
    return false;
  }
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
  sec.appendChild(el("h2", "upgrade-title serif", "Разговор с сохранением контекста"));
  sec.appendChild(
    el(
      "p",
      "upgrade-text",
      "Можно возвращаться к разговору с сохранённым контекстом. Практики по желанию. " +
        "Твои данные остаются доступны и без подписки.",
    ),
  );
  const perks = el("ul", "upgrade-perks");
  [
    "Полные разговоры без трёхдневных пауз, до 30 сообщений в день",
    "Память, которую можно проверить, исправить или поставить на паузу",
    "Дополнительные практики, сохранённые итоги и управляемые напоминания",
  ].forEach((t) => {
    const li = el("li", "upgrade-perk");
    li.appendChild(el("span", "perk-mark", "✓"));
    li.appendChild(el("span", "perk-text", t));
    perks.appendChild(li);
  });
  sec.appendChild(perks);
  const b = billing || {};
  const monthly = Number.isInteger(Number(b.monthly_xtr)) && Number(b.monthly_xtr) > 0
    ? Number(b.monthly_xtr)
    : null;
  const annual = Number.isInteger(Number(b.annual_xtr)) && Number(b.annual_xtr) > 0
    ? Number(b.annual_xtr)
    : null;
  const annualAvailable = b.annual_available === true && annual !== null;
  const paymentsAvailable = b.payments_available === true && monthly !== null;
  if (!paymentsAvailable) {
    const closed = el("div", "checkout-closed");
    closed.appendChild(el("strong", null, "Новое оформление временно закрыто"));
    closed.appendChild(
      el(
        "p",
        null,
        "Бесплатный режим работает. Если платёж уже был или нужен доступ, напиши /paysupport в чате.",
      ),
    );
    const terms = el("dl", "checkout-closed-terms");
    [
      ["30 дней", monthly === null ? "цена недоступна" : monthly + " Stars"],
      ["365 дней", annual === null ? "цена недоступна" : annual + " Stars · разово"],
    ].forEach(
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
  const monthlyPlan = el("div", "upgrade-plan");
  monthlyPlan.appendChild(btn);
  monthlyPlan.appendChild(el("p", "plan-terms", "Автопродление каждые 30 дней. Отключить: /cancel в чате или в настройках Telegram. Доступ сохранится до конца оплаченного срока."));
  plans.appendChild(monthlyPlan);
  if (annualAvailable) {
    const ybtn = el(
      "button",
      "upgrade-btn upgrade-btn-annual",
      "365 дней · " + annual + " ⭐",
    );
    ybtn.type = "button";
    if (annual === monthly * 10) {
      ybtn.appendChild(el("span", "upgrade-saving", "цена десяти месяцев"));
    }
    ybtn.addEventListener("click", () => startUpgrade(ybtn, "annual", feedback));
    const annualPlan = el("div", "upgrade-plan");
    annualPlan.appendChild(ybtn);
    annualPlan.appendChild(el("p", "plan-terms", "Один платёж за 365 дней. Без автопродления."));
    plans.appendChild(annualPlan);
  }
  sec.appendChild(plans);
  sec.appendChild(feedback);
  const guide = el("details", "stars-guide");
  guide.appendChild(el("summary", "stars-guide-title", "Как купить Stars"));
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
      "Доступные пакеты и способы оплаты зависят от клиента Telegram и региона. " +
        "Остаток Stars останется на общем балансе Telegram: его можно потратить в других " +
        "ботах, мини-приложениях или на подарки. Это не скидка и не депозит MindCoach. " +
        "Если на дату автопродления Stars не хватит, Telegram предложит пополнение, " +
        "но продление может не пройти, пока средств недостаточно.",
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
      : "Можно оставить всё как есть. Новый шаг не обязателен.";
    cta = "Вернуться в чат";
  } else if (status === "paused") {
    state = "Пауза тоже часть пути";
    next = "«" + action + "» можно оставить на паузе или изменить, когда захочется.";
    cta = "Пересобрать без давления";
  } else if (outcome) {
    state = "Результат отмечен";
    next = "Можно уменьшить шаг «" + action + "», выбрать другое время или взять паузу.";
    cta = "Скорректировать план";
  } else if (checkIn && checkIn.key <= today) {
    state = "Время сверить результат";
    next = "Что фактически произошло с шагом: «" + action + "»?";
    cta = "Отметить, что получилось";
  } else if (planned && planned.key < today) {
    state = "Сохранённый шаг";
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
  if (checkIn && status !== "paused") details.push(["Сверка", fmtDateOnly(checkIn.key)]);
  if (status !== "attempted" && outcome) {
    details.push(["Что произошло", outcome]);
  }
  if (status !== "completed" && learning) {
    details.push(["Что берём дальше", learning]);
  }
  const feedbackDue = Boolean(
    measurementKey && status !== "paused" && (
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
  const hasStep = Boolean(changeExperimentView(p.change_experiment));
  const key = typeof p.outcome_prompts.conversation_key === "string"
    ? p.outcome_prompts.conversation_key
    : "";
  if (
    !key ||
    (p.live_sync && p.live_sync.pending_profile_update) ||
    (hasOutcome(p.outcome_feedback, "conversation_insight") &&
      (!hasStep || hasOutcome(p.outcome_feedback, "next_step_clarity")))
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
  if (hasStep && !hasOutcome(p.outcome_feedback, "next_step_clarity")) {
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
  if (p.change_experiment && p.change_experiment.revision) return null;
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
  const experiment = changeExperimentView(p.change_experiment);
  if (!experiment) return null;
  const step = experiment;
  const ctaLabel = experiment.cta;
  const labelText = "Сохранённый шаг";
  const showExperiment = true;
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
  if (showExperiment && p.change_experiment.revision) {
    sec.appendChild(experimentControls(p, sec));
    btn.className = "experiment-chat";
    btn.textContent = "Обсудить в чате";
  }
  sec.appendChild(btn);
  return sec;
}

function experimentControls(p, section) {
  const step = p.change_experiment;
  const controls = el("div", "experiment-controls");
  const feedback = el("p", "experiment-feedback");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  const editor = el("details", "experiment-editor");
  const editToggle = el("summary", "experiment-edit-toggle", "Изменить шаг или сроки");
  editor.appendChild(editToggle);
  const form = el("form", "experiment-form");
  form.appendChild(el("p", "experiment-hint", "Выбери посильную версию. Сроки необязательны. Изменения сохранятся только по кнопке."));
  const fields = {};
  const optional = el("details", "optional-tool");
  optional.appendChild(el("summary", null, "Сроки и уточнения, если нужны"));
  [
    ["action", "Маленькое действие", "textarea"],
    ["trigger", "Когда или в какой ситуации, необязательно", "text"],
    ["fallback", "Если сил мало, необязательно", "text"],
    ["success_signal", "Как замечу, что попробовал, необязательно", "text"],
    ["planned_for", "Когда попробую, необязательно", "date"],
    ["check_in_on", "Когда сверюсь, необязательно", "date"],
  ].forEach(([key, label, type]) => {
    const input = el(type === "textarea" ? "textarea" : "input", "memory-input");
    input.id = "experiment-" + key;
    input.name = key;
    if (type !== "textarea") input.type = type;
    if (type !== "date") {
      input.maxLength = 280;
      input.minLength = key === "action" ? 8 : 4;
    }
    input.required = key === "action";
    input.value = cleanText(step[key]);
    input.defaultValue = input.value;
    const labelNode = el("label", "memory-field-label", label);
    labelNode.htmlFor = input.id;
    (key === "action" ? form : optional).append(labelNode, input);
    input.addEventListener("invalid", () => { if (key !== "action") optional.open = true; });
    fields[key] = input;
  });
  form.appendChild(optional);
  form.addEventListener("input", () => { form.dataset.dirty = "true"; });
  optional.appendChild(el("p", "experiment-hint", "Даты шага и время напоминаний будут по местному времени этого устройства."));
  form.addEventListener("change", () => { form.dataset.dirty = "true"; });
  const save = el("button", "memory-primary", "Сохранить план");
  save.type = "submit";
  const cancel = el("button", "memory-secondary", "Отменить изменения");
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    form.reset();
    delete form.dataset.dirty;
    editor.open = false;
    editToggle.focus();
    refreshProfileView();
  });
  form.append(save, cancel);
  editor.appendChild(form);

  async function commit(operation, payload, message) {
    if (controls.dataset.busy === "true") return;
    if (operation !== "edit" && form.dataset.dirty === "true") {
      feedback.textContent = "Сначала сохрани или отмени изменения плана. Черновик остаётся здесь.";
      editor.open = true;
      save.focus();
      return;
    }
    controls.dataset.busy = "true";
    experimentMutationEpoch++;
    controls.setAttribute("aria-busy", "true");
    const inputs = Array.from(controls.querySelectorAll("button, input, textarea"));
    inputs.forEach((node) => { node.disabled = true; });
    feedback.textContent = "Сохраняю…";
    try {
      const updated = await controlExperiment(operation, step.revision, payload);
      p.change_experiment = updated;
      if (p.movement) window.setTimeout(refreshProfileView, 0);
      const replacement = todayBlock(p);
      section.replaceWith(replacement);
      const readout = replacement.querySelector(".experiment-feedback");
      if (readout) readout.textContent = message;
      const focus = replacement.querySelector(".today-cta") || replacement.querySelector(".experiment-edit-toggle");
      if (focus) focus.focus();
      renderedProfileFingerprint = null;
      announceAction(message);
    } catch (error) {
      if (error.message === "http-409") {
        feedback.textContent = "План уже изменился, возможно, сохранение успело пройти. Черновик остаётся здесь. Отмени изменения, чтобы загрузить текущий план.";
        editor.open = true;
        form.dataset.dirty = "true";
      } else {
        const errors = {
          "http-401": "Сессия завершилась. Открой профиль заново из чата.",
          "http-400": "Проверь формулировки: от 8 символов для действия, от 4 для необязательных полей. Дата сверки должна быть не раньше попытки.",
          "http-422": "Эту формулировку нельзя сохранить как план. Можно обсудить её в чате. Ввод пока остаётся только на экране.",
        };
        feedback.textContent = errors[error.message] || "Не удалось подтвердить сохранение. Твой ввод остался здесь. Проверь связь и повтори.";
      }
      inputs.forEach((node) => { node.disabled = false; });
      if (error.message === "http-409") {
        controls.querySelectorAll("button").forEach((node) => { node.disabled = node !== cancel; });
      }
    } finally {
      experimentMutationEpoch++;
      delete controls.dataset.busy;
      controls.removeAttribute("aria-busy");
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (fields.planned_for.value && fields.check_in_on.value &&
        fields.check_in_on.value < fields.planned_for.value) {
      feedback.textContent = "Дата сверки должна быть в день попытки или позже.";
      optional.open = true;
      fields.check_in_on.focus();
      return;
    }
    const payload = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));
    commit("edit", payload, "План сохранён. Можно пробовать в своём темпе.");
  });

  if (!["paused", "completed"].includes(step.status) &&
      !(p.movement && p.movement.entries.some(entry => entry.linked))) {
    const toggle = el("button", "today-cta", step.outcome ? "Уточнить результат" : "Отметить результат");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "experiment-check-in");
    const choices = el("fieldset", "outcome-question experiment-check-in");
    choices.id = "experiment-check-in";
    choices.hidden = true;
    choices.appendChild(el("legend", "outcome-question-label", "Удалось попробовать шаг?"));
    choices.appendChild(el("p", "experiment-hint", "Любой исход подходит. Отметку можно исправить."));
    const row = el("div", "outcome-options");
    [
      ["done", "Попробовал", "Попытка отмечена. Теперь можно обсудить, что помогло и что хочется изменить."],
      ["partly", "Частично", "Частичная попытка отмечена. Можно сделать шаг меньше или выбрать другое время."],
      ["not_yet", "Пока нет", "Отмечено без оценки. Можно уменьшить шаг, изменить сроки или взять паузу."],
    ].forEach(([value, label, message]) => {
      const button = el("button", "outcome-option", label);
      button.type = "button";
      button.addEventListener("click", () => commit("check_in", { value }, message));
      row.appendChild(button);
    });
    choices.appendChild(row);
    toggle.addEventListener("click", () => {
      choices.hidden = !choices.hidden;
      toggle.setAttribute("aria-expanded", String(!choices.hidden));
    });
    controls.append(toggle, choices);
  }
  controls.appendChild(editor);
  if (step.status !== "completed") {
    const paused = step.status === "paused";
    const pause = el("button", paused ? "today-cta" : "experiment-pause", paused ? "Вернуться к шагу" : "Поставить шаг на паузу");
    pause.type = "button";
    pause.addEventListener("click", () => commit(paused ? "resume" : "pause", {}, paused
      ? "Шаг снова открыт. Старые сроки убраны: выбери новые, если захочется."
      : "Шаг на паузе. Вернуться можно в любой момент."));
    controls.appendChild(pause);
  }
  controls.appendChild(feedback);
  return controls;
}

function closeToChat() {
  if (hasMemoryDraft()) {
    const draft = document.querySelector('[data-dirty="true"], [data-busy="true"]');
    let ancestor = draft;
    while (ancestor) {
      if (ancestor.tagName === "DETAILS") ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    const panel = draft && draft.closest('[role="tabpanel"]');
    if (panel && typeof switchProfileTab === "function") switchProfileTab(panel.id.replace("panel-", ""), true);
    const notice = "Сначала сохрани или отмени ввод. Если сохранение уже идёт, дождись результата.";
    announceAction(notice);
    let feedback = document.getElementById("draft-exit-feedback");
    if (!feedback) {
      feedback = el("p", "panel-intro", notice);
      feedback.id = "draft-exit-feedback";
      feedback.setAttribute("role", "status");
      (draft || panel || document.getElementById("app")).appendChild(feedback);
    }
    feedback.textContent = notice;
    feedback.scrollIntoView({block: "center", behavior: "instant"});
    return;
  }
  if (tg && typeof tg.close === "function") tg.close();
  else window.location.assign("./landing.html");
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

function renderMemoryUpdate(updated, message) {
  announceAction(message);
  activeProfileTab = "memory";
  renderedProfileFingerprint = null;
  renderFetchedProfile(updated, true);
  queueMicrotask(() => {
    const tab = document.getElementById("tab-memory");
    if (tab) tab.focus();
  });
}

function hasMemoryDraft() {
  return Boolean(document.querySelector('.memory-form[data-dirty="true"], .experiment-form[data-dirty="true"], .experiment-controls[data-busy="true"], .movement-form[data-dirty="true"], .movement-card[data-busy="true"]'));
}

let nativeDraftProtected = null;
function syncDraftCloseProtection() {
  const protectedNow = hasMemoryDraft();
  if (nativeDraftProtected === protectedNow) return;
  const method = protectedNow ? "enableClosingConfirmation" : "disableClosingConfirmation";
  if (tg && typeof tg[method] === "function") tg[method]();
  nativeDraftProtected = protectedNow;
}

function protectMemoryDraft(form) {
  const mark = () => { form.dataset.dirty = "true"; };
  form.addEventListener("input", mark);
  form.addEventListener("change", mark);
  const cancel = el("button", "memory-secondary", "Отменить ввод");
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    form.reset();
    delete form.dataset.dirty;
    const details = form.closest("details");
    if (details) details.open = false;
    refreshProfileView();
  });
  form.appendChild(cancel);
}

function memoryTypeSelect(types, selected) {
  const select = el("select", "memory-input");
  types.forEach((item) => {
    const option = el("option", null, item.label);
    option.value = item.value;
    option.selected = item.value === selected;
    select.appendChild(option);
  });
  return select;
}

function memoryEditForm(item, types) {
  const details = el("details", "memory-edit");
  details.appendChild(el("summary", "memory-edit-toggle", "Исправить"));
  const form = el("form", "memory-form");
  const typeId = "memory-edit-type-" + Math.random().toString(36).slice(2);
  const textId = "memory-edit-text-" + Math.random().toString(36).slice(2);
  const typeLabel = el("label", "memory-field-label", "Что это");
  typeLabel.htmlFor = typeId;
  const select = memoryTypeSelect(types, item.type);
  select.id = typeId;
  const textLabel = el("label", "memory-field-label", "Формулировка");
  textLabel.htmlFor = textId;
  const textarea = el("textarea", "memory-input memory-textarea");
  textarea.id = textId;
  textarea.maxLength = 280;
  textarea.required = true;
  textarea.value = item.content;
  textarea.defaultValue = item.content;
  const status = el("p", "memory-action-status");
  status.setAttribute("role", "status");
  const save = el("button", "memory-primary", "Сохранить исправление");
  save.type = "submit";
  form.append(typeLabel, select, textLabel, textarea, save, status);
  protectMemoryDraft(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    save.textContent = "Сохраняю…";
    try {
      const updated = await controlMemory("edit", {
        key: item.key,
        type: select.value,
        content: textarea.value,
      });
      renderMemoryUpdate(updated, "Запись исправлена.");
    } catch (_) {
      save.disabled = false;
      save.textContent = "Повторить";
      status.textContent = "Не удалось сохранить. Проверь формулировку и связь.";
    }
  });
  details.appendChild(form);
  return details;
}

function memoryRecord(item, types) {
  const card = el("article", "memory-record");
  const head = el("div", "memory-record-head");
  head.appendChild(el("span", "memory-kind", item.type_label));
  if (item.needs_confirmation) head.appendChild(el("span", "memory-pending", "ждёт решения"));
  card.appendChild(head);
  card.appendChild(el("p", "memory-record-text", item.content));

  const provenance = el("details", "memory-origin");
  provenance.appendChild(el("summary", "memory-origin-toggle", "Почему это здесь"));
  const body = el("div", "memory-origin-body");
  body.appendChild(el("p", null, item.source));
  body.appendChild(el("p", null, item.why));
  const dates = [item.recorded_on ? "Записано: " + fmtDate(item.recorded_on) : ""];
  if (item.expires_on) dates.push("Удалится автоматически: " + fmtDate(item.expires_on));
  body.appendChild(el("p", "memory-origin-date", dates.filter(Boolean).join(" · ")));
  provenance.appendChild(body);
  card.appendChild(provenance);

  const actions = el("div", "memory-record-actions");
  const status = el("p", "memory-action-status");
  status.setAttribute("role", "status");
  if (item.needs_confirmation) {
    const confirm = el("button", "memory-primary", "Оставить");
    confirm.type = "button";
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try {
        renderMemoryUpdate(
          await controlMemory("confirm", { key: item.key }),
          "Запись подтверждена.",
        );
      } catch (_) {
        confirm.disabled = false;
        status.textContent = "Не удалось подтвердить. Проверь связь.";
      }
    });
    actions.appendChild(confirm);
  }
  if (item.editable) actions.appendChild(memoryEditForm(item, types));
  const remove = el("button", "memory-danger-quiet", item.needs_confirmation ? "Отклонить" : "Удалить");
  remove.type = "button";
  remove.addEventListener("click", async () => {
    const ok = await confirmAction(
      item.needs_confirmation
        ? "Отклонить эту запись? Она не будет использоваться и не сохранится как факт."
        : "Удалить эту запись? Она перестанет использоваться. История разговора останется до полного сброса данных.",
    );
    if (!ok) return;
    remove.disabled = true;
    remove.textContent = "Удаляю…";
    try {
      const action = item.needs_confirmation ? "reject" : "delete";
      renderMemoryUpdate(
        await controlMemory(action, { key: item.key }),
        item.needs_confirmation ? "Запись отклонена." : "Запись удалена.",
      );
    } catch (_) {
      remove.disabled = false;
      remove.textContent = "Повторить";
      status.textContent = "Не удалось удалить. Проверь связь.";
    }
  });
  actions.appendChild(remove);
  card.append(actions, status);
  return card;
}

function memoryGroup(group, types) {
  if (!group.items.length) return null;
  const section = el("section", "memory-group");
  const head = el("div", "memory-group-head");
  const copy = el("div");
  copy.appendChild(el("h3", "memory-group-title serif", group.label));
  copy.appendChild(el("p", "memory-group-description", group.description));
  head.appendChild(copy);
  const clear = el("button", "memory-group-clear", "Удалить записи раздела");
  clear.type = "button";
  clear.addEventListener("click", async () => {
    const ok = await confirmAction(
      "Удалить все записи раздела «" + group.label + "»? Остальные разделы останутся.",
    );
    if (!ok) return;
    clear.disabled = true;
    try {
      renderMemoryUpdate(
        await controlMemory("delete_class", { class: group.class }),
        "Раздел памяти очищен.",
      );
    } catch (_) {
      clear.disabled = false;
      clear.textContent = "Повторить удаление";
    }
  });
  section.appendChild(head);
  const list = el("div", "memory-record-list");
  group.items.forEach((item) => list.appendChild(memoryRecord(item, types)));
  section.appendChild(list);
  section.appendChild(clear);
  return section;
}

function memoryAddBlock(types) {
  const details = el("details", "memory-add");
  details.appendChild(el("summary", "memory-add-toggle", "Добавить важное самому"));
  const intro = el(
    "p",
    "memory-add-intro",
    "Запиши устойчивый факт, который поможет не повторять важное. Временные чувства и секреты сюда лучше не добавлять.",
  );
  const form = el("form", "memory-form");
  const typeLabel = el("label", "memory-field-label", "Что это");
  typeLabel.htmlFor = "memory-add-type";
  const select = memoryTypeSelect(types, "goal");
  select.id = "memory-add-type";
  const textLabel = el("label", "memory-field-label", "Что помнить");
  textLabel.htmlFor = "memory-add-text";
  const textarea = el("textarea", "memory-input memory-textarea");
  textarea.id = "memory-add-text";
  textarea.maxLength = 280;
  textarea.minLength = 8;
  textarea.required = true;
  textarea.placeholder = "Например: мне помогает сначала записать один маленький следующий шаг";
  const submit = el("button", "memory-primary", "Добавить в память");
  submit.type = "submit";
  const status = el("p", "memory-action-status");
  status.setAttribute("role", "status");
  form.append(typeLabel, select, textLabel, textarea, submit, status);
  protectMemoryDraft(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = "Добавляю…";
    try {
      renderMemoryUpdate(
        await controlMemory("add", { type: select.value, content: textarea.value }),
        "Запись добавлена тобой.",
      );
    } catch (_) {
      submit.disabled = false;
      submit.textContent = "Повторить";
      status.textContent = "Не удалось добавить. Нужно от 8 до 280 символов.";
    }
  });
  details.append(intro, form);
  return details;
}

// Conversation first. Internal tab keys preserve existing links and refresh state.

const PROFILE_TABS = [
  { key: "path", label: "Главная" },
  { key: "sessions", label: "Практики" },
  { key: "memory", label: "Память" },
  { key: "more", label: "Доступ" },
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
  nav.setAttribute("aria-label", "Разделы профиля");
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
      if (panel) {
        panel.inert = !selected;
        panel.setAttribute("aria-hidden", selected ? "false" : "true");
      }
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

let activePracticeTab = null;
let openPracticeReminderKind = null;
let habitQueueOpen = false;

function practiceProgressBlock(p) {
  const path = p.path || {};
  let paused = Boolean(path.nudges_paused_at);
  const remindersAvailable = Boolean(p.is_paid);
  const growthHour = path.growth_reminder_hour;
  const ritualHour = p.ritual ? p.ritual.reminder_hour : null;
  const ritualHabits = (p.habits || []).filter((habit) => cleanText(habit.ritual));
  const ritualHabit = currentRitualHabit(p.habits);
  const otherHabits = (p.habits || []).filter((habit) => habit !== ritualHabit);
  const growthVisible = Boolean(
    path.growth_name || path.growth_step || path.growth_done_count || growthHour !== null
  );
  const ritualVisible = Boolean(
    ritualHabit || ritualHabits.length || path.ritual_done_count || ritualHour !== null
  );
  if (!growthVisible && !ritualVisible) return null;

  const sec = el("section", "practice-progress");
  labelSection(sec, "practice-progress-heading", "Практика сегодня", "section-eyebrow");
  sec.appendChild(
    el(
      "p",
      "practice-progress-intro",
      "Здесь твои сохранённые практики. Их можно менять, приостанавливать или оставлять без отметок.",
    ),
  );
  const cards = el("div", "practice-grid");
  const refreshReminderBadges = [];

  function reminderState(hour) {
    if (hour === null) return { state: "off", text: "Напоминание выключено" };
    if (!remindersAvailable) {
      return { state: "unavailable", text: "Не отправляется: доступ завершён" };
    }
    if (paused) return { state: "paused", text: "Напоминание на паузе" };
    const personalClock = Boolean(
      path.practice_timezone || path.practice_utc_offset_minutes !== null
    );
    const clockLabel = personalClock
      ? "местное"
      : utcOffsetLabel(path.practice_fallback_utc_offset_minutes);
    return {
      state: "active",
      text: "Напоминание " + String(hour).padStart(2, "0") + ":00 · " + clockLabel,
    };
  }

  function practiceCard({
    kind, title, context, name, step, cue, need, fallback, hour, lastDone,
    configured, practiceKey,
  }) {
    let currentHour = hour;
    const card = el("article", "practice-card");
    card.dataset.practiceKind = kind;
    const head = el("div", "practice-card-head");
    head.appendChild(el("h3", "practice-title", title));
    const reminder = reminderState(currentHour);
    const reminderBadge = el("span", "practice-reminder", reminder.text);
    reminderBadge.dataset.state = reminder.state;
    const refreshReminder = () => {
      const next = reminderState(currentHour);
      reminderBadge.textContent = next.text;
      reminderBadge.dataset.state = next.state;
    };
    refreshReminderBadges.push(refreshReminder);
    head.appendChild(reminderBadge);
    card.appendChild(head);
    if (context) card.appendChild(el("p", "practice-context", context));
    if (name) card.appendChild(el("strong", "practice-name", name));
    if (step) card.appendChild(el("p", "practice-step", step));
    const plan = el("dl", "practice-plan");
    [
      ["Сигнал", cue],
      ["Что поддерживает", need],
      ["Минимум на трудный день", fallback],
    ].forEach(([label, value]) => {
      if (!value) return;
      const row = el("div", "practice-plan-row");
      row.appendChild(el("dt", null, label));
      row.appendChild(el("dd", null, value));
      plan.appendChild(row);
    });
    if (plan.children.length) card.appendChild(plan);
    const stats = el("dl", "practice-stats");
    const last = fmtDate(lastDone);
    const lastRow = el("div", "practice-stat");
    lastRow.appendChild(el("dt", null, "Последняя отметка"));
    const lastValue = el("dd", null, last || "Ещё не было");
    lastRow.appendChild(lastValue);
    stats.appendChild(lastRow);
    card.appendChild(stats);
    if (configured) {
      const actions = el("div", "practice-actions");
      const done = el("button", "practice-done", "Отметить попытку");
      done.type = "button";
      done.dataset.practiceAction = "done";
      const discuss = el("button", "practice-discuss", "Обсудить трудный день");
      discuss.type = "button";
      discuss.dataset.practiceAction = "discuss";
      const status = el("p", "practice-action-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      discuss.addEventListener("click", async () => {
        done.disabled = true;
        discuss.disabled = true;
        discuss.setAttribute("aria-busy", "true");
        discuss.textContent = "Готовлю вопрос…";
        status.textContent = "";
        try {
          await postChatIntent(
            kind === "growth" ? "growth_practice" : "ritual_practice",
            newRequestId(),
          );
          discuss.removeAttribute("aria-busy");
          discuss.textContent = "Вопрос уже в чате";
          status.textContent = "Открываю разговор без передачи текста из профиля.";
          window.setTimeout(closeToChat, 350);
        } catch (_) {
          done.disabled = false;
          discuss.disabled = false;
          discuss.removeAttribute("aria-busy");
          discuss.textContent = "Попробовать открыть разговор снова";
          status.textContent = "Не удалось подготовить вопрос в чате. Проверь связь и повтори.";
        }
      });
      done.addEventListener("click", async () => {
        done.disabled = true;
        discuss.disabled = true;
        done.setAttribute("aria-busy", "true");
        done.textContent = "Отмечаю…";
        status.textContent = "";
        try {
          const result = await submitPracticeCheckIn(kind, practiceKey);
          lastValue.textContent = fmtDate(result.done_at) || "сегодня";
          done.removeAttribute("aria-busy");
          done.textContent = result.counted ? "Отмечено сегодня" : "Уже отмечено сегодня";
          discuss.disabled = false;
          status.textContent = result.counted
            ? "Попытка сохранена. Путь вырос ещё на один реальный шаг."
            : "Повторная отметка не увеличила счётчик.";
          const haptic = tg && tg.HapticFeedback;
          if (haptic && typeof haptic.notificationOccurred === "function") {
            haptic.notificationOccurred("success");
          }
        } catch (error) {
          if (error && error.message === "http-409") {
            done.removeAttribute("aria-busy");
            status.textContent = "Практика изменилась после открытия экрана. Обновляю актуальный план…";
            await refreshProfileView();
            if (done.isConnected) {
              done.disabled = false;
              discuss.disabled = false;
              done.textContent = "Повторить после обновления";
              status.textContent = "План пока не обновился. Закрой и снова открой Mini App или повтори чуть позже.";
            }
            return;
          }
          done.disabled = false;
          discuss.disabled = false;
          done.removeAttribute("aria-busy");
          done.textContent = "Повторить отметку";
          status.textContent = "Не удалось сохранить отметку. Проверь связь и повтори.";
        }
      });
      actions.appendChild(done);
      actions.appendChild(discuss);
      card.appendChild(actions);
      card.appendChild(status);

      const settings = el("details", "practice-reminder-settings");
      settings.open = openPracticeReminderKind === kind;
      settings.addEventListener("toggle", () => {
        if (settings.open) openPracticeReminderKind = kind;
        else if (openPracticeReminderKind === kind) openPracticeReminderKind = null;
      });
      settings.appendChild(el("summary", "practice-reminder-toggle", "Настроить напоминание"));
      const settingsBody = el("div", "practice-reminder-body");
      const field = el("label", "practice-reminder-field");
      field.appendChild(el("span", null, "Время"));
      const select = el("select", "practice-reminder-select");
      select.setAttribute("aria-label", "Время напоминания для практики «" + title + "»");
      for (let value = 0; value < 24; value += 1) {
        const label = String(value).padStart(2, "0") + ":00";
        const option = el("option", null, label);
        option.value = String(value);
        select.appendChild(option);
      }
      select.value = String(currentHour === null ? (kind === "growth" ? 9 : 21) : currentHour);
      select.disabled = !remindersAvailable;
      field.appendChild(select);
      settingsBody.appendChild(field);
      const helper = el(
        "p",
        "practice-reminder-help",
        remindersAvailable
          ? "По местному времени устройства. Часовой пояс нужен только для доставки вовремя."
          : "Доставка доступна при активной подписке. Текущее напоминание можно выключить.",
      );
      settingsBody.appendChild(helper);
      if (paused && remindersAvailable) {
        settingsBody.appendChild(
          el(
            "p",
            "practice-reminder-help practice-reminder-help--paused",
            "Сохранение времени возобновит ежедневные напоминания.",
          ),
        );
      }
      const settingActions = el("div", "practice-reminder-actions");
      const saveReminder = el("button", "practice-reminder-save", "Сохранить время");
      saveReminder.type = "button";
      saveReminder.disabled = !remindersAvailable;
      const disableReminder = el("button", "practice-reminder-disable", "Выключить");
      disableReminder.type = "button";
      disableReminder.disabled = currentHour === null;
      const settingStatus = el("p", "practice-reminder-status");
      settingStatus.setAttribute("role", "status");
      settingStatus.setAttribute("aria-live", "polite");

      async function updateReminder(nextHour) {
        saveReminder.disabled = true;
        disableReminder.disabled = true;
        select.disabled = true;
        settingStatus.textContent = nextHour === null ? "Выключаю…" : "Сохраняю…";
        try {
          const result = await submitPracticeReminder(kind, nextHour, practiceKey);
          currentHour = reminderHourOrNull(result.reminder_hour);
          if (kind === "growth") path.growth_reminder_hour = currentHour;
          else if (p.ritual) p.ritual.reminder_hour = currentHour;
          if (currentHour !== null) {
            paused = false;
            path.nudges_paused_at = "";
          }
          path.practice_timezone = cleanText(result.practice_timezone);
          path.practice_utc_offset_minutes = utcOffsetMinutesOrNull(
            result.practice_utc_offset_minutes,
          );
          refreshReminderBadges.forEach((refresh) => refresh());
          disableReminder.disabled = currentHour === null;
          select.disabled = !remindersAvailable;
          saveReminder.disabled = !remindersAvailable;
          settingStatus.textContent = currentHour === null
            ? "Напоминание выключено."
            : "Буду напоминать в " + String(currentHour).padStart(2, "0") + ":00 по местному времени.";
          const haptic = tg && tg.HapticFeedback;
          if (haptic && typeof haptic.notificationOccurred === "function") {
            haptic.notificationOccurred("success");
          }
        } catch (error) {
          if (error && error.message === "http-409") {
            settingStatus.textContent = "Практика изменилась. Обновляю актуальный план…";
            await refreshProfileView();
            if (select.isConnected) {
              select.disabled = !remindersAvailable;
              saveReminder.disabled = !remindersAvailable;
              disableReminder.disabled = currentHour === null;
              settingStatus.textContent = "План пока не обновился. Переоткрой Mini App и повтори настройку.";
            }
            return;
          }
          select.disabled = !remindersAvailable;
          saveReminder.disabled = !remindersAvailable;
          disableReminder.disabled = currentHour === null;
          settingStatus.textContent = "Не удалось изменить время. Проверь связь и повтори.";
        }
      }

      saveReminder.addEventListener("click", () => updateReminder(Number(select.value)));
      disableReminder.addEventListener("click", () => updateReminder(null));
      settingActions.appendChild(saveReminder);
      settingActions.appendChild(disableReminder);
      settingsBody.appendChild(settingActions);
      settingsBody.appendChild(settingStatus);
      settings.appendChild(settingsBody);
      card.appendChild(settings);
    }
    return card;
  }

  function otherHabitsBlock(habits) {
    if (!habits.length) return null;
    const details = el("details", "practice-queue");
    details.open = habitQueueOpen;
    details.addEventListener("toggle", () => {
      habitQueueOpen = details.open;
    });
    const summary = el("summary", "practice-queue-toggle");
    summary.appendChild(el("span", null, "Другие привычки"));
    summary.appendChild(el("span", "practice-queue-count", String(habits.length)));
    details.appendChild(summary);
    const intro = el(
      "p",
      "practice-queue-intro",
      "Они остаются в профиле, но кнопки относятся только к одной текущей практике, чтобы отметки и напоминания не смешивались.",
    );
    details.appendChild(intro);
    const list = el("ul", "practice-queue-list");
    habits.forEach((habit) => {
      const item = el("li", "practice-queue-item");
      const copy = el("span", "practice-queue-copy");
      copy.appendChild(el("strong", null, habit.name));
      copy.appendChild(
        el(
          "small",
          null,
          habit.ritual ? "Ритуал: " + habit.ritual : "Ритуал замещения ещё не выбран",
        ),
      );
      item.appendChild(copy);
      const state = el("span", "practice-queue-state", STATUS_LABELS[habit.status] || "в профиле");
      state.dataset.status = habit.status || "working";
      item.appendChild(state);
      list.appendChild(item);
    });
    details.appendChild(list);
    const switchButton = el("button", "practice-switch-chat", "Выбрать другую в чате");
    switchButton.type = "button";
    const switchStatus = el("p", "practice-action-status");
    switchStatus.setAttribute("role", "status");
    switchStatus.setAttribute("aria-live", "polite");
    switchButton.addEventListener("click", async () => {
      switchButton.disabled = true;
      switchButton.setAttribute("aria-busy", "true");
      switchButton.textContent = "Готовлю вопрос…";
      switchStatus.textContent = "";
      try {
        await postChatIntent("habit_practice_switch", newRequestId());
        switchButton.removeAttribute("aria-busy");
        switchButton.textContent = "Вопрос уже в чате";
        switchStatus.textContent = "Открываю разговор без передачи текста привычек из профиля.";
        window.setTimeout(closeToChat, 350);
      } catch (_) {
        switchButton.disabled = false;
        switchButton.removeAttribute("aria-busy");
        switchButton.textContent = "Попробовать снова";
        switchStatus.textContent = "Не удалось открыть выбор. Проверь связь и повтори.";
      }
    });
    details.appendChild(switchButton);
    details.appendChild(switchStatus);
    return details;
  }

  const entries = [];

  function addEntry(key, label, content) {
    const panel = el("div", "practice-panel");
    panel.id = "practice-panel-" + key;
    panel.dataset.practicePanel = key;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", "practice-tab-" + key);
    panel.appendChild(content);
    entries.push({ key, label, panel });
    cards.appendChild(panel);
  }

  if (growthVisible) {
    addEntry("growth", "Полезная", practiceCard({
      kind: "growth",
      title: "Полезная привычка",
      context: "Небольшое действие, которое ты решил попробовать",
      name: path.growth_name,
      step: path.growth_step,
      cue: "",
      need: "",
      fallback: "",
      hour: growthHour,
      lastDone: path.growth_done_at,
      configured: Boolean(path.growth_step),
      practiceKey: null,
    }));
  }
  if (ritualVisible) {
    const ritualPanel = el("div", "practice-ritual-content");
    if (ritualHabit) {
      ritualPanel.appendChild(practiceCard({
        kind: "ritual",
        title: "Ритуал замещения",
        context: "Сейчас в фокусе привычка «" + ritualHabit.name + "»",
        name: ritualHabit.ritual,
        step: "",
        cue: ritualHabit.trigger,
        need: ritualHabit.serves,
        fallback: ritualHabit.fallback,
        hour: ritualHour,
        lastDone: path.ritual_done_at,
        configured: true,
        practiceKey: ritualHabit.practice_key,
      }));
    } else {
      const unresolved = el("div", "practice-selection-warning");
      unresolved.setAttribute("role", "status");
      unresolved.appendChild(el("strong", null, "Нужно обновить текущую практику"));
      unresolved.appendChild(el("p", null, "Несколько привычек готовы к работе, но активная ещё не определена. Действия временно скрыты, чтобы не записать отметку не туда."));
      const refresh = el("button", "practice-refresh", "Обновить профиль");
      refresh.type = "button";
      refresh.addEventListener("click", () => refreshProfileView());
      unresolved.appendChild(refresh);
      ritualPanel.appendChild(unresolved);
    }
    const queue = otherHabitsBlock(otherHabits);
    if (queue) ritualPanel.appendChild(queue);
    addEntry("ritual", "Замещение", ritualPanel);
  }

  if (entries.length > 1) {
    const tabs = el("div", "practice-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Выбор практики на сегодня");
    const buttons = [];
    const selectPractice = (key, moveFocus) => {
      activePracticeTab = key;
      entries.forEach((entry) => {
        const selected = entry.key === key;
        const button = buttons.find((candidate) => candidate.dataset.practiceTab === entry.key);
        button.setAttribute("aria-selected", selected ? "true" : "false");
        button.tabIndex = selected ? 0 : -1;
        entry.panel.hidden = !selected;
        entry.panel.inert = !selected;
        if (selected && moveFocus) button.focus();
      });
    };
    entries.forEach((entry, index) => {
      const button = el("button", "practice-tab", entry.label);
      button.type = "button";
      button.id = "practice-tab-" + entry.key;
      button.dataset.practiceTab = entry.key;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", entry.panel.id);
      button.addEventListener("click", () => selectPractice(entry.key, false));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowLeft") next = (index - 1 + entries.length) % entries.length;
        if (event.key === "ArrowRight") next = (index + 1) % entries.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = entries.length - 1;
        selectPractice(entries[next].key, true);
      });
      buttons.push(button);
      tabs.appendChild(button);
    });
    sec.appendChild(tabs);
    const growthTime = Date.parse(path.growth_done_at || "") || 0;
    const ritualTime = Date.parse(path.ritual_done_at || "") || 0;
    const fallbackTab = ritualHabit && ritualTime >= growthTime ? "ritual" : "growth";
    const selectedTab = entries.some((entry) => entry.key === activePracticeTab)
      ? activePracticeTab
      : fallbackTab;
    selectPractice(selectedTab, false);
  } else if (entries.length === 1) {
    entries[0].panel.removeAttribute("role");
    entries[0].panel.removeAttribute("aria-labelledby");
  }
  sec.appendChild(cards);
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

function deepSessionPreparation(showUpgrade, safetyPause) {
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
  if (safetyPause) {
    const urgent = el("div", "session-urgent");
    urgent.setAttribute("role", "alert");
    urgent.appendChild(el("strong", null, "Сейчас глубинную сессию лучше отложить"));
    urgent.appendChild(
      el(
        "p",
        null,
        "Вернись в чат за короткой поддержкой. Если есть непосредственная опасность для жизни, позвони 112 или обратись к человеку рядом.",
      ),
    );
    const emergency = el("a", "session-emergency", "Позвонить 112");
    emergency.href = "tel:112";
    urgent.appendChild(emergency);
    const back = el("button", "session-back", "Вернуться в чат");
    back.type = "button";
    back.addEventListener("click", closeToChat);
    urgent.appendChild(back);
    sec.appendChild(urgent);
  } else if (showUpgrade) {
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
  const active = sessions.recent.filter((session) => ["preparing", "active", "integrating"].includes(session.status));
  const history = sessions.recent.filter((session) => ["completed", "aborted"].includes(session.status));
  if (active.length) {
    const current = el("section", "session-group");
    current.appendChild(el("h3", "session-group-title", "Сейчас"));
    active.forEach((session) => current.appendChild(deepSessionCard(session, p.outcome_feedback)));
    panel.appendChild(current);
  }

  panel.appendChild(deepSessionPreparation(p.show_upgrade, p.safety_pause));

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

function memoryPauseBlock(center) {
  const section = el("section", "memory-pause");
  const copy = el("div", "memory-pause-copy");
  copy.appendChild(el("strong", null, center.writes_paused ? "Новые записи на паузе" : "Новые записи включены"));
  copy.appendChild(
    el(
      "span",
      null,
      center.writes_paused
        ? "Разговор продолжится, но Проводник не будет добавлять новую память."
        : "Проводник может сохранять только записи, прошедшие строгий отбор.",
    ),
  );
  const toggle = el("button", "memory-pause-toggle", center.writes_paused ? "Возобновить" : "Поставить на паузу");
  toggle.type = "button";
  toggle.setAttribute("aria-pressed", String(center.writes_paused));
  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    try {
      const action = center.writes_paused ? "resume" : "pause";
      renderMemoryUpdate(
        await controlMemory(action),
        center.writes_paused ? "Новая память снова включена." : "Новые записи поставлены на паузу.",
      );
    } catch (_) {
      toggle.disabled = false;
      toggle.textContent = "Повторить";
    }
  });
  section.append(copy, toggle);
  return section;
}

function memoryControlsBlock(center) {
  const sec = el("section", "memory-controls");
  sec.appendChild(el("h2", "memory-controls-title serif", "Ты управляешь памятью"));
  sec.appendChild(
    el(
      "p",
      "memory-controls-intro",
      "Можно забрать копию или удалить все записи прямо здесь. Рабочие гипотезы можно проверить и исправить выше, в «Темах и рабочих гипотезах».",
    ),
  );
  const status = el("p", "command-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const actions = el("div", "memory-global-actions");
  const exportButton = el("button", "memory-secondary", "Скачать мою копию");
  exportButton.type = "button";
  exportButton.addEventListener("click", async () => {
    exportButton.disabled = true;
    exportButton.textContent = "Готовлю файл…";
    try {
      await downloadMemoryExport();
      exportButton.disabled = false;
      exportButton.textContent = "Скачать ещё раз";
      status.textContent = "Копия подготовлена. Проверь загрузки устройства.";
    } catch (_) {
      exportButton.disabled = false;
      exportButton.textContent = "Повторить скачивание";
      status.textContent = "Не удалось подготовить копию. Проверь связь.";
    }
  });
  actions.appendChild(exportButton);
  const total = center.groups.reduce((sum, group) => sum + group.items.length, 0);
  const deleteAll = el("button", "memory-danger", "Удалить всю память");
  deleteAll.type = "button";
  deleteAll.disabled = total === 0;
  deleteAll.addEventListener("click", async () => {
    const ok = await confirmAction(
      "Удалить все записи памяти? Они перестанут использоваться. Профильные гипотезы и история чата очищаются отдельно через полный сброс.",
    );
    if (!ok) return;
    deleteAll.disabled = true;
    deleteAll.textContent = "Удаляю…";
    try {
      renderMemoryUpdate(await controlMemory("delete_all"), "Вся память удалена.");
    } catch (_) {
      deleteAll.disabled = false;
      deleteAll.textContent = "Повторить удаление";
      status.textContent = "Не удалось удалить память. Проверь связь.";
    }
  });
  actions.appendChild(deleteAll);
  sec.appendChild(actions);
  sec.appendChild(status);
  const back = el("button", "memory-chat", "Вернуться в чат");
  back.type = "button";
  back.addEventListener("click", closeToChat);
  sec.appendChild(back);
  return sec;
}

function memoryPanel(p) {
  const center = p.memory_center || { writes_paused: false, groups: [], manual_types: [] };
  const panel = el("section", "memory-panel");
  const header = el("header", "panel-header");
  header.appendChild(el("span", "section-eyebrow", "Память"));
  header.appendChild(el("h2", "panel-title serif", "Что остаётся между разговорами"));
  header.appendChild(el("p", "panel-intro", "Здесь видно, что сохранено, откуда это взялось и зачем может пригодиться. Гипотезы о смысле остаются отдельными и не выдаются за факты."));
  panel.appendChild(header);
  panel.appendChild(memoryPauseBlock(center));
  if (center.manual_types.length) panel.appendChild(memoryAddBlock(center.manual_types));
  let hasItems = false;
  center.groups.forEach((group) => {
    const block = memoryGroup(group, center.manual_types);
    if (block) {
      hasItems = true;
      panel.appendChild(block);
    }
  });
  if (!hasItems) {
    const empty = el("div", "memory-empty");
    empty.appendChild(el("strong", null, "Память пока пуста"));
    empty.appendChild(el("p", null, "Можно добавить устойчивый факт самому. Проводник не сохраняет весь разговор, временное настроение или догадки."));
    panel.appendChild(empty);
  }
  panel.appendChild(profileInsightsBlock(p));
  panel.appendChild(memoryControlsBlock(center));
  return panel;
}

function legalLinks() {
  const nav = el("nav", "legal-links");
  nav.setAttribute("aria-label", "Условия и данные");
  [["./privacy.html", "Приватность"], ["./offer.html", "Оферта"], ["./refund.html", "Возврат"]].forEach(([href, label]) => {
    const link = el("a", null, label);
    link.href = href;
    link.rel = "noreferrer";
    link.addEventListener("click", (event) => {
      if (!tg || typeof tg.openLink !== "function") return;
      event.preventDefault();
      tg.openLink(new URL(href, window.location.href).href);
    });
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
    p.show_upgrade ? "Подписка" : (p.is_paid ? "Подписка активна" : "Доступ открыт"),
  ));
  header.appendChild(el(
    "p",
    "panel-intro",
    p.show_upgrade
      ? "Условия доступа. Решить можно в удобное время."
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
  if (p.invite_url) panel.appendChild(optionalBlock("Поделиться ботом", shareRow(p.referral, p.invite_url)));
  panel.appendChild(legalLinks());
  const foot = el("footer", "footer");
  foot.appendChild(el("p", null, "MindCoach помогает с самонаблюдением, но не ставит диагнозов и не заменяет специалиста."));
  panel.appendChild(foot);
  return panel;
}

// Movement is an optional entry into the existing single-step loop.
const MOVEMENT_KINDS = {
  walk: ["Прогулка", "В удобном темпе, если место и самочувствие позволяют."],
  mobility: ["Мягкое движение", "Привычные удобные движения, можно сидя. Без боли и усилия."],
  break: ["Подвижная пауза", "Сменить положение и немного подвигаться, как сейчас удобно."],
  rest: ["Отдых", "Можно просто дать себе паузу. Двигаться не обязательно."],
};
const MOVEMENT_STATUS = {chosen: "Выбрано", attempted: "Попробовал", completed: "Завершено", declined: "Решил не пробовать"};

function movementBlock(p) {
  let m = p.movement;
  if (!m || !m.revision || (!m.enabled && !m.entries.length)) return null;
  const card = el("section", "movement-card");
  card.id = "movement";
  card.append(el("span", "section-eyebrow", "Небольшая пауза для себя"),
    el("h2", "serif", "Движение по силам"),
    el("p", "movement-intro", "Выбрать посильное движение и заметить, как тебе после. Без нормы и обязательных отметок."));
  const feedback = el("p", "movement-feedback");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  const button = (label, action, primary = false) => {
    const b = el("button", primary ? "memory-primary" : "memory-secondary", label);
    b.type = "button"; b.addEventListener("click", action); return b;
  };
  const select = (form, key, label, options, value) => {
    const wrap = el("label", "movement-field");
    wrap.appendChild(el("span", "memory-field-label", label));
    const input = el("select", "memory-input"); input.name = key;
    for (const [v, title] of options) { const o = el("option", null, title); o.value = v; o.defaultSelected = String(v) === String(value); input.appendChild(o); }
    input.value = value; wrap.appendChild(input); form.appendChild(wrap); return input;
  };
  const energyOptions = [["", "Пропустить"], ["1", "1 · Совсем мало"], ["2", "2 · Мало"], ["3", "3 · Средне"], ["4", "4 · Достаточно"], ["5", "5 · Много"]];
  const rating = input => input.value === "" ? null : Number(input.value);
  const dirty = form => {
    form.classList.add("movement-form");
    form.addEventListener("input", () => {form.dataset.dirty = "true";});
    form.addEventListener("change", () => {form.dataset.dirty = "true";});
  };
  let pending = null;
  async function commit(operation, payload) {
    if (card.dataset.busy === "true") return;
    if (document.querySelector('.memory-form[data-dirty="true"], .experiment-form[data-dirty="true"]')) {
      feedback.textContent = "Сначала сохрани или отмени правки текущего шага или памяти. Этот черновик останется здесь."; return;
    }
    const signature = JSON.stringify([operation, payload]);
    if (!pending || pending.signature !== signature) pending = {signature, id: crypto.randomUUID(), revision: m.revision};
    card.dataset.busy = "true"; card.setAttribute("aria-busy", "true"); experimentMutationEpoch++;
    const controls = Array.from(card.querySelectorAll("button, input, select"));
    const wasDisabled = controls.map(n => n.disabled); controls.forEach(n => {n.disabled = true;});
    feedback.textContent = "Сохраняю…";
    try {
      const res = await fetchWithDeadline(freshApiUrl("/api/movement/control"), {
        method: "POST", headers: apiHeaders(tg && tg.initData || "", true), cache: "no-store",
        body: JSON.stringify({operation, payload, revision: pending.revision, request_id: pending.id}),
      });
      if (!res.ok) throw new Error("http-" + res.status);
      const body = await res.json();
      if (!body.movement || !body.movement.revision) throw new Error("invalid-response");
      p.movement = body.movement; p.change_experiment = body.change_experiment || {};
      // Reconcile the existing plan/dates too, so the next quiet poll does not remount
      // an otherwise unchanged movement form while the person is reading it.
      const refreshed = await fetchProfile(true).catch(() => null);
      delete card.dataset.busy; card.querySelectorAll(".movement-form").forEach(f => {delete f.dataset.dirty;});
      renderFetchedProfile(refreshed || p, true);
      const next = document.getElementById("movement");
      if (next) {
        next.querySelector(".movement-feedback").textContent = "Сохранено. Можно изменить решение в любой момент.";
        const focus = next.querySelector("button"); if (focus) focus.focus({preventScroll: true});
        next.scrollIntoView({block: "nearest", behavior: "instant"});
      }
      announceAction("Сохранено");
    } catch (error) {
      feedback.textContent = error.message === "http-401"
        ? "Сессия завершилась. Скопируй нужные правки и открой мини-апп из чата заново."
        : error.message === "http-409"
          ? "Данные уже изменились. Черновик остался здесь. Проверь актуальный шаг перед повторным сохранением."
          : error.message === "http-400"
            ? "Не удалось сохранить эти поля. Проверь выбор. Если журнал заполнен, выгрузи данные и удали ненужные записи."
            : "Не удалось подтвердить сохранение. Черновик остался здесь. Проверь связь и повтори: дубликата не будет.";
      if (error.message === "http-409") feedback.appendChild(button("Проверить актуальный шаг", async () => {
        try {
          const fresh = await fetchProfile(true);
          if (!fresh || !fresh.movement) return;
          m = fresh.movement; p.change_experiment = fresh.change_experiment; pending = null;
          feedback.textContent = "Сейчас: " + (fresh.change_experiment.action || "текущий шаг не выбран") + ". Проверь черновик и сохрани ещё раз, если решение подходит.";
        } catch (_) { feedback.textContent = "Не удалось загрузить актуальные данные. Черновик сохранён в открытом мини-аппе."; }
      }));
    } finally {
      delete card.dataset.busy; card.removeAttribute("aria-busy"); experimentMutationEpoch++;
      controls.forEach((n, i) => {n.disabled = wasDisabled[i];});
    }
  }
  const cancel = form => button("Отменить изменения", () => {
    delete form.dataset.dirty; pending = null; form.closest("details").open = false;
    form.reset(); refreshProfileView();
  });
  function entryEditor(entry) {
    const details = el("details", "movement-entry");
    details.appendChild(el("summary", null, `${MOVEMENT_KINDS[entry.kind][0]} · до ${entry.minutes} мин · ${fmtDateOnly(entry.local_date)}`));
    details.appendChild(el("p", "movement-meta", MOVEMENT_STATUS[entry.status] + (entry.corrected ? " · исправлено" : "") + (entry.paused ? " · шаг на паузе" : "")));
    if (entry.before !== null || entry.after !== null) details.appendChild(el("p", "movement-pair", `Энергия: ${entry.before === null ? "без отметки" : entry.before + "/5"} → ${entry.after === null ? "без отметки" : entry.after + "/5"}`));
    details.addEventListener("toggle", () => {
      if (!details.open || details.dataset.built) return; details.dataset.built = "true";
      const form = el("form", "movement-form"); dirty(form);
      if (entry.paused) form.appendChild(el("p", "movement-hint", "Шаг на паузе. Вернуться к нему можно в разделе «Текущий шаг, сроки и пауза»."));
      const status = select(form, "status", "Что фактически получилось", Object.entries(MOVEMENT_STATUS), entry.status);
      const after = select(form, "after", "Энергия после, необязательно", energyOptions, entry.after == null ? "" : String(entry.after));
      const effect = select(form, "effect", "Помогло ли это тебе сейчас, необязательно", [["skip", "Пропустить"], ["helped", "Да, помогло"], ["same", "Ничего не изменилось"], ["worse", "Стало хуже"], ["unsure", "Не уверен"]], entry.effect);
      const edit = el("details", "movement-more"); edit.appendChild(el("summary", null, "Исправить отметку до"));
      const before = select(edit, "before", "Энергия до", energyOptions, entry.before == null ? "" : String(entry.before));
      edit.appendChild(el("p", "movement-hint", "Поздняя отметка «до» сохранится в журнале, но не создаст пару для наблюдений.")); form.appendChild(edit);
      const notice = el("p", "movement-hint"); form.appendChild(notice);
      const update = () => {
        const tried = status.value === "attempted" || status.value === "completed";
        after.disabled = effect.disabled = !tried;
        notice.textContent = tried && effect.value === "worse"
          ? "Можно остановиться и выбрать отдых. При боли или недомогании не продолжай нагрузку; обратись за медицинской помощью по ситуации."
          : "Пропуск отметки ничего не говорит о самочувствии. Любой исход подходит.";
      }; status.addEventListener("change", update); effect.addEventListener("change", update); update();
      const save = el("button", "memory-primary", "Сохранить отметку"); save.type = "submit";
      form.append(save, cancel(form));
      form.addEventListener("submit", e => {e.preventDefault(); const tried = ["attempted", "completed"].includes(status.value);
        commit("report", {id: entry.id, status: status.value, before: rating(before), after: tried ? rating(after) : null, effect: tried ? effect.value : "skip"});
      });
      const deletion = el("details", "movement-delete"); deletion.appendChild(el("summary", null, "Удалить запись"));
      deletion.appendChild(el("p", "movement-hint", "Запись и связанный с ней текущий шаг будут удалены. Сначала можно выгрузить свои данные."));
      deletion.append(button("Удалить эту запись", () => commit("delete", {id: entry.id})), button("Оставить запись", () => {deletion.open = false;}));
      form.appendChild(deletion); details.appendChild(form);
    });
    return details;
  }
  const active = m.entries.find(e => e.linked);
  if (active) {
    if (active.paused) card.appendChild(el("p", "movement-hint", "Шаг на паузе. Можно отдыхать; исправление записей остаётся доступным."));
    const pendingEntry = entryEditor(active); card.appendChild(pendingEntry);
    card.appendChild(button(active.status === "chosen" && !active.paused ? "Отметить, как прошло" : "Посмотреть или исправить отметку", () => {pendingEntry.open = true;}, true));
  }
  if (m.enabled && !m.safety_pause) {
    const composer = el("details", "movement-composer");
    composer.appendChild(el("summary", "movement-open", active ? "Выбрать другое движение" : "Подобрать движение"));
    const form = el("form", "movement-form"); dirty(form);
    const offerId = crypto.randomUUID(); let offered = false;
    composer.addEventListener("toggle", () => {if (composer.open && !offered) {offered = true; submitOutcome("movement_offer", "shown", "movement", offerId).catch(() => {});}});
    const need = select(form, "need", "Чего сейчас хочется", [["switch", "Переключиться"], ["calm", "Успокоиться"], ["energy", "Почувствовать больше энергии"]], "switch");
    const minutes = select(form, "minutes", "Сколько времени посильно", [["1", "Около минуты"], ["3", "До 3 минут"], ["5", "До 5 минут"], ["10", "До 10 минут"], ["15", "До 15 минут"], ["30", "До 30 минут"]], "3");
    const more = el("details", "movement-more"); more.appendChild(el("summary", null, "Уточнить под себя, необязательно"));
    const before = select(more, "before", "Сколько энергии сейчас", energyOptions, "");
    const healthLabel = el("label", "movement-check"); const health = el("input"); health.type = "checkbox"; health.name = "unwell";
    healthLabel.append(health, document.createTextNode("Есть боль, недомогание или сомнения, можно ли двигаться")); more.appendChild(healthLabel);
    form.appendChild(more);
    const choices = el("fieldset", "movement-options"); choices.appendChild(el("legend", null, "Что тебе подходит"));
    const radios = {};
    for (const [kind, [label, description]] of Object.entries(MOVEMENT_KINDS)) {
      const row = el("label", "movement-option"); const input = el("input"); input.type = "radio"; input.name = "kind"; input.value = kind;
      radios[kind] = input; const text = el("span"); text.append(el("strong", null, label), el("span", null, description)); row.append(input, text); choices.appendChild(row);
    }
    const hint = el("p", "movement-hint"); let manualKind = false;
    choices.addEventListener("change", () => {manualKind = true; refreshChoice();});
    const replaceLabel = el("label", "movement-check"); const replace = el("input"); replace.type = "checkbox"; replace.name = "replace";
    replaceLabel.append(replace, document.createTextNode("Заменить мой текущий шаг этим движением"));
    function refreshChoice() {
      const preferred = m.preferences.personalize && m.preferences.preferred !== "any" ? m.preferences.preferred : null;
      const suggested = health.checked ? "rest" : preferred || (rating(before) !== null && rating(before) <= 2 ? "break" : Number(minutes.value) >= 10 ? "walk" : need.value === "calm" ? "mobility" : "break");
      if (!manualKind || health.checked) radios[suggested].checked = true;
      Object.entries(radios).forEach(([k, input]) => {input.disabled = health.checked && k !== "rest";});
      const selected = Object.keys(radios).find(k => radios[k].checked);
      replaceLabel.hidden = !p.change_experiment.action || p.change_experiment.status === "completed" || selected === "rest";
      hint.textContent = health.checked
        ? "Сейчас можно выбрать отдых. Нагрузку при боли или недомогании не подбираем. Обсуди ограничения с врачом; при сильной боли в груди, обмороке или выраженной одышке нужна срочная помощь. Этот ответ не сохраняется."
        : "Это вариант для пробы, а не обещание улучшения. Можно сократить время, остановиться или выбрать отдых.";
    }
    [need, minutes, before, health].forEach(input => input.addEventListener("change", refreshChoice)); refreshChoice();
    form.append(choices, hint, replaceLabel);
    const save = el("button", "memory-primary", "Выбрать этот шаг"); save.type = "submit";
    form.append(save, button("Свернуть, оставив черновик", () => {form.dataset.dirty = "true"; composer.open = false;}), cancel(form));
    form.addEventListener("submit", e => {e.preventDefault(); const kind = Object.keys(radios).find(k => radios[k].checked);
      if (!replaceLabel.hidden && !replace.checked) {feedback.textContent = "У тебя уже есть шаг. Для замены отметь своё решение выше; можно оставить прежний шаг."; replace.focus(); return;}
      commit("choose", {id: offerId, kind, minutes: Number(minutes.value), need: need.value, before: rating(before), ...practiceClockMetadata(), replace: replace.checked});
    });
    composer.appendChild(form); card.appendChild(composer);
    if (active && !active.paused) card.appendChild(button("Выбрать отдых и паузу", () => commit("choose", {
      id: offerId, kind: "rest", minutes: 1, need: "switch", before: null, ...practiceClockMetadata(), replace: false,
    })));
    else card.appendChild(button("Сейчас без движения", () => {submitOutcome("movement_choice", "declined", "movement", offerId + ":declined").catch(() => {}); composer.open = false; feedback.textContent = "Можно оставить всё как есть. Отдых не обнуляет твой опыт.";}));
  } else card.appendChild(el("p", "movement-hint", "Подбор движения сейчас на паузе. Записи и управление данными доступны."));
  const history = el("details", "movement-history"); history.appendChild(el("summary", null, "Мои наблюдения и записи"));
  if (!m.observations.length) history.appendChild(el("p", "movement-hint", "Для личных наблюдений пока недостаточно сопоставимых отметок. Не нужно заполнять их специально: движение возможно и без дневника."));
  for (const observation of m.observations) {
    const row = el("div", "movement-observation");
    row.append(el("h3", null, `${MOVEMENT_KINDS[observation.kind][0]} · выбор ${observation.duration}`),
      el("p", "movement-pair", `В ${observation.higher} из ${observation.pairs} случаев энергии после было больше.`),
      el("p", "movement-hint", `Столько же: ${observation.same}. Меньше: ${observation.lower}. Энергии до: ${observation.baseline}. Это совпадение в твоих отметках, а не доказательство причины.`)); history.appendChild(row);
  }
  history.appendChild(el("p", "movement-hint", "Окно 28 дней. Нужны 6 пар на 3 разных днях: одно движение, похожая выбранная длительность и энергия до; между отметками до 2 часов. Пропуски не считаются ни успехом, ни ухудшением."));
  if (!m.entries.length) history.appendChild(el("p", null, "Записей пока нет."));
  let shown = 0; const list = el("div"); history.appendChild(list);
  const loadMore = button("Показать ещё записи", () => appendEntries());
  function appendEntries() {m.entries.slice(shown, shown + 10).forEach(e => list.appendChild(entryEditor(e))); shown += 10; loadMore.hidden = shown >= m.entries.length;}
  appendEntries(); history.appendChild(loadMore); card.appendChild(history);
  const settings = el("details", "movement-settings"); settings.appendChild(el("summary", null, "Предпочтения и мои данные"));
  const settingsForm = el("form", "movement-form"); dirty(settingsForm);
  const personalLabel = el("label", "movement-check"); const personal = el("input"); personal.type = "checkbox"; personal.checked = personal.defaultChecked = m.preferences.personalize;
  personalLabel.append(personal, document.createTextNode("Учитывать мои предпочтения и наблюдения о движении в подборе и ИИ-чате")); settingsForm.appendChild(personalLabel);
  const preferred = select(settingsForm, "preferred", "Обычно мне удобнее", [["any", "Без предпочтения"], ...Object.entries(MOVEMENT_KINDS).map(([k, v]) => [k, v[0]])], m.preferences.preferred);
  settingsForm.appendChild(el("p", "movement-hint", "Записи остаются твоими данными. Они не становятся психологическими фактами. Новые напоминания не включаются; срок и пауза настраиваются у текущего шага."));
  const settingsSave = el("button", "memory-primary", "Сохранить предпочтения"); settingsSave.type = "submit";
  settingsForm.append(settingsSave, cancel(settingsForm)); settingsForm.addEventListener("submit", e => {e.preventDefault(); commit("preferences", {personalize: personal.checked, preferred: preferred.value});});
  settings.appendChild(settingsForm);
  settings.appendChild(button("Выгрузить мои данные", () => {const tab = document.getElementById("tab-memory"); if (tab) tab.click(); announceAction("Экспорт доступен во вкладке памяти, в управлении данными.");}));
  const clear = el("details", "movement-delete"); clear.append(el("summary", null, "Удалить все записи движения"), el("p", "movement-hint", "Удалятся журнал, предпочтения и связанный текущий шаг. Это нельзя отменить."), button("Удалить всё движение", () => commit("clear", {})), button("Оставить данные", () => {clear.open = false;})); settings.appendChild(clear);
  const frictionId = crypto.randomUUID();
  const friction = el("fieldset", "movement-friction"); friction.appendChild(el("legend", null, "Что мешает, если хочется сказать"));
  for (const [value, label] of [["pressure", "Чувствую давление"], ["complexity", "Слишком сложно"], ["reminders", "Мешают напоминания"], ["none", "Всё подходит"]]) friction.appendChild(button(label, async () => {
    try {await submitOutcome("movement_friction", value, "movement", frictionId); feedback.textContent = value === "reminders" ? "Замечание записано. В чате: /menu → Мои данные → Не писать мне первым. Там же можно выключить ежедневные напоминания." : "Спасибо, замечание записано."; friction.disabled = true;}
    catch (_) {feedback.textContent = "Замечание не сохранилось. Можно повторить.";}
  })); settings.appendChild(friction); card.append(settings, feedback); return card;
}

// Optional tools retain their saved records and paid access, away from the home screen.
function optionalBlock(title, node, key) {
  if (!node) return null;
  const details = el("details", "optional-tool");
  if (key) details.id = key;
  details.append(el("summary", null, title), node);
  return details;
}

function practicesPanel(p) {
  const panel = el("section", "practices-panel");
  panel.append(el("h2", "panel-title serif", "Если нужен другой формат"),
    el("p", "panel-intro", "Всё здесь по желанию. Для поддержки достаточно обычного разговора."));
  const blocks = [
    optionalBlock("Привычки и сохранённые практики", practiceProgressBlock(p)),
    optionalBlock("Движение по силам", movementBlock(p), "movement-tool"),
    optionalBlock("Глубинные сессии и их итоги", deepSessionsPanel(p)),
  ];
  blocks.filter(Boolean).forEach(block => panel.appendChild(block));
  const hint = el("p", "panel-intro", "Другие форматы можно открыть в чате: /menu → Практики. Можно остановиться в любой момент.");
  panel.appendChild(hint);
  return panel;
}

function pathPanel(p) {
  const panel = el("section", "path-panel");
  const intro = el("section", "conversation-home");
  intro.append(el("h2", "panel-title serif", "Можно просто поговорить"),
    el("p", "panel-intro", "Расскажи, что сейчас у тебя на уме. Не нужно готовиться, заполнять профиль или выбирать задание."));
  const chat = el("button", "today-cta", "Вернуться в чат");
  chat.type = "button";
  chat.addEventListener("click", closeToChat);
  intro.appendChild(chat);
  panel.appendChild(intro);
  const step = todayBlock(p);
  if (step) {
    const saved = optionalBlock("Твой сохранённый шаг", step, "saved-step");
    saved.open = true;
    panel.appendChild(saved);
    const result = stepAttemptBlock(p);
    if (result) saved.appendChild(result);
    if (p.movement && p.movement.entries.some(entry => entry.linked)) {
      const movement = el("button", "command-action", "Открыть записи движения");
      movement.type = "button";
      movement.addEventListener("click", () => openMovement());
      saved.appendChild(movement);
    }
  }
  const feedback = optionalBlock("Оставить отзыв о разговоре", conversationOutcomeBlock(p));
  if (feedback) panel.appendChild(feedback);
  return panel;
}

function openMovement() {
  if (typeof switchProfileTab === "function") switchProfileTab("sessions", true);
  const details = document.getElementById("movement-tool");
  if (details) {
    details.open = true;
    details.scrollIntoView({block: "start", behavior: "instant"});
  }
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
    el("span", "brand-kicker", "Мой профиль · " + (p.pseudonym || "без имени")),
  );
  identity.appendChild(brandHeading);
  top.appendChild(identity);
  const updated = fmtDate(p.updated_at);
  if (updated) top.appendChild(el("div", "datepill", "обновлено " + updated));
  root.appendChild(top);

  root.appendChild(
    profileTabShell({
      path: pathPanel(p),
      sessions: practicesPanel(p),
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
    "Здесь пока нет записей",
    "Можно начать с разговора в чате. Заполнять профиль и выбирать задание необязательно.",
    "○",
    [{ label: "Начать разговор", onClick: closeToChat }],
  );
}

let refreshTimer = null;
let refreshInFlight = null;
let refreshQueued = false;
let renderedProfileFingerprint = null;
let sessionExpired = false;
let movementLaunchHandled = false;
let activationPending = false;

function profileRenderFingerprint(profile) {
  if (!profile) return "null";
  // Dynamics timestamps are presentation-only and must not remount the whole page.
  const stable = { ...profile };
  delete stable.dynamics;
  if (stable.outcome_feedback) stable.outcome_feedback = stable.outcome_feedback.filter(row => row.measurement_point !== "movement");
  return JSON.stringify(stable);
}

function renderFetchedProfile(profile, replaceDrafts = false) {
  // A background extraction can finish while the person is correcting memory.
  // Preserve their draft even if the field has lost focus or its tab is hidden.
  if (!replaceDrafts && hasMemoryDraft()) return false;
  // Polling/lifecycle events usually return the same document. Replacing the whole DOM
  // in that case resets scroll, focus and the star map, making a quiet refresh look like
  // a page reload. Only reconcile the view when the payload actually changed.
  const fingerprint = profileRenderFingerprint(profile);
  if (fingerprint === renderedProfileFingerprint) return false;
  renderedProfileFingerprint = fingerprint;
  setView(profile ? renderProfile(profile) : renderEmpty());
  if (!movementLaunchHandled && window.location.hash === "#movement" && document.getElementById("movement")) {
    movementLaunchHandled = true;
    openMovement();
  }
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
    const epoch = experimentMutationEpoch;
    try {
      const profile = await fetchProfile(true);
      if (epoch === experimentMutationEpoch) renderFetchedProfile(profile);
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
  // Protect native Telegram close/swipe as well as our own chat button.
  const draftObserver = new MutationObserver(syncDraftCloseProtection);
  draftObserver.observe(document.getElementById("app"), {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ["data-dirty", "data-busy"],
  });
  window.addEventListener("beforeunload", event => {
    if (!hasMemoryDraft()) return;
    event.preventDefault();
    event.returnValue = "";
  });
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
