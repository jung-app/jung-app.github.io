(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.JUNG_TODAY = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Вопрос не угадывает тему разговора по профилю. Профиль описывает весь путь, а не
  // обязательно сегодняшний диалог. Свежесть показываем отдельно и только по timestamp.
  var QUESTIONS = [
    "Какой момент сегодняшнего дня хочется спокойно разобрать?",
    "Что сегодня сильнее всего повлияло на твоё настроение?",
    "Где сегодня пришлось поступить не так, как хотелось?",
    "Что сегодня хочется не унести с собой в завтра?",
    "Какой маленький шаг сейчас сделал бы день немного легче?",
    "Что сегодня получилось лучше, чем ты ожидал?",
    "К какому разговору или решению хочется вернуться внимательнее?",
  ];

  function sameLocalDay(left, right) {
    return left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate();
  }

  function dayIndex(now) {
    var localDay = now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate();
    return localDay % QUESTIONS.length;
  }

  function todayState(profile, nowValue) {
    var now = nowValue instanceof Date ? nowValue : new Date();
    var sync = profile && profile.live_sync && typeof profile.live_sync === "object"
      ? profile.live_sync
      : {};
    var lastTurn = typeof sync.last_turn_at === "string" ? new Date(sync.last_turn_at) : null;
    var talkedToday = Boolean(lastTurn && !isNaN(lastTurn.getTime()) && sameLocalDay(lastTurn, now));
    var syncText = "";
    if (talkedToday) {
      syncText = sync.pending_profile_update
        ? "Последний разговор сохранён. Образ обновляется."
        : "Сегодняшний разговор уже учтён в образе.";
    }
    return {
      question: QUESTIONS[dayIndex(now)],
      syncText: syncText,
    };
  }

  return { QUESTIONS: QUESTIONS.slice(), todayState: todayState };
});
