(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp;
  var initData = tg && tg.initData ? tg.initData : "";
  var apiBase = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  var timeoutMs = 10000;
  var overviewContent = document.getElementById("overview-content");
  var userContent = document.getElementById("user-content");
  var searchError = document.getElementById("search-error");
  var currentUser = null;

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function applyTheme() {
    var dark = Boolean(tg && tg.colorScheme === "dark");
    document.documentElement.dataset.telegramTheme = dark ? "dark" : "light";
    if (tg && typeof tg.setHeaderColor === "function") tg.setHeaderColor("bg_color");
    if (tg && typeof tg.setBackgroundColor === "function") tg.setBackgroundColor("bg_color");
  }

  function announce(message) {
    var region = document.getElementById("action-status");
    if (!region) return;
    region.textContent = "";
    window.setTimeout(function () { region.textContent = message; }, 0);
  }

  function headers(withJson) {
    var value = { Authorization: "tma " + initData };
    if (withJson) value["Content-Type"] = "application/json";
    return value;
  }

  async function fetchJson(path, options) {
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, timeoutMs);
    try {
      var response = await fetch(apiBase.replace(/\/$/, "") + path, Object.assign({
        cache: "no-store",
        headers: headers(Boolean(options && options.body)),
        signal: controller.signal,
      }, options || {}));
      if (response.status === 401) throw new Error("unauthorized");
      if (response.status === 403) throw new Error("forbidden");
      if (response.status === 404) throw new Error("not-found");
      if (response.status === 409) throw new Error("recurring");
      if (!response.ok) throw new Error("http-" + response.status);
      return response.json();
    } catch (error) {
      if (error && error.name === "AbortError") throw new Error("timeout");
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function errorCopy(error, context) {
    if (error && error.message === "unauthorized") {
      return ["Сессия истекла", "Закрой Jung Control и открой заново через /admin."];
    }
    if (error && error.message === "forbidden") {
      return ["Нет доступа", "Jung Control открывается только аккаунтам из owner allow-list."];
    }
    if (error && error.message === "not-found") {
      return ["Пользователь не найден", "Пусть человек сначала откроет бота через /start."];
    }
    if (error && error.message === "recurring") {
      return [
        "Подарок не применён",
        "У пользователя активна recurring-подписка. Локальные дни разойдутся с графиком списаний Telegram.",
      ];
    }
    if (error && error.message === "timeout") {
      return ["Ответ задержался", "Проверь соединение и повтори действие."];
    }
    return ["Не удалось загрузить " + context, "Повтори попытку. Если ошибка остаётся, проверь /readyz."];
  }

  function errorCard(error, context, retry) {
    var copy = errorCopy(error, context);
    var card = element("div", "error-card");
    card.setAttribute("role", "alert");
    card.appendChild(element("h2", null, copy[0]));
    card.appendChild(element("p", null, copy[1]));
    if (retry) {
      var button = element("button", "quiet-button", "Повторить");
      button.type = "button";
      button.addEventListener("click", retry);
      card.appendChild(button);
    }
    return card;
  }

  function loadingCard(text) {
    var card = element("div", "loading-card");
    card.setAttribute("role", "status");
    card.appendChild(element("span", "spinner"));
    card.lastChild.setAttribute("aria-hidden", "true");
    card.appendChild(element("span", null, text));
    return card;
  }

  function number(value) {
    return new Intl.NumberFormat("ru-RU").format(Math.max(0, Number(value) || 0));
  }

  function dateTime(value) {
    if (!value) return "Нет данных";
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Нет данных";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }

  function statusCard(block) {
    var code = block && block.code ? block.code : "attention";
    var good = code === "ready" || code === "open" || code === "collecting_signal";
    var card = element("article", "status-card " + (good ? "is-ok" : "is-attention"));
    card.appendChild(element("h3", null, (block && block.label) || "Нет данных"));
    var detail = block && block.detail;
    card.appendChild(element("p", null, typeof detail === "string" ? detail : readinessText(detail)));
    return card;
  }

  function readinessText(detail) {
    if (!detail || typeof detail !== "object") return "Статус недоступен.";
    var broken = ["database", "outbox", "background", "llm", "billing"].filter(function (key) {
      var value = detail[key];
      return value === false || value === "backlogged" || value === "degraded" || value === "misconfigured";
    });
    return broken.length ? "Проверь: " + broken.join(", ") + "." : "База, очередь, LLM и billing отвечают штатно.";
  }

  function metricCard(label, value, suffix) {
    var card = element("article", "metric-card");
    card.appendChild(element("span", "metric-label", label));
    card.appendChild(element("strong", "metric-value", number(value) + (suffix || "")));
    return card;
  }

  function sectionCard(title, subtitle) {
    var card = element("section", "section-card");
    var heading = element("div", "section-heading");
    var copy = element("div");
    copy.appendChild(element("h2", null, title));
    if (subtitle) copy.appendChild(element("p", null, subtitle));
    heading.appendChild(copy);
    card.appendChild(heading);
    return card;
  }

  function renderFunnel(rows) {
    var card = sectionCard("Цикл до оплаты", "Конверсия считается от предыдущего этапа");
    var list = element("ol", "funnel-list");
    var max = Math.max.apply(null, (rows || []).map(function (row) { return Number(row.count) || 0; }).concat([1]));
    (rows || []).forEach(function (row) {
      var item = element("li", "funnel-row");
      item.appendChild(element("span", "funnel-label", row.label));
      item.appendChild(element("strong", "funnel-value", number(row.count)));
      var track = element("div", "funnel-track");
      track.setAttribute("aria-hidden", "true");
      var fill = element("div", "funnel-fill");
      fill.style.setProperty("--fill", Math.min(100, 100 * (Number(row.count) || 0) / max) + "%");
      track.appendChild(fill);
      item.appendChild(track);
      var conversion = row.from_previous_pct === null || row.from_previous_pct === undefined
        ? "база"
        : number(row.from_previous_pct) + "%";
      item.appendChild(element("span", "funnel-conversion", conversion));
      list.appendChild(item);
    });
    card.appendChild(list);
    return card;
  }

  function renderSources(rows) {
    var card = sectionCard("Источники", "За всё время, чтобы фильтр не терял варианты");
    var list = element("ul", "source-list");
    if (!rows || !rows.length) {
      list.appendChild(element("li", null, "Источников пока нет"));
    } else {
      rows.forEach(function (row) {
        var item = element("li");
        item.appendChild(element("span", null, row.source));
        item.appendChild(element("strong", null, number(row.starts) + " входов · " + number(row.profiles) + " профилей"));
        list.appendChild(item);
      });
    }
    card.appendChild(list);
    return card;
  }

  function outcomeCount(outcomes, event, value) {
    var byEvent = outcomes && outcomes[event];
    return byEvent && typeof byEvent === "object" ? Number(byEvent[value]) || 0 : 0;
  }

  function renderOverview(body) {
    var root = document.createDocumentFragment();
    var statuses = element("div", "status-grid");
    statuses.appendChild(statusCard(body.status && body.status.cohort));
    statuses.appendChild(statusCard(body.status && body.status.checkout));
    statuses.appendChild(statusCard(body.status && body.status.system));
    root.appendChild(statuses);

    var metrics = element("div", "metric-grid");
    metrics.appendChild(metricCard("Профили, всего", body.access && body.access.profiles));
    metrics.appendChild(metricCard("Полный доступ сейчас", body.access && body.access.active_full));
    metrics.appendChild(metricCard("Оплаты, всего", body.commerce && body.commerce.payments_count));
    metrics.appendChild(metricCard("Выручка, всего", body.commerce && body.commerce.gross_xtr, " Stars"));
    root.appendChild(metrics);

    var columns = element("div", "overview-columns");
    columns.appendChild(renderFunnel(body.funnel || []));
    var side = element("div");
    var retention = sectionCard("Возвраты", "Анонимные события в выбранном срезе");
    var retentionGrid = element("div", "metric-grid");
    retentionGrid.appendChild(metricCard("D1", body.retention && body.retention.d1));
    retentionGrid.appendChild(metricCard("D7", body.retention && body.retention.d7));
    retentionGrid.appendChild(metricCard("D30", body.retention && body.retention.d30));
    retentionGrid.appendChild(metricCard("У стены", body.access && body.access.at_wall));
    retention.appendChild(retentionGrid);
    side.appendChild(retention);

    var outcomes = sectionCard("Проверка пользы", "За всё время, только варианты ответа без темы разговора");
    var outcomeGrid = element("div", "metric-grid");
    outcomeGrid.appendChild(metricCard("Шаг сделан", outcomeCount(body.outcomes, "step_attempt", "done")));
    outcomeGrid.appendChild(metricCard("Частично", outcomeCount(body.outcomes, "step_attempt", "partly")));
    outcomeGrid.appendChild(metricCard("Стало яснее", outcomeCount(body.outcomes, "next_step_clarity", "clearer")));
    outcomeGrid.appendChild(metricCard("Полезный инсайт", outcomeCount(body.outcomes, "conversation_insight", "yes")));
    outcomes.appendChild(outcomeGrid);
    side.appendChild(outcomes);
    columns.appendChild(side);
    root.appendChild(columns);

    root.appendChild(renderSources(body.sources || []));
    var operations = sectionCard("Операции", "Исключения, которые требуют решения");
    var opList = element("ul", "detail-list");
    var outbox = (body.operations && body.operations.outbox) || {};
    var llm = (body.operations && body.operations.llm) || {};
    [
      ["Очередь: ждут / остановлены", number(outbox.pending) + " / " + number(outbox.dead)],
      ["Старейшая задача", number(outbox.oldest_pending_seconds) + " с"],
      ["Ошибки LLM", number(llm.recent_error_pct) + "%"],
      ["LLM p50 / p95", number(llm.p50_ms) + " / " + number(llm.p95_ms) + " мс"],
      ["Ошибки оплаты", number(body.commerce && body.commerce.payment_failures)],
    ].forEach(function (row) {
      var item = element("li");
      item.appendChild(element("span", "detail-label", row[0]));
      item.appendChild(element("strong", "detail-value", row[1]));
      opList.appendChild(item);
    });
    operations.appendChild(opList);
    root.appendChild(operations);
    overviewContent.replaceChildren(root);
    overviewContent.setAttribute("aria-busy", "false");
  }

  function syncSourceOptions(rows) {
    var select = document.getElementById("source-filter");
    var current = select.value;
    var options = [element("option", null, "Все источники")];
    options[0].value = "";
    (rows || []).forEach(function (row) {
      var option = element("option", null, row.source);
      option.value = row.source;
      options.push(option);
    });
    select.replaceChildren.apply(select, options);
    if (options.some(function (option) { return option.value === current; })) select.value = current;
  }

  async function loadOverview() {
    overviewContent.setAttribute("aria-busy", "true");
    overviewContent.replaceChildren(loadingCard("Собираю рабочий срез…"));
    var windowValue = document.getElementById("window-filter").value;
    var source = document.getElementById("source-filter").value;
    var query = "?window=" + encodeURIComponent(windowValue);
    if (source) query += "&source=" + encodeURIComponent(source);
    try {
      var body = await fetchJson("/api/admin/overview" + query);
      syncSourceOptions(body.sources || []);
      renderOverview(body);
      announce("Обзор обновлён");
    } catch (error) {
      overviewContent.setAttribute("aria-busy", "false");
      overviewContent.replaceChildren(errorCard(error, "обзор", loadOverview));
    }
  }

  function detailRow(label, value) {
    var item = element("li");
    item.appendChild(element("span", "detail-label", label));
    item.appendChild(element("strong", "detail-value", value));
    return item;
  }

  function planLabel(subscription) {
    if (!subscription || !subscription.plan) return "Бесплатный";
    var plans = { free: "Бесплатный", plus: "Plus", pro: "Pro" };
    var statuses = {
      active: "активен",
      canceled: "отменён",
      cancelled: "отменён",
      expired: "истёк",
      past_due: "ошибка оплаты",
    };
    var plan = plans[subscription.plan] || String(subscription.plan);
    var status = statuses[subscription.status] || String(subscription.status || "active");
    return plan + " · " + status;
  }

  function stageLabel(stage) {
    var stages = {
      portrait_ready: "Портрет готов",
      pattern_named: "Паттерн назван",
      step_chosen: "Шаг выбран",
      outcome_shared: "Исход отмечен",
      loop_completed: "Цикл завершён",
    };
    return stages[stage] || stage || "Не начат";
  }

  function grantSourceLabel(source) {
    var sources = {
      gift: "Подарок владельца",
      payment: "Оплата",
      referral: "Реферальный бонус",
      trial: "Пробный доступ",
    };
    return sources[source] || source || "Другой источник";
  }

  function daysLabel(value) {
    var amount = Math.max(0, Number(value) || 0);
    var mod100 = amount % 100;
    var mod10 = amount % 10;
    var word = mod100 >= 11 && mod100 <= 14 ? "дней" : mod10 === 1 ? "день" : mod10 >= 2 && mod10 <= 4 ? "дня" : "дней";
    return number(amount) + " " + word;
  }

  function newRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return "admin_" + window.crypto.randomUUID();
    }
    return ("admin_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2) + "0000000000").slice(0, 80);
  }

  function confirmAction(message) {
    return new Promise(function (resolve) {
      if (tg && typeof tg.showConfirm === "function") {
        tg.showConfirm(message, function (accepted) { resolve(Boolean(accepted)); });
      } else {
        resolve(window.confirm(message));
      }
    });
  }

  function renderGrantForm(card, user) {
    var subscription = user.subscription || {};
    var paidRecurring = Boolean(subscription.auto_renew && subscription.plan !== "free");
    if (paidRecurring) {
      var note = element("div", "error-card");
      note.appendChild(element("h3", null, "Подарочные дни заблокированы"));
      note.appendChild(element("p", null, "У пользователя включено автопродление. Сначала разберись с recurring-подпиской, чтобы срок доступа не разошёлся со списаниями Telegram."));
      card.appendChild(note);
      return;
    }
    var details = element("details", "grant-panel");
    details.appendChild(element("summary", null, "Выдать подарочный доступ"));
    var form = element("form", "grant-form");
    form.noValidate = true;

    var daysLabel = element("label");
    daysLabel.appendChild(element("span", null, "Срок"));
    var days = element("select");
    days.name = "days";
    [1, 7, 14, 30, 90, 365].forEach(function (value) {
      var option = element("option", null, daysLabel(value));
      option.value = String(value);
      if (value === 7) option.selected = true;
      days.appendChild(option);
    });
    daysLabel.appendChild(days);
    form.appendChild(daysLabel);

    var reasonLabel = element("label");
    reasonLabel.appendChild(element("span", null, "Причина, 3–200 символов"));
    var reason = element("textarea");
    reason.name = "reason";
    reason.maxLength = 200;
    reason.required = true;
    reason.placeholder = "Например: участник диагностической когорты";
    reasonLabel.appendChild(reason);
    form.appendChild(reasonLabel);
    var formError = element("p", "field-error");
    formError.setAttribute("role", "alert");
    formError.hidden = true;
    form.appendChild(formError);
    var submit = element("button", "primary-button", "Проверить и выдать");
    submit.type = "submit";
    form.appendChild(submit);
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var cleanReason = reason.value.trim();
      if (cleanReason.length < 3) {
        formError.textContent = "Укажи конкретную причину выдачи доступа.";
        formError.hidden = false;
        reason.focus();
        return;
      }
      formError.hidden = true;
      var grantDays = Number(days.value);
      var accepted = await confirmAction("Выдать пользователю " + user.telegram_id + " доступ на " + grantDays + " дней? Причина: " + cleanReason);
      if (!accepted) return;
      submit.disabled = true;
      submit.textContent = "Выдаю…";
      try {
        var result = await fetchJson("/api/admin/grant", {
          method: "POST",
          body: JSON.stringify({
            telegram_id: user.telegram_id,
            days: grantDays,
            reason: cleanReason,
            request_id: newRequestId(),
          }),
        });
        currentUser = result.user;
        renderUser(result.user);
        announce(result.applied ? "Доступ выдан" : "Эта выдача уже была применена");
      } catch (error) {
        var copy = errorCopy(error, "доступ");
        formError.textContent = copy[0] + ". " + copy[1];
        formError.hidden = false;
        submit.disabled = false;
        submit.textContent = "Проверить и выдать";
      }
    });
    details.appendChild(form);
    card.appendChild(details);
  }

  function renderUser(user) {
    currentUser = user;
    var card = element("article", "user-card");
    var title = element("div", "user-title");
    title.appendChild(element("h2", null, "ID " + user.telegram_id));
    title.appendChild(element("span", "status-chip", user.is_onboarded ? "Онбординг завершён" : "Онбординг не завершён"));
    card.appendChild(title);

    var subscription = user.subscription || {};
    var details = element("ul", "detail-list");
    details.appendChild(detailRow("Последняя активность", dateTime(user.last_active_at)));
    details.appendChild(detailRow("Доступ", planLabel(subscription)));
    details.appendChild(detailRow("Этап", stageLabel(subscription.activation_stage)));
    details.appendChild(detailRow("Доступ до", dateTime(subscription.current_period_end)));
    details.appendChild(detailRow("Автопродление", subscription.auto_renew ? "Включено" : "Выключено"));
    details.appendChild(detailRow("Оплаты", number(user.payments_count) + " · " + number(user.revenue_xtr) + " Stars"));
    details.appendChild(detailRow("Приглашено / оплатили", number(user.referrals && user.referrals.invited) + " / " + number(user.referrals && user.referrals.rewarded)));
    card.appendChild(details);

    var grants = user.access_grants || [];
    if (grants.length) {
      var grantsTitle = element("h3", null, "Последние источники доступа");
      grantsTitle.style.marginTop = "16px";
      card.appendChild(grantsTitle);
      var grantList = element("ul", "grant-list");
      grants.forEach(function (grant) {
        var item = element("li");
        item.appendChild(element("strong", null, grantSourceLabel(grant.source) + " · " + daysLabel(grant.days)));
        item.appendChild(element("span", null, (grant.reason || "Без причины") + " · " + dateTime(grant.created_at)));
        grantList.appendChild(item);
      });
      card.appendChild(grantList);
    }
    renderGrantForm(card, user);
    userContent.replaceChildren(card);
  }

  async function loadUser(telegramId) {
    userContent.replaceChildren(loadingCard("Проверяю доступ и платежи…"));
    try {
      var body = await fetchJson("/api/admin/user?telegram_id=" + encodeURIComponent(telegramId));
      renderUser(body.user);
      announce("Пользователь найден");
    } catch (error) {
      userContent.replaceChildren(errorCard(error, "пользователя", function () { loadUser(telegramId); }));
    }
  }

  function selectTab(name, focus) {
    document.querySelectorAll("[role=tab]").forEach(function (tab) {
      var active = tab.dataset.tab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    document.getElementById("overview-panel").hidden = name !== "overview";
    document.getElementById("user-panel").hidden = name !== "user";
    if (tg && tg.BackButton) {
      if (name === "user") tg.BackButton.show();
      else tg.BackButton.hide();
    }
  }

  document.querySelectorAll("[role=tab]").forEach(function (tab) {
    tab.addEventListener("click", function () { selectTab(tab.dataset.tab, false); });
    tab.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      selectTab(tab.dataset.tab === "overview" ? "user" : "overview", true);
    });
  });

  document.getElementById("user-search").addEventListener("submit", function (event) {
    event.preventDefault();
    var value = document.getElementById("telegram-id").value.trim();
    if (!/^[0-9]{1,20}$/.test(value)) {
      searchError.textContent = "Введи Telegram ID только цифрами.";
      searchError.hidden = false;
      return;
    }
    searchError.hidden = true;
    loadUser(value);
  });

  document.getElementById("window-filter").addEventListener("change", loadOverview);
  document.getElementById("source-filter").addEventListener("change", loadOverview);
  document.getElementById("refresh").addEventListener("click", function () {
    if (document.getElementById("overview-panel").hidden) {
      if (currentUser) loadUser(currentUser.telegram_id);
    } else {
      loadOverview();
    }
  });

  if (tg) {
    applyTheme();
    tg.ready();
    tg.expand();
    tg.onEvent("themeChanged", applyTheme);
    if (tg.BackButton) {
      tg.BackButton.onClick(function () { selectTab("overview", true); });
      tg.BackButton.hide();
    }
  }

  if (!initData || !apiBase) {
    overviewContent.setAttribute("aria-busy", "false");
    overviewContent.replaceChildren(errorCard(new Error("unauthorized"), "Jung Control"));
  } else {
    loadOverview();
  }
})();
