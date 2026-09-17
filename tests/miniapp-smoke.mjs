import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const boot = await readFile(new URL("../miniapp-boot.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const landing = await readFile(new URL("../landing.html", import.meta.url), "utf8");
const offer = await readFile(new URL("../offer.html", import.meta.url), "utf8");

assert.match(html, /role="status"[^>]*aria-live="polite"/);
assert.match(html, /viewport-fit=cover/);
assert.match(html, /styles\.css\?v=20260913-calm-core/);
assert.match(boot, /config\.onerror = showFailure/);
assert.match(boot, /app\.onerror = showFailure/);
assert.match(boot, /today\.onerror = showFailure/);
assert.match(boot, /setTimeout\(showFailure, 15000\)/);
assert.match(boot, /assetVersion = "20260913-calm-core"/);
assert.doesNotMatch(boot, /app\.src = ".\/app\.js\?v=" \+ configVersion/);

assert.match(app, /new AbortController\(\)/);
assert.match(app, /NETWORK_TIMEOUT_MS = 10000/);
assert.match(app, /\/api\/profile\?refresh=1/);
assert.match(app, /function normalizeProfile\(raw\)/);
const reminderNormalizerSource = app.match(/function reminderHourOrNull\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(reminderNormalizerSource, "reminder normalizer must stay independently testable");
const reminderHourOrNull = vm.runInNewContext("(" + reminderNormalizerSource + ")");
assert.equal(reminderHourOrNull(null), null);
assert.equal(reminderHourOrNull(undefined), null);
assert.equal(reminderHourOrNull(""), null);
assert.equal(reminderHourOrNull("   "), null);
assert.equal(reminderHourOrNull(false), null);
assert.equal(reminderHourOrNull([]), null);
assert.equal(reminderHourOrNull("21"), 21);
assert.equal(reminderHourOrNull(0), 0);
assert.equal(reminderHourOrNull(24), null);
const offsetNormalizerSource = app.match(/function utcOffsetMinutesOrNull\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(offsetNormalizerSource, "timezone offset normalizer must stay independently testable");
const utcOffsetMinutesOrNull = vm.runInNewContext("(" + offsetNormalizerSource + ")");
assert.equal(utcOffsetMinutesOrNull(null), null);
assert.equal(utcOffsetMinutesOrNull(""), null);
assert.equal(utcOffsetMinutesOrNull(false), null);
assert.equal(utcOffsetMinutesOrNull("180"), 180);
assert.equal(utcOffsetMinutesOrNull(-720), -720);
assert.equal(utcOffsetMinutesOrNull(841), null);
const currentRitualSource = app.match(/function currentRitualHabit\(habits\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(currentRitualSource, "current ritual selector must stay independently testable");
const currentRitualHabit = vm.runInNewContext("(" + currentRitualSource + ")", {
  arrayOfObjects: (value) => Array.isArray(value) ? value.filter(Boolean) : [],
  cleanText: (value) => typeof value === "string" ? value.trim() : "",
});
const ritualOne = { ritual: "чай", is_current_practice: false };
const ritualTwo = { ritual: "прогулка", is_current_practice: true };
assert.equal(currentRitualHabit([ritualOne]), ritualOne);
assert.equal(currentRitualHabit([ritualOne, ritualTwo]), ritualTwo);
assert.equal(currentRitualHabit([ritualOne, { ritual: "книга" }]), null);
assert.match(app, /function normalizeDeepSessions\(value\)/);
assert.match(app, /p\.deep_sessions = normalizeDeepSessions\(p\.deep_sessions\)/);
assert.match(app, /DEEP_SESSION_STATUSES/);
assert.match(app, /exactContract = Array\.isArray\(value\)/);
assert.match(app, /result\.user_words/);
assert.match(app, /takeaway: cleanText\(result\.takeaway\)/);
assert.match(app, /next_step: cleanText\(result\.next_step\)/);
assert.doesNotMatch(app, /raw_transcript|crisis_reason/);

assert.match(app, /role", "tablist"/);
assert.match(app, /role", "tabpanel"/);
assert.match(app, /ArrowLeft/);
assert.match(app, /BackButton/);
assert.match(app, /function pathPanel\(p\)/);
assert.match(app, /function practiceProgressBlock\(p\)/);
assert.match(app, /Практика сегодня/);
assert.match(app, /growth_reminder_hour/);
assert.match(app, /\/api\/practice\/check-in/);
assert.match(app, /\/api\/practice\/reminder/);
assert.match(app, /practice_key: practiceKey/);
assert.match(app, /function currentRitualHabit\(habits\)/);
assert.match(app, /Другие привычки/);
assert.match(app, /Выбрать другую в чате/);
assert.match(app, /habit_practice_switch/);
assert.match(app, /discuss\.disabled = false/);
assert.match(app, /dataset\.practiceAction/);
assert.match(app, /practiceClockMetadata/);
assert.match(app, /По местному времени устройства/);
assert.match(app, /practice_fallback_utc_offset_minutes/);
assert.match(app, /Не отправляется: доступ завершён/);
assert.match(app, /Отметить попытку/);
assert.match(app, /growth_practice/);
assert.match(app, /ritual_practice/);
assert.match(app, /Напоминание выключено/);
assert.match(app, /if \(hour === null\).*if \(paused\)/s);
assert.match(styles, /\.practice-progress/);
assert.match(styles, /\.practice-done/);
assert.match(styles, /\.practice-reminder-settings/);
assert.doesNotMatch(app, /function changePathBlock/);
assert.match(app, /\/api\/outcomes/);
assert.match(app, /function outcomeQuestion\(/);
assert.match(app, /без текста и темы/);
assert.match(app, /Любой исход подходит/);
assert.match(app, /deep_helpfulness/);
assert.match(app, /deep_followup/);
assert.doesNotMatch(app, /outcome_feedback.*intention|outcome_feedback.*user_words/);
assert.match(app, /function deepSessionsPanel\(p\)/);
assert.match(app, /Дословно из твоих сообщений/);
assert.match(app, /Выдели 20–30 минут/);
assert.match(app, /не за рулём и не на работе/);
assert.doesNotMatch(app, /Твои подтверждённые слова/);
assert.match(app, /Гипотеза проводника, не факт/);
assert.match(app, /\/api\/deep-session\/delete/);
assert.match(app, /session_id: sessionId/);
assert.match(app, /Связанный с ним текущий шаг тоже будет удалён/);
assert.match(app, /Подтверждённый итог пока не сохранён/);
assert.match(app, /Скопировать \/imagine/);
assert.match(app, /Ты управляешь памятью/);
assert.match(app, /\/api\/memory\/control/);
assert.match(app, /\/api\/memory\/export/);
assert.match(app, /delete_all/);
assert.match(app, /delete_class/);
assert.match(app, /Новые записи на паузе/);
assert.match(app, /Почему это здесь/);
assert.match(app, /Добавить важное самому/);

assert.match(app, /payments_available === true/);
assert.match(app, /Новое оформление временно закрыто/);
assert.match(app, /Не покупай Stars специально для MindCoach/);
assert.match(app, /\["30 дней", monthly === null \? "цена недоступна"/);
assert.match(app, /\["365 дней", annual === null \? "цена недоступна"/);
assert.doesNotMatch(app, /Number\(b\.monthly_xtr\) \|\| 500/);
assert.doesNotMatch(app, /Number\(b\.annual_xtr\) \|\| 5000/);
assert.match(app, /function isTelegramInvoiceUrl\(value\)/);
assert.match(app, /url\.hostname === "t\.me"/);
assert.match(app, /p\.safety_pause = Boolean\(p\.safety_pause\)/);
assert.match(app, /Позвонить 112/);
assert.match(app, /panel\.inert = !selected/);
assert.match(app, /tg\.openLink/);
assert.match(html, /name="referrer" content="no-referrer"/);
assert.match(app, /@PremiumBot/);
assert.match(app, /Пополни баланс минимум на/);
assert.match(app, /Проверь рублёвую цену/);
assert.match(app, /до 30 сообщений в день/);
assert.doesNotMatch(app, /Разговоры без дневного лимита/);
assert.match(app, /не скидка и не депозит MindCoach/);
assert.match(app, /Я не увижу, о чём ты пишешь/);
assert.doesNotMatch(app, /карта Мир|карты Мир|МИР/);
assert.match(app, /status === "failed"/);
assert.match(app, /status === "pending"/);
assert.match(app, /status === "cancelled"/);

assert.match(app, /themeChanged/);
assert.match(app, /themeParams/);
assert.match(app, /colorScheme/);
assert.match(app, /setBottomBarColor/);
assert.match(styles, /--tg-theme-bg-color/);
assert.match(styles, /--tg-content-safe-area-inset-bottom/);
assert.match(styles, /--tg-viewport-stable-height/);
assert.match(styles, /prefers-reduced-motion: reduce/);
assert.match(styles, /min-width: 320px/);
assert.match(styles, /min-height: 44px/);
assert.match(styles, /\.outcome-option[\s\S]*min-height: 48px/);
assert.match(styles, /\.outcome-options[\s\S]*gap: 8px/);
assert.match(styles, /\.memory-origin-toggle,[\s\S]*min-height: 44px/);
assert.match(styles, /@media \(max-width: 359px\)[\s\S]*\.memory-global-actions/);

assert.match(app, /Сессия завершилась/);
assert.match(app, /Обновить статус/);
assert.match(app, /function changeExperimentView\(raw\)/);
assert.match(app, /Пауза тоже часть пути/);
assert.doesNotMatch(app, /latestMemory\.summary \+ " Что изменилось/);
assert.match(app, /item\.needs_confirmation \? "reject" : "delete"/);
assert.match(app, /История разговора останется до полного сброса данных/);
assert.match(html, /id="action-status"[^>]*role="status"[^>]*aria-live="polite"/);
assert.doesNotMatch(app, /function psycheMap/);
assert.doesNotMatch(app, /root\.appendChild\(pathBlock/);
assert.doesNotMatch(app, /root\.appendChild\(upgradeNudge/);

assert.match(landing, />500 <span>Stars \/ 30 дней<\/span>/);
assert.match(landing, /Годовой доступ: 5000 Stars/);
assert.match(landing, /Пополните баланс минимум на 500 Stars/);
assert.match(offer, /30 дней — 500 Telegram Stars/);
assert.match(offer, /365 дней — 5000 Telegram Stars/);
assert.match(offer, /@PremiumBot/);
assert.doesNotMatch(landing, /Подписка за 250 Telegram/);

// Deep-link вместо копирования команды: мини-апп не может отправить сообщение
// от имени человека, поэтому открывает чат ссылкой ?start=<action>.
const commandActionSource = app.match(/function commandAction\(command, label, statusNode, action, linkLabel\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(commandActionSource, "commandAction must stay independently testable");

function runCommandAction(username) {
  const opened = [];
  const listeners = [];
  const sandbox = {
    botUsername: username,
    tg: { openTelegramLink: (url) => opened.push(url) },
    el: (tag, cls, text) => ({
      tag,
      cls,
      textContent: text,
      type: "",
      addEventListener: (event, handler) => listeners.push([event, handler]),
    }),
    copyPlainText: async () => true,
    encodeURIComponent,
    window: { open: (url) => opened.push(url) },
  };
  const fn = vm.runInNewContext("(" + commandActionSource + ")", sandbox);
  const status = { textContent: "" };
  const button = fn("/imagine", "Скопировать /imagine", status, "imagine", "Начать сессию в чате");
  return { button, status, opened, listeners };
}

const linked = runCommandAction("MindCoachBot");
assert.equal(linked.button.textContent, "Начать сессию в чате");
linked.listeners[0][1]();
assert.deepEqual(linked.opened, ["https://t.me/MindCoachBot?start=imagine"]);

const fallback = runCommandAction(null);
assert.equal(fallback.button.textContent, "Скопировать /imagine");
assert.deepEqual(fallback.opened, []);

assert.match(app, /profile\.bot_username === "string"/);
assert.match(app, /commandAction\("\/imagine", "Скопировать \/imagine", status, "imagine", "Начать сессию в чате"\)/);

console.log("Mini App redesign smoke passed");
