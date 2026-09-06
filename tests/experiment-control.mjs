import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
function extract(name) {
  const match = source.match(new RegExp("(?:async )?function " + name + "\\([^]*?\\n}"));
  assert.ok(match, name);
  return match[0];
}

const view = vm.runInNewContext("(" + extract("changeExperimentView") + ")", {
  objectOrEmpty: value => value || {},
  CHANGE_EXPERIMENT_STATUSES: new Set(["planned", "attempted", "adjusted", "completed", "paused"]),
  localDateKey: () => "2026-09-06",
  dateOnlyParts: value => value ? {key: value} : null,
  fmtDateOnly: value => value,
});
const base = {status: "planned", action: "Пройти до двери и обратно", measurement_key: "synthetic-key", check_in_on: "2026-09-05"};
assert.equal(view(base).state, "Время сверить результат");
assert.equal(view({...base, outcome: "Пока не удалось попробовать"}).state, "Результат отмечен");
const paused = view({...base, status: "paused"});
assert.equal(paused.feedbackDue, false);
assert.equal(paused.details.some(([label]) => label === "Сверка"), false);
assert.equal(view({...base, status: "attempted"}).state, "Опыт уже есть");

let request;
let response = {ok: true, json: async () => ({change_experiment: {...base, revision: "new-revision"}})};
const control = vm.runInNewContext("(" + extract("controlExperiment") + ")", {
  tg: {initData: "synthetic"},
  freshApiUrl: path => "http://localhost" + path,
  apiHeaders: () => ({Authorization: "tma synthetic"}),
  practiceClockMetadata: () => ({timezone: "America/New_York", utc_offset_minutes: -240}),
  fetchWithDeadline: async (url, options) => {request = {url, ...options}; return response;},
});
assert.equal((await control("pause", "revision-1", {})).revision, "new-revision");
assert.equal(request.url, "http://localhost/api/experiment/control");
assert.deepEqual(JSON.parse(request.body), {operation: "pause", revision: "revision-1", payload: {}});
assert.equal(request.cache, "no-store");
await control("edit", "revision-1", {check_in_on: "2026-09-08"});
assert.deepEqual(JSON.parse(request.body).clock, {timezone: "America/New_York", utc_offset_minutes: -240});
for (const status of [401, 404, 409, 503]) {
  response = {ok: false, status};
  await assert.rejects(control("pause", "revision-1", {}), new RegExp("http-" + status));
}
response = {ok: true, json: async () => ({recorded: true})};
await assert.rejects(control("pause", "revision-1", {}), /invalid-response/);
console.log("Experiment control contract passed");
