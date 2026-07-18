import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { QUESTIONS, todayState } = require("../today-prompt.js");

const now = new Date(2026, 6, 18, 18, 0, 0);
const todayIso = new Date(2026, 6, 18, 10, 0, 0).toISOString();
const oldUnrelatedTopic = "Непонятная старая тема, которую сегодня не обсуждали";
const profile = {
  live_sync: { last_turn_at: todayIso, pending_profile_update: false },
  sections: [{ label: oldUnrelatedTopic }],
  dynamics: { new_sections: [oldUnrelatedTopic] },
};

const synced = todayState(profile, now);
assert.ok(QUESTIONS.includes(synced.question));
assert.ok(!synced.question.includes(oldUnrelatedTopic));
assert.equal(synced.syncText, "Сегодняшний разговор уже учтён в образе.");

const pending = todayState(
  { live_sync: { last_turn_at: todayIso, pending_profile_update: true } },
  now,
);
assert.equal(pending.syncText, "Последний разговор сохранён. Образ обновляется.");

const yesterday = todayState(
  { live_sync: { last_turn_at: new Date(2026, 6, 17, 22, 0, 0).toISOString() } },
  now,
);
assert.equal(yesterday.syncText, "");
assert.equal(todayState(profile, now).question, synced.question, "Question stays stable all day");

console.log("Today prompt contract passed");
