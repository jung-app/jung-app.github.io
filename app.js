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

// Уверенность как фаза луны: гипотеза «проявляется из тени на свет» — буквальный
// язык индивидуации (и 🌑-бренда). Сдвиг тени в svg-луне + человеческая подпись.
const CONFIDENCE_MOON = {
  low: { shift: 3.5, cap: "едва проявлено" },
  medium: { shift: 9, cap: "проявляется" },
  high: { shift: 15, cap: "ясно видно" },
};

// «Что это» — короткая человеческая расшифровка каждой грани по Юнгу. Обучающий
// слой мини-аппа: человек понимает СВОИ грани, а не просто читает ярлыки.
// Эпистемическая рамка: понятия — ориентиры, не диагнозы. Глиф — из алхимико-
// астрономического словаря самого Юнга (◎ — его символ Самости).
const FACET_GUIDE = {
  life_context: {
    glyph: "✦",
    guide:
      "Где ты сейчас: обстоятельства, роли, переходы. Фон, на котором читается всё остальное.",
  },
  patterns: {
    glyph: "∞",
    guide:
      "Повторяющиеся сценарии в реакциях и выборах. Увидеть узор — уже половина свободы от него.",
  },
  fears: {
    glyph: "▲",
    guide:
      "Страхи — не слабость, а указатели: за ними спрятано то, что для тебя по-настоящему важно.",
  },
  childhood_wounds: {
    glyph: "✶",
    guide:
      "Ранний опыт, который до сих пор задаёт тон. Не чтобы винить прошлое — чтобы вернуть себе выбор.",
  },
  persona: {
    glyph: "◐",
    guide:
      "Лицо, которое ты показываешь миру: роли, манеры, «как надо». Полезна — пока не путаешь её с собой.",
  },
  shadow: {
    glyph: "●",
    guide:
      "Стороны тебя, которые ты предпочитаешь не замечать. По Юнгу встреча с Тенью — первый шаг к целостности: в ней заперта и сила.",
  },
  anima_animus: {
    glyph: "☽",
    guide:
      "Внутренний образ другого пола — как в тебе живёт женское и мужское. Незаметно влияет на то, кого и как ты любишь.",
  },
  self: {
    glyph: "◎",
    guide:
      "Центр и целое психики, к которому ведёт индивидуация. Не «идеальный я» — весь я, включая тень.",
  },
  mother_complex: {
    glyph: "⊕",
    guide:
      "След отношений с матерью и материнским: как он окрашивает близость, заботу, зависимость.",
  },
  father_complex: {
    glyph: "⊙",
    guide:
      "След отношений с отцом и отцовским: авторитет, правила, признание — и твой спор с ними.",
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
  "Архетип — древний общечеловеческий образ, который сейчас отчётливо звучит в твоей жизни.";

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

// Бесплатный ngrok показывает browser interstitial для запросов из Telegram WebView.
// Служебный заголовок отключает HTML-заглушку и пропускает запрос к нашему API.
// На будущих VPS/same-origin он безвреден и может быть удалён вместе с API_BASE.
function apiHeaders(initData, withJson) {
  const headers = {
    Authorization: "tma " + initData,
    "ngrok-skip-browser-warning": "true",
  };
  if (withJson) headers["Content-Type"] = "application/json";
  return headers;
}

function freshApiUrl(path) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const sep = path.includes("?") ? "&" : "?";
  return base.replace(/\/$/, "") + path + sep + "ts=" + Date.now();
}

async function fetchProfile() {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");

  const res = await fetch(freshApiUrl("/api/profile"), {
    headers: apiHeaders(initData, false),
    cache: "no-store",
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
    headers: apiHeaders(initData, true),
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
      <circle cx="10" cy="10" r="8.5" fill="#e8c074" />
      <circle cx="${(10 - shift).toFixed(1)}" cy="10" r="8.5" fill="#161e30" clip-path="url(#${clipId})" />
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="rgba(232,192,116,0.4)" stroke-width="1" />
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
      setView(updated ? renderProfile(updated) : renderEmpty());
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
  sec.appendChild(el("div", "dynamics-label", "С прошлого визита"));

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
  const daysWord = pluralRu(days, "день", "дня", "дней");
  const sec = el("section", "referral");
  sec.appendChild(el("div", "referral-label", "Расти вместе"));
  // Оффер в заголовке — ценность цифрами перед глазами, а не абстрактно «бонусные дни».
  sec.appendChild(el("h2", "referral-title serif", "Позови близкого — тебе +" + days + " " + daysWord));

  // Прогресс показываем, только когда уже кто-то приглашён: ценность уже осязаема.
  if (r.invited) {
    const stats = el("div", "referral-stats");
    stats.appendChild(stat(r.invited, "приглашено"));
    stats.appendChild(stat(r.rewarded || 0, "остались с подпиской"));
    stats.appendChild(stat("+" + (r.earned_days || 0), "дней тебе"));
    sec.appendChild(stats);
  }

  sec.appendChild(
    el(
      "p",
      "referral-text",
      r.rewarded
        ? "Спасибо, что делишься путём. Когда останется ещё один близкий — тебе снова +" + days + " " + daysWord + "."
        : "Когда близкий останется с подпиской — тебе +" + days + " " + daysWord + " доступа. Ему — расширенное знакомство с проводником.",
    ),
  );

  const btn = el("button", "share-btn", "Позвать близкого");
  btn.type = "button";
  btn.addEventListener("click", () => {
    const text =
      "Я иду путём самопознания с этим проводником — юнгианская работа над собой прямо в Telegram. Попробуй и ты 🌑";
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
  const res = await fetch(base.replace(/\/$/, "") + "/api/invoice", {
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
function startUpgrade(btn, period) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Открываю оплату…";
  const restore = () => {
    btn.disabled = false;
    btn.textContent = original;
  };
  requestInvoice(period)
    .then((url) => {
      if (tg && typeof tg.openInvoice === "function") {
        tg.openInvoice(url, (status) => {
          if (status === "paid") pollForActivation();
        });
      } else if (tg && typeof tg.openTelegramLink === "function") {
        tg.openTelegramLink(url);
      } else {
        window.open(url, "_blank");
      }
      restore();
    })
    .catch(() => {
      restore();
      if (tg && typeof tg.showAlert === "function")
        tg.showAlert("Не получилось открыть оплату. Попробуй ещё раз или набери /upgrade в чате.");
    });
}

// После успешного Stars invoice слегка поллим профиль: successful_payment может прийти
// в long-polling на секунду позже callback Mini App.
function pollForActivation() {
  let attempts = 0;
  const tick = async () => {
    attempts += 1;
    try {
      const initData = tg && tg.initData ? tg.initData : "";
      const res = await fetch(freshApiUrl("/api/profile"), {
        headers: apiHeaders(initData, false),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.profile && data.profile.is_paid) {
          if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === "function")
            tg.HapticFeedback.notificationOccurred("success");
          setView(
            stateView(
              "Подписка активна",
              "Спасибо 🌑 Теперь я помню твой путь между сессиями. Возвращайся в чат — продолжим оттуда, где остановились.",
              "✦",
            ),
          );
          return; // готово — поллинг прекращаем
        }
      }
    } catch (e) {
      /* сеть моргнула — попробуем на следующем тике */
    }
    if (attempts < 18) setTimeout(tick, 10000); // ~3 минуты ждём завершения оплаты
  };
  setTimeout(tick, 8000); // первая проверка — после возможной быстрой оплаты
}

// Панель подписки (только для free): после показа реального образа продаём переход
// от понимания к действию, а память делает этот путь непрерывным. Существующие грани не прячем (это данные юзера,
// 152-ФЗ «ты хозяин данных») — показываем, что открывает подписка, и кнопку оплаты.
function upgradeSection(billing) {
  const sec = el("section", "upgrade");
  sec.appendChild(el("div", "upgrade-label", "Дальше — вместе"));
  sec.appendChild(el("h2", "upgrade-title serif", "Не только понять. Начать действовать иначе"));
  sec.appendChild(
    el(
      "p",
      "upgrade-text",
      "С подпиской я замечаю повторяющиеся сценарии, помню твои шаги и то, что уже " +
        "сработало. Каждый разговор продолжает путь и помогает корректировать его в жизни.",
    ),
  );
  const perks = el("ul", "upgrade-perks");
  // Канон ценности — зеркало subscription_comparison() в app/handlers/payments.py.
  // Держи в синхроне с ботом и лендингом.
  [
    "Повторяющиеся сценарии превращаются в конкретные шаги",
    "Память между сессиями — помню, что уже сработало",
    "Свободные разговоры с проводником — каждый день",
    "Растущая карта твоих тем, опор и изменений",
    "Привычки 🌿 — триггер, потребность, замена и новый минимальный шаг",
    "Глубинная сессия 🌀 — встреча с внутренней фигурой",
    "Дневник снов 🌙 — одна из практик для работы с образами",
    "Можно надиктовать голосовое — я пойму и отвечу текстом",
    "Я сам бережно пишу первым между сессиями",
  ].forEach((t) => {
    const li = el("li", "upgrade-perk");
    li.appendChild(el("span", "perk-mark", "🔓"));
    li.appendChild(el("span", "perk-text", t));
    perks.appendChild(li);
  });
  sec.appendChild(perks);
  // Месяц — recurring Stars. Год показываем только если включён разовый Stars-инвойс.
  const b = billing || {};
  const monthly = b.monthly_xtr || 0;
  const btn = el(
    "button",
    "upgrade-btn",
    monthly ? monthly + " ⭐ в месяц" : "Продолжить с памятью",
  );
  btn.type = "button";
  btn.addEventListener("click", () => startUpgrade(btn, "monthly"));
  sec.appendChild(btn);
  if (b.annual_available && b.annual_xtr) {
    const paidMonths = monthly ? b.annual_xtr / monthly : 0;
    const derivedBonus = Number.isInteger(paidMonths) ? Math.max(0, 12 - paidMonths) : 0;
    const bonusMonths = Number(b.annual_bonus_months || derivedBonus);
    const bonusLabel = bonusMonths > 0
      ? " (" + bonusMonths + " " + pluralRu(bonusMonths, "месяц", "месяца", "месяцев") + " в подарок)"
      : "";
    const ybtn = el(
      "button",
      "upgrade-btn upgrade-btn-annual",
      "Год — " + b.annual_xtr + " ⭐" + bonusLabel,
    );
    ybtn.type = "button";
    ybtn.addEventListener("click", () => startUpgrade(ybtn, "annual"));
    sec.appendChild(ybtn);
  }
  const guide = el("div", "stars-guide");
  guide.appendChild(el("strong", "stars-guide-title", "Нет Stars?"));
  guide.appendChild(
    el(
      "p",
      "stars-guide-text",
      "Открой @PremiumBot → /start → «Звёзды Telegram». Выбери 500 ⭐ для месяца или 5000 ⭐ для года, затем вернись и нажми тариф.",
    ),
  );
  const premiumBtn = el("button", "premiumbot-btn", "Купить Stars в @PremiumBot");
  premiumBtn.type = "button";
  premiumBtn.addEventListener("click", () => {
    const url = "https://t.me/PremiumBot";
    if (tg && typeof tg.openTelegramLink === "function") tg.openTelegramLink(url);
    else window.open(url, "_blank");
  });
  guide.appendChild(premiumBtn);
  sec.appendChild(guide);
  sec.appendChild(
    el(
      "p",
      "upgrade-hint",
      "Месяц продлевается каждые 30 дней. Год оплачивается один раз на 365 дней.",
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

// Тёплые вопросы дня (юнгианская оптика: роли/персона, тень, образы и сны, «на своём
// месте» = индивидуация). Не анкета и не трекер — одно приглашение заметить. Ротация
// по календарному дню → стабилен в течение суток, свой у каждого дня.
const TODAY_QUESTIONS = [
  "Что сегодня забрало больше всего сил?",
  "Где сегодня ты был не совсем собой?",
  "Какой образ, сон или мысль остались с тобой?",
  "Чему сегодня хотелось сказать «нет», но ты не сказал?",
  "Что сегодня неожиданно тронуло?",
  "Какая роль сегодня давалась тебе тяжелее всего?",
  "О чём ты сегодня старался не думать?",
  "Что сегодня дало ощущение, что ты на своём месте?",
  "Какое чувство сегодня возвращалось чаще других?",
  "Если бы у сегодняшнего дня было имя — какое?",
];

function firstText(items) {
  return (items || []).find((x) => typeof x === "string" && x.trim());
}

function latestProfileCue(p) {
  const d = p && p.dynamics;
  const changed =
    firstText(d && d.new_habits) ||
    firstText(d && d.new_sections) ||
    firstText(d && d.new_archetypes);
  if (changed) return changed;

  const habit = (p.habits || []).find((h) => h && (h.serves || h.summary || h.name));
  if (habit) return habit.serves || habit.summary || habit.name;
  const archetype = (p.archetypes || []).find((a) => a && (a.name || a.summary));
  if (archetype) return archetype.name || archetype.summary;
  const section = (p.sections || []).find((s) => s && (s.label || s.summary));
  if (section) return section.label || section.summary;
  return "";
}

function todayPrompt(p) {
  const sync = (p && p.live_sync) || {};
  const lastAt = sync.last_turn_at ? new Date(sync.last_turn_at) : null;
  const today = new Date();
  const isToday =
    lastAt &&
    !isNaN(lastAt) &&
    lastAt.getFullYear() === today.getFullYear() &&
    lastAt.getMonth() === today.getMonth() &&
    lastAt.getDate() === today.getDate();
  const cue = isToday ? sync.last_user_preview || latestProfileCue(p) : "";
  if (cue && sync.pending_profile_update) {
    return "Я уже вижу последний разговор: «" + cue + "». Образ обновляется, что важно не потерять?";
  }
  if (cue) return "Что из сегодняшней темы «" + cue + "» хочется продолжить?";
  const idx = Math.floor(Date.now() / 86400000) % TODAY_QUESTIONS.length;
  return TODAY_QUESTIONS[idx];
}

// Блок «Сегодня»: персональный вопрос + возврат в чат. Он зависит от свежего payload
// профиля, поэтому после разговора с ботом верх мини-аппа меняется вместе с образом.
function todayBlock(p) {
  const sec = el("section", "today");
  sec.appendChild(el("div", "today-label", "Сегодня"));
  sec.appendChild(el("p", "today-q", todayPrompt(p)));
  const btn = el("button", "today-cta", "Продолжить в чате");
  btn.type = "button";
  // Закрываем мини-апп → возврат в чат с ботом, где можно ответить прямо сейчас.
  btn.addEventListener("click", () => {
    if (tg && typeof tg.close === "function") tg.close();
  });
  sec.appendChild(btn);
  return sec;
}

// --- карта психики ----------------------------------------------------------

// Символы трёх великих фигур + Самости. Ключи совпадают со схемой профиля.
const FIGURE_GLYPH = { self: "✦", persona: "◐", shadow: "●", anima_animus: "☽" };
// Короткие подписи фигур на карте (полное имя — в раскрытии по тапу; длинное налезало бы).
const FIGURE_SHORT = { self: "Самость", persona: "Персона", shadow: "Тень", anima_animus: "Анима" };
const GREAT_KEYS = ["persona", "shadow", "anima_animus"]; // великие фигуры (подписываем)
const CX = 150;
const CY = 146; // центр мандалы (Самость)
// Три кольца глубины: ближе к центру — то, что уже узнано и принято; на краю — что едва
// проявляется. Мандала — центральный символ Самости у Юнга: небо, собранное вокруг центра.
const R_BAND = [52, 82, 110]; // узнано / в работе / едва проявляется

// Декоративные фоновые звёзды (статичные) — ночное небо за фигурами.
const AMBIENT_STARS = [
  [28, 44, 0.9], [95, 26, 0.6], [214, 34, 0.7], [286, 70, 0.9], [22, 116, 0.6],
  [120, 22, 0.5], [190, 20, 0.6], [284, 168, 0.7], [30, 214, 0.8], [104, 262, 0.6],
  [214, 258, 0.7], [272, 224, 0.5], [14, 88, 0.4], [294, 130, 0.5], [150, 272, 0.5],
  [60, 250, 0.5], [244, 46, 0.5], [10, 168, 0.5], [292, 200, 0.6], [176, 274, 0.4],
];

// Глубина грани → кольцо. 0 узнано (подтверждено/high), 1 в работе (medium/working),
// 2 едва проявляется (всё прочее). Радиус кодирует близость к центру-Самости.
function depthBand(item) {
  if (!item) return 2;
  if (item.user_confirmed || item.confidence === "high") return 0;
  if (item.confidence === "medium" || item.status === "working") return 1;
  return 2;
}
const BAND_TONE = ["clear", "working", "emerging"];
// Размер звезды = как глубоко грань узнана (число опор evidence). Крупнее = увереннее.
function starR(ev) {
  const n = Math.max(0, Math.min(6, ev || 0));
  return 3.2 + n * 0.85; // 3.2 .. 8.3
}
function polar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
// Ярлыки граней и имена архетипов приходят из extraction (LLM) — в SVG-разметку только
// через экранирование, чтобы случайные <, & или кавычки не ломали (и не инжектили) DOM.
function escXml(s) {
  return String(s == null ? "" : s).replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;");
}

// Карта психики как живой граф (референс — graph view Obsidian, 08.07): Самость в центре,
// грани/комплексы/архетипы — звёзды на пружинах. Физика: звёзды отталкиваются, нити мотива
// стягивают своих, радиальная гравитация держит кольца глубины (семантика мандалы жива:
// ближе к центру = узнано и принято). Звёзды можно таскать, карту — панорамировать и
// зумить (щипок/колесо, двойной тап — сброс). Тап по звезде подсвечивает её созвездие
// и гасит остальное; подписи проявляются при зуме. Рисуем, когда есть хоть одна грань.
function psycheMap(sections, archetypes) {
  if (!sections.length && !(archetypes && archetypes.length)) return null;
  const byKey = {};
  sections.forEach((s) => {
    if (s.key) byKey[s.key] = s;
  });

  // собираем все грани в единый список звёзд (кроме Самости — она центр)
  const items = [];
  sections.forEach((s) => {
    if (s.key === "self") return;
    const great = GREAT_KEYS.indexOf(s.key) !== -1;
    items.push({
      label: s.label,
      mapLabel: great ? FIGURE_SHORT[s.key] : null,
      glyph: great ? FIGURE_GLYPH[s.key] : null,
      summary: s.summary,
      band: depthBand(s),
      r: great ? 7.5 : starR(s.evidence_count),
      theme: s.theme,
      anchor: great,
      key: s.label,
    });
  });
  (archetypes || []).forEach((a) => {
    items.push({
      label: a.name, mapLabel: null, glyph: null, summary: a.summary,
      band: depthBand(a), r: starR(a.evidence_count), theme: a.theme, arch: true, key: a.name,
    });
  });

  // Самость — центр (или призрачный центр, если ещё не проявилась)
  const selfSec = byKey.self;
  const stars = [{
    glyph: "✦", label: "Самость", mapLabel: "Самость",
    summary: selfSec
      ? selfSec.summary
      : "Центр, к которому ведёт путь. По Юнгу он проявляется последним и всю жизнь.",
    tone: selfSec ? (depthBand(selfSec) === 0 ? "clear" : "working") : "ghost",
    r: 10, x: CX, y: CY, anchor: true, self: true, theme: selfSec ? selfSec.theme : null,
  }];

  // Плотностный масштаб: поле карты фиксированное (300×300), поэтому с ростом числа
  // граней сами звёзды компактнеют (с полом — не исчезают). Небо становится населённее,
  // а не тесней. Якоря (великие фигуры) держат минимум под глифом.
  const crowd = Math.max(0.62, Math.min(1, Math.sqrt(18 / Math.max(1, items.length))));
  items.forEach((it) => {
    it.r = Math.max(it.anchor ? 6.5 : 2.6, it.r * crowd);
  });

  // раскладываем по кольцам: в каждом кольце звёзды равномерно по кругу, кольца смещены
  // друг относительно друга, чтобы не выстраивались в радиусы. Больше опор → чуть ближе
  // к центру внутри кольца (глубже узнана = ближе к себе).
  const bands = [[], [], []];
  items.forEach((it) => bands[it.band].push(it));
  bands.forEach((grp, b) => {
    // стабильный порядок, чтобы раскладка не прыгала между визитами
    grp.sort((a, z) => hashStr(a.key) - hashStr(z.key));
    const n = grp.length;
    if (!n) return;
    // Ёмкость кольца конечна (окружность / диаметр звезды с зазором). Переполненное
    // кольцо расщепляется на подкольца (до трёх), звёзды идут зигзагом-ожерельем:
    // плотность растёт в разы, а три глубины мандалы по-прежнему читаются.
    const maxD = 2 * Math.max(...grp.map((it) => it.r)) + 6;
    const rows = Math.min(3, Math.max(1, Math.ceil((n * maxD) / (2 * Math.PI * R_BAND[b]))));
    const rowGap = b === 0 ? 10 : 12; // внутреннее кольцо не лезет в ореол Самости
    grp.forEach((it, i) => {
      const spread = n > 1 ? (360 / n) * i : 0;
      // в ожерелье без углового дрожания — зигзаг сам разбивает «радиусы»
      const jitter = rows > 1 ? 0 : (hashStr(it.key) % 11) - 5;
      const deg = -90 + b * 29 + spread + jitter;
      const rowOff = rows > 1 ? ((i % rows) - (rows - 1) / 2) * rowGap : 0;
      const pull =
        rows > 1 ? 0 : Math.min(6, Math.max(0, it.r - 3.2) / 0.85) * 1.4; // до -8.4 внутрь
      const [x, y] = polar(CX, CY, R_BAND[b] + rowOff - pull, deg);
      stars.push({ ...it, tone: BAND_TONE[b], x, y });
    });
  });

  // Страховка от каши: детерминированный пасс растаскивает пересёкшиеся звёзды
  // (вход и порядок стабильны → раскладка та же между визитами). Самость неподвижна.
  for (let pass = 0; pass < 24; pass++) {
    let moved = false;
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i];
        const z = stars[j];
        const min = a.r + z.r + 4;
        let dx = z.x - a.x;
        let dy = z.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) {
          dx = 1; dy = 0; d = 1; // совпали точь-в-точь — толкаем в фиксированную сторону
        }
        const push = (min - d) / 2 + 0.3;
        const ux = dx / d;
        const uy = dy / d;
        if (!a.self) {
          a.x -= ux * push;
          a.y -= uy * push;
        }
        z.x += ux * push * (a.self ? 2 : 1);
        z.y += uy * push * (a.self ? 2 : 1);
        moved = true;
      }
    }
    if (!moved) break;
  }
  stars.forEach((st) => {
    if (st.self) return;
    st.x = Math.max(10, Math.min(290, st.x));
    st.y = Math.max(10, Math.min(290, st.y));
  });

  // Нити мотива: цепочка по углу (N-1 линий, не полный граф) — они же пружины физики.
  // Индексная адресация: физика и DOM-линии живут на одних индексах массива stars.
  const byTheme = {};
  stars.forEach((st, i) => {
    if (st.theme) (byTheme[st.theme] = byTheme[st.theme] || []).push(i);
  });
  const themeLinks = []; // {a, b, th} — индексы звёзд
  Object.keys(byTheme).forEach((th) => {
    const g = byTheme[th]
      .slice()
      .sort((a, z) =>
        Math.atan2(stars[a].y - CY, stars[a].x - CX) - Math.atan2(stars[z].y - CY, stars[z].x - CX));
    for (let i = 0; i + 1 < g.length; i++) themeLinks.push({ a: g[i], b: g[i + 1], th });
  });
  // Оси мандалы: Самость ↔ великие фигуры, едва заметные — каркас, как хаб в графе Obsidian.
  const axisLinks = [];
  stars.forEach((st, i) => {
    if (st.anchor && !st.self) axisLinks.push({ a: 0, b: i });
  });

  // --- разметка: звезда = <g translate> (физика двигает одну трансформацию на звезду) ---
  const relGlint = (len) =>
    `<line x1="${(-len).toFixed(1)}" y1="0" x2="${len.toFixed(1)}" y2="0" stroke="#e8c074" stroke-width="0.9" opacity="0.5" stroke-linecap="round"/>` +
    `<line x1="0" y1="${(-len).toFixed(1)}" x2="0" y2="${len.toFixed(1)}" stroke="#e8c074" stroke-width="0.9" opacity="0.5" stroke-linecap="round"/>`;

  const starMarkup = (st, i) => {
    const parts = [];
    const r = st.r;
    const tw = ` class="twinkle" style="animation-delay:${(i % 6) * 0.6}s"`;
    if (st.self) {
      // Самость — центр: гало + кольцо + ядро. Прикована к центру — якорь всего графа.
      const on = st.tone === "clear";
      parts.push(`<circle r="${(r + 12).toFixed(1)}" fill="#e8c074" opacity="0.14"/>`);
      parts.push(relGlint(r + 9));
      parts.push(`<circle r="${(r + 4).toFixed(1)}" fill="none" stroke="#e8c074" stroke-width="0.9" opacity="${on ? 0.6 : 0.4}"/>`);
      if (st.tone === "ghost") {
        parts.push(`<circle r="${r.toFixed(1)}" fill="#131a2b" stroke="#e8c074" stroke-width="1" stroke-dasharray="2 3" opacity="0.85"/>`);
        parts.push(`<text class="star-glyph star-glyph--off">${st.glyph}</text>`);
      } else {
        parts.push(`<circle r="${r.toFixed(1)}" fill="#e8c074"/>`);
        parts.push(`<text class="star-glyph star-glyph--on">${st.glyph}</text>`);
      }
    } else if (st.tone === "clear") {
      parts.push(`<circle r="${(r + 7).toFixed(1)}" fill="#e8c074" opacity="0.16"/>`);
      parts.push(relGlint(r + 5));
      parts.push(`<circle r="${r.toFixed(1)}" fill="#e8c074"/>`);
      if (st.glyph) parts.push(`<text class="star-glyph star-glyph--on">${st.glyph}</text>`);
    } else if (st.tone === "ghost") {
      parts.push(`<circle r="${r.toFixed(1)}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="2 3"/>`);
      if (st.glyph) parts.push(`<text class="star-glyph star-glyph--off">${st.glyph}</text>`);
    } else if (st.tone === "working") {
      parts.push(`<circle r="${(r + 3).toFixed(1)}" fill="#e8c074" opacity="0.10"/>`);
      parts.push(`<circle r="${r.toFixed(1)}" fill="rgba(232,192,116,0.5)" stroke="#e8c074" stroke-width="1"/>`);
      if (st.glyph) parts.push(`<text class="star-glyph star-glyph--mid">${st.glyph}</text>`);
    } else {
      parts.push(`<circle r="${r.toFixed(1)}"${tw} fill="rgba(232,192,116,0.34)"${st.arch ? ' stroke="#e8c074" stroke-width="0.7"' : ""}/>`);
      if (st.glyph) parts.push(`<text class="star-glyph star-glyph--off">${st.glyph}</text>`);
    }
    // Подпись под звездой: якоря видны всегда, остальные проявляются при зуме или подсветке
    // (как в Obsidian). Тёмный ореол (paint-order в CSS) — читаемость поверх линий.
    const toneCls = st.tone === "ghost" ? "ghost" : st.tone === "clear" ? "clear" : "emerging";
    const labelCls = st.anchor
      ? `star-label star-label--anchor star-label--${toneCls}`
      : "star-label";
    parts.push(
      `<text y="${(r + (st.self ? 16 : 10)).toFixed(1)}" class="${labelCls}">${escXml(st.mapLabel || st.label)}</text>`,
    );
    return `<g class="star" data-i="${i}" transform="translate(${st.x.toFixed(1)},${st.y.toFixed(1)})">${parts.join("")}</g>`;
  };

  const linkMarkup = (lk) => {
    const a = stars[lk.a];
    const b = stars[lk.b];
    const c = `x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"`;
    const d = `data-a="${lk.a}" data-b="${lk.b}" data-th="${escXml(lk.th || "")}"`;
    if (!lk.th) {
      return `<line ${c} ${d} class="axis-line" stroke="#e8c074" stroke-width="0.7" opacity="0.10"/>`;
    }
    return (
      `<line ${c} ${d} class="thread-glow" stroke="#e8c074" stroke-width="5" opacity="0.09" stroke-linecap="round"/>` +
      `<line ${c} ${d} class="thread-line" stroke="#e8c074" stroke-width="1.1" opacity="0.65" stroke-linecap="round"/>`
    );
  };

  const svg = [];
  svg.push(
    '<defs><radialGradient id="selfGlow" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="#e8c074" stop-opacity="0.22"/>' +
      '<stop offset="100%" stop-color="#e8c074" stop-opacity="0"/></radialGradient></defs>',
  );
  // фоновые звёзды — неподвижное дальнее небо ВНЕ камеры (лёгкий параллакс при панораме)
  svg.push('<g class="sky-ambient">');
  AMBIENT_STARS.forEach(([x, y, o], i) => {
    const tw = i % 3 === 0 ? ` class="twinkle" style="animation-delay:${(i % 5) * 0.7}s"` : "";
    svg.push(`<circle cx="${x}" cy="${y}" r="1"${tw} fill="#e8c074" opacity="${(o * 0.22).toFixed(2)}"/>`);
  });
  svg.push("</g>");
  // камера: панорама/зум двигают этот слой целиком
  svg.push('<g class="sky-cam">');
  svg.push(`<circle cx="${CX}" cy="${CY}" r="${R_BAND[2] + 6}" fill="url(#selfGlow)"/>`);
  R_BAND.forEach((r) =>
    svg.push(
      `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="#e8c074" ` +
        `stroke-width="0.6" stroke-dasharray="1 6" opacity="0.16"/>`,
    ),
  );
  svg.push('<g class="sky-links">');
  axisLinks.forEach((lk) => svg.push(linkMarkup(lk)));
  themeLinks.forEach((lk) => svg.push(linkMarkup(lk)));
  svg.push("</g>");
  svg.push('<g class="sky-stars">');
  stars.forEach((st, i) => svg.push(starMarkup(st, i)));
  svg.push("</g>");
  svg.push('<circle id="starFocus" class="star-focus" cx="0" cy="0" r="0" fill="none" stroke="#e8c074" stroke-width="1.4" opacity="0"/>');
  svg.push("</g>"); // /sky-cam

  const sec = el("section", "sky");
  sec.appendChild(el("div", "sky-label", "Карта твоей психики"));
  sec.appendChild(
    el(
      "p",
      "sky-sub",
      "Живая карта: в центре — Самость, вокруг — грани, комплексы и архетипы; золотые нити " +
        "связывают растущее из одного корня. Потяни звезду — небо отзовётся. Тапни — раскрою " +
        "грань и подсвечу её созвездие. Щипок — ближе, двойной тап — вернуть как было.",
    ),
  );
  const wrap = el("div", "sky-canvas");
  wrap.innerHTML =
    `<svg viewBox="0 0 300 300" class="sky-svg" role="img" aria-label="Карта психики">${svg.join("")}</svg>`;
  sec.appendChild(wrap);

  const readout = el("div", "sky-readout");
  const HINT = "Нажми на звезду — покажу грань и подсвечу её созвездие";
  readout.appendChild(el("span", "sky-readout-hint", HINT));
  sec.appendChild(readout);

  const nFacets = sections.length + (archetypes ? archetypes.length : 0);
  const nLinks = Object.keys(byTheme).filter((th) => byTheme[th].length >= 2).length;
  const meta = el("div", "sky-meta");
  meta.textContent =
    nFacets + " " + pluralRu(nFacets, "грань", "грани", "граней") +
    (nLinks ? " · " + nLinks + " " + pluralRu(nLinks, "нить", "нити", "нитей") : "");
  sec.appendChild(meta);

  const svgEl = wrap.querySelector("svg");
  if (!svgEl) return sec;
  const camG = svgEl.querySelector(".sky-cam");
  const starGs = Array.prototype.slice.call(svgEl.querySelectorAll(".sky-stars .star"));
  const linkEls = Array.prototype.slice.call(svgEl.querySelectorAll(".sky-links line"));
  const themeLineEls = linkEls.filter((l) => l.getAttribute("data-th"));
  const focus = svgEl.querySelector("#starFocus");

  // Телеграм сворачивает мини-апп свайпом вниз — на живой карте это ложные закрытия.
  if (tg && typeof tg.disableVerticalSwipes === "function") {
    try { tg.disableVerticalSwipes(); } catch (e) { /* старый клиент — не критично */ }
  }

  // --- физика (пружинный граф в духе Obsidian, без библиотек) ---
  // Отталкивание всех от всех + пружины нитей + радиальная гравитация к кольцу своей
  // глубины (семантика мандалы: ближе к центру = узнано). Самость прикована. Симуляция
  // остывает (alpha → 0) и останавливает rAF — батарею не жжём; взаимодействия греют заново.
  stars.forEach((st) => {
    st.vx = 0;
    st.vy = 0;
  });
  const N = stars.length;
  let alpha = 0;
  let raf = 0;
  let dragIdx = -1;

  const physTick = () => {
    const fx = new Array(N).fill(0);
    const fy = new Array(N).fill(0);
    // отталкивание (обрезка по дистанции — локальная структура, O(N²) при наших N дёшев)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = stars[j].x - stars[i].x;
        let dy = stars[j].y - stars[i].y;
        let d2 = dx * dx + dy * dy;
        if (d2 > 8100) continue; // дальше 90 — не влияем
        if (d2 < 0.01) { dx = (i + 1) * 0.03; dy = 0.05; d2 = 0.01; }
        const d = Math.sqrt(d2);
        const rep = 260 / d2;
        fx[i] -= (dx / d) * rep; fy[i] -= (dy / d) * rep;
        fx[j] += (dx / d) * rep; fy[j] += (dy / d) * rep;
      }
    }
    // пружины нитей мотива: свои стягиваются в созвездие
    themeLinks.forEach((lk) => {
      const a = stars[lk.a];
      const b = stars[lk.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - 34) * 0.05;
      fx[lk.a] += (dx / d) * f; fy[lk.a] += (dy / d) * f;
      fx[lk.b] -= (dx / d) * f; fy[lk.b] -= (dy / d) * f;
    });
    // радиальная гравитация к кольцу глубины
    for (let i = 1; i < N; i++) {
      const st = stars[i];
      const dx = st.x - CX;
      const dy = st.y - CY;
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = (R_BAND[st.band] - d) * 0.06;
      fx[i] += (dx / d) * f; fy[i] += (dy / d) * f;
    }
    // интеграция (Самость прикована; перетаскиваемая звезда следует за пальцем)
    for (let i = 1; i < N; i++) {
      if (i === dragIdx) continue;
      const st = stars[i];
      st.vx = (st.vx + fx[i] * alpha) * 0.82;
      st.vy = (st.vy + fy[i] * alpha) * 0.82;
      const sp = Math.hypot(st.vx, st.vy);
      if (sp > 4) { st.vx = (st.vx / sp) * 4; st.vy = (st.vy / sp) * 4; }
      // мир конечен (камера клэмпится к 300×300) — звезда не может улететь за карту
      st.x = Math.max(6, Math.min(294, st.x + st.vx));
      st.y = Math.max(6, Math.min(294, st.y + st.vy));
    }
    // жёсткое разведение оставшихся перекрытий (один быстрый проход)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = stars[i];
        const b = stars[j];
        const min = a.r + b.r + 4;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        if (i !== 0 && i !== dragIdx) { a.x -= ux * push; a.y -= uy * push; }
        if (j !== 0 && j !== dragIdx) { b.x += ux * push; b.y += uy * push; }
      }
    }
  };

  const renderFrame = () => {
    for (let i = 0; i < N; i++) {
      starGs[i].setAttribute(
        "transform", `translate(${stars[i].x.toFixed(2)},${stars[i].y.toFixed(2)})`,
      );
    }
    linkEls.forEach((l) => {
      const a = stars[+l.getAttribute("data-a")];
      const b = stars[+l.getAttribute("data-b")];
      l.setAttribute("x1", a.x.toFixed(1));
      l.setAttribute("y1", a.y.toFixed(1));
      l.setAttribute("x2", b.x.toFixed(1));
      l.setAttribute("y2", b.y.toFixed(1));
    });
    if (active >= 0 && focus) {
      focus.setAttribute("cx", stars[active].x.toFixed(1));
      focus.setAttribute("cy", stars[active].y.toFixed(1));
    }
    updateLabels(); // звёзды сдвинулись — пере-решить, чьи подписи помещаются
  };

  const loop = () => {
    if (!svgEl.isConnected) { raf = 0; return; } // страницу перерисовали — старое небо умерло
    physTick();
    renderFrame();
    alpha *= 0.986;
    if (alpha > 0.02 || dragIdx >= 0) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
    }
  };
  const heat = (a) => {
    alpha = Math.max(alpha, a);
    if (!raf) raf = requestAnimationFrame(loop);
  };

  // --- камера: панорама пальцем, зум щипком/колесом, двойной тап — сброс ---
  const cam = { k: 1, tx: 0, ty: 0 };
  const K_MIN = 1; // мельче «всё небо целиком» не отдаляем
  const K_MAX = 3.2;

  // Подписи как в Obsidian: живут в мире (двигаются со звёздами), но контр-масштабируются
  // 1/k — на любом зуме один экранный размер, никаких огромных надписей. Наложения решает
  // приоритетный отбор: выбранная → якоря → подсвеченные → крупные; проигравшие прячутся
  // (class clash), пока зум не освободит место. Ширину текста оцениваем по числу знаков:
  // DOM-замер (getComputedTextLength) невозможен — svg ещё не в документе.
  const labelEls = starGs.map((g) => g.querySelector(".star-label"));
  const labelBase = stars.map((st) => (st.anchor ? 11 : 8));
  const labelLen = stars.map((st) => String(st.mapLabel || st.label || "").length);
  const updateLabels = () => {
    const k = cam.k;
    const zoomed = k >= 1.35;
    const candidates = [];
    for (let i = 0; i < N; i++) {
      const t = labelEls[i];
      if (!t) continue;
      const fs = labelBase[i] / k;
      t.style.fontSize = fs.toFixed(2) + "px";
      t.style.strokeWidth = (2 / k).toFixed(2) + "px";
      // базлайн так, чтобы зазор под краем звезды был постоянным на экране
      t.setAttribute("y", (stars[i].r + 3 / k + fs).toFixed(2));
      const lit = starGs[i].classList.contains("lit");
      if (stars[i].anchor || lit || zoomed) {
        candidates.push({
          i, prio: (i === active ? 8 : 0) + (stars[i].anchor ? 4 : 0) + (lit ? 2 : 0),
        });
      } else {
        t.classList.remove("clash"); // скрытую CSS-ом подпись в борьбу за место не берём
      }
    }
    candidates.sort((a, b) => b.prio - a.prio || stars[b.i].r - stars[a.i].r);
    const taken = [];
    candidates.forEach(({ i }) => {
      const st = stars[i];
      const w = labelLen[i] * labelBase[i] * 0.58; // экранные (вью-)единицы
      const h = labelBase[i];
      const cx = st.x * k + cam.tx;
      const y0 = (st.y + st.r) * k + cam.ty + 3;
      const box = { x0: cx - w / 2, x1: cx + w / 2, y0, y1: y0 + h };
      const hit = taken.some(
        (b) => box.x0 < b.x1 + 2 && b.x0 < box.x1 + 2 && box.y0 < b.y1 + 1 && b.y0 < box.y1 + 1,
      );
      labelEls[i].classList.toggle("clash", hit);
      if (!hit) taken.push(box);
    });
  };

  const applyCam = () => {
    cam.k = Math.max(K_MIN, Math.min(K_MAX, cam.k));
    // Вью всегда целиком внутри мира: карту нельзя сдвинуть в угол и «потерять»
    // (при k=1 пан — no-op: небо и так видно целиком).
    const over = 300 * (cam.k - 1);
    cam.tx = Math.min(0, Math.max(-over, cam.tx));
    cam.ty = Math.min(0, Math.max(-over, cam.ty));
    camG.setAttribute(
      "transform", `translate(${cam.tx.toFixed(2)} ${cam.ty.toFixed(2)}) scale(${cam.k.toFixed(3)})`,
    );
    svgEl.classList.toggle("zoomed", cam.k >= 1.35); // подписи всех звёзд проявляются
    updateLabels();
  };
  const toView = (e) => {
    const rect = svgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return [0, 0];
    return [
      ((e.clientX - rect.left) / rect.width) * 300,
      ((e.clientY - rect.top) / rect.height) * 300,
    ];
  };
  const toWorld = (vx, vy) => [(vx - cam.tx) / cam.k, (vy - cam.ty) / cam.k];
  const zoomAt = (vx, vy, factor) => {
    const [wx, wy] = toWorld(vx, vy);
    cam.k *= factor;
    cam.k = Math.max(K_MIN, Math.min(K_MAX, cam.k));
    cam.tx = vx - wx * cam.k;
    cam.ty = vy - wy * cam.k;
    applyCam();
  };
  const resetCam = () => {
    cam.k = 1; cam.tx = 0; cam.ty = 0;
    applyCam();
  };

  // --- подсветка выбора: звезда + её созвездие горят, остальное гаснет (как в Obsidian) ---
  let active = -1;
  const applyFocus = () => {
    const focused = active >= 0;
    svgEl.classList.toggle("focused", focused);
    const th = focused ? stars[active].theme : null;
    const lit = {};
    if (focused) {
      lit[active] = true;
      if (th && byTheme[th]) byTheme[th].forEach((k) => { lit[k] = true; });
    }
    starGs.forEach((g, k) => g.classList.toggle("lit", !!lit[k]));
    themeLineEls.forEach((l) =>
      l.classList.toggle("on", !!th && l.getAttribute("data-th") === th));
    if (focus) {
      if (focused) {
        focus.setAttribute("cx", stars[active].x.toFixed(1));
        focus.setAttribute("cy", stars[active].y.toFixed(1));
        focus.setAttribute("r", (stars[active].r + 6).toFixed(1));
        focus.setAttribute("opacity", "0.9");
      } else {
        focus.setAttribute("opacity", "0");
      }
    }
    updateLabels(); // состав lit изменился — пере-решить видимость подписей
    readout.innerHTML = "";
    if (focused) {
      readout.appendChild(el("span", "sky-readout-name", stars[active].label));
      if (stars[active].summary)
        readout.appendChild(el("span", "sky-readout-text", stars[active].summary));
    } else {
      readout.appendChild(el("span", "sky-readout-hint", HINT));
    }
  };

  // Тап = ближайшая звезда к касанию (хит-круги при плотном небе перекрывались бы).
  const starAt = (wx, wy, slack) => {
    let best = -1;
    let bestD = Infinity;
    stars.forEach((st, k) => {
      const d = Math.hypot(st.x - wx, st.y - wy) - st.r;
      if (d < bestD) { bestD = d; best = k; }
    });
    return best >= 0 && bestD <= slack ? best : -1;
  };

  // --- жесты: pointer events покрывают палец и мышь одним кодом ---
  const pointers = new Map(); // pointerId → {vx, vy}
  let gesture = null; // {type:"drag"|"pan"|"pinch", ...}
  let tapStart = null; // {vx, vy, t, moved}
  let lastTap = { t: 0, vx: 0, vy: 0 };

  svgEl.style.cursor = "grab";
  svgEl.style.touchAction = "none"; // жесты карты не скроллят страницу

  svgEl.addEventListener("pointerdown", (e) => {
    // capture не критичен (жест доводим и без него), а на нестандартных pointerId кидает
    try { svgEl.setPointerCapture && svgEl.setPointerCapture(e.pointerId); } catch (err) { /* ок */ }
    const [vx, vy] = toView(e);
    pointers.set(e.pointerId, { vx, vy });
    if (pointers.size === 2) {
      // второй палец: что бы ни шло — теперь это щипок
      const pts = Array.from(pointers.values());
      gesture = {
        type: "pinch",
        d0: Math.max(1, Math.hypot(pts[0].vx - pts[1].vx, pts[0].vy - pts[1].vy)),
        k0: cam.k,
      };
      tapStart = null;
      if (dragIdx >= 0) { dragIdx = -1; }
      return;
    }
    tapStart = { vx, vy, t: Date.now(), moved: false };
    const [wx, wy] = toWorld(vx, vy);
    const hit = starAt(wx, wy, 14 / cam.k);
    if (hit > 0) {
      // Самость (0) не таскаем — она ось карты; тап по ней работает как выбор
      gesture = { type: "drag" };
      dragIdx = hit;
      svgEl.style.cursor = "grabbing";
      heat(0.5);
    } else {
      gesture = { type: "pan", vx, vy, tx0: cam.tx, ty0: cam.ty };
      svgEl.style.cursor = "grabbing";
    }
  });

  svgEl.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const [vx, vy] = toView(e);
    pointers.set(e.pointerId, { vx, vy });
    if (tapStart && Math.hypot(vx - tapStart.vx, vy - tapStart.vy) > 5) tapStart.moved = true;
    if (gesture && gesture.type === "pinch" && pointers.size >= 2) {
      const pts = Array.from(pointers.values());
      const d = Math.max(1, Math.hypot(pts[0].vx - pts[1].vx, pts[0].vy - pts[1].vy));
      const cx = (pts[0].vx + pts[1].vx) / 2;
      const cy = (pts[0].vy + pts[1].vy) / 2;
      const target = gesture.k0 * (d / gesture.d0);
      const factor = target / cam.k;
      zoomAt(cx, cy, factor);
      return;
    }
    if (gesture && gesture.type === "drag" && dragIdx >= 0) {
      const [wx, wy] = toWorld(vx, vy);
      stars[dragIdx].x = Math.max(8, Math.min(292, wx));
      stars[dragIdx].y = Math.max(8, Math.min(292, wy));
      stars[dragIdx].vx = 0;
      stars[dragIdx].vy = 0;
      heat(0.45);
      return;
    }
    if (gesture && gesture.type === "pan") {
      cam.tx = gesture.tx0 + (vx - gesture.vx);
      cam.ty = gesture.ty0 + (vy - gesture.vy);
      applyCam();
    }
  });

  const endPointer = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture && gesture.type === "pinch") {
      if (pointers.size < 2) gesture = null;
      return;
    }
    gesture = null;
    if (dragIdx >= 0) { dragIdx = -1; heat(0.3); }
    svgEl.style.cursor = "grab";
    // тап: короткий, почти без движения — выбор звезды или двойной тап (сброс камеры)
    if (tapStart && !tapStart.moved && Date.now() - tapStart.t < 400) {
      const { vx, vy } = tapStart;
      const now = Date.now();
      if (now - lastTap.t < 320 && Math.hypot(vx - lastTap.vx, vy - lastTap.vy) < 24) {
        lastTap = { t: 0, vx: 0, vy: 0 };
        resetCam();
        active = -1;
        applyFocus();
        tapStart = null;
        return;
      }
      lastTap = { t: now, vx, vy };
      const [wx, wy] = toWorld(vx, vy);
      const hit = starAt(wx, wy, 18 / cam.k);
      active = hit === active ? -1 : hit >= 0 ? hit : -1;
      applyFocus();
    }
    tapStart = null;
  };
  svgEl.addEventListener("pointerup", endPointer);
  svgEl.addEventListener("pointercancel", endPointer);

  svgEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const [vx, vy] = toView(e);
      zoomAt(vx, vy, Math.pow(1.0015, -e.deltaY));
    },
    { passive: false },
  );

  applyCam();
  // Initial layout is already deterministic and overlap-free. Do not start physics on
  // mount: a real profile update may rebuild the map, but it must not visibly collapse
  // toward the default rings. Physics wakes only when the user drags a star.
  return sec;
}

// --- сборка профиля ---------------------------------------------------------

function renderProfile(p) {
  const root = el("div", "profile");
  const c = p.completeness;

  // верхняя строка: бренд + дата
  const top = el("header", "topbar");
  const brand = el("div", "brand");
  brand.appendChild(el("div", "brand-kicker", "Мой образ"));
  brand.appendChild(el("div", "brand-name", p.pseudonym || "Аноним"));
  top.appendChild(brand);
  const upd = fmtDate(p.updated_at);
  if (upd) top.appendChild(el("div", "datepill", "обновлён " + upd));
  root.appendChild(top);

  // «Сегодня» — вопрос дня + возврат в чат: причина открывать мини-апп каждый день
  root.appendChild(todayBlock(p));

  // что изменилось с прошлого визита (динамика между сессиями)
  const dyn = dynamicsBlock(p.dynamics);
  if (dyn) root.appendChild(dyn);

  // герой: интро + кольцо глубины
  const hero = el("section", "hero");
  const left = el("div", "hero-text");
  left.appendChild(el("h1", "hero-title", "Что я о тебе понял"));
  left.appendChild(
    el(
      "p",
      "hero-sub",
      c.is_sufficient
        // Не «сложился» (звучит как финал — расти некуда), а вектор дальше: тоньше и
        // точнее через подтверждение гипотез (счётчик «подтверждено тобой» ниже).
        ? "Основа собрана. Дальше — тоньше: я уточняю гипотезы и связи, а ты подтверждай те, что отзываются."
        : "Образ ещё проявляется. Чем больше говорим — тем отчётливее картина.",
    ),
  );
  hero.appendChild(left);
  root.appendChild(hero);

  // карта психики — живой центр страницы вместо статичной шкалы «глубины»: все грани,
  // комплексы и архетипы как звёзды вокруг Самости + нити общего мотива, тап раскрывает.
  const sky = psycheMap(p.sections, p.archetypes);
  if (sky) root.appendChild(sky);

  // Блок «Нить наших разговоров» убран (08.07): показывал внутренний конспект бэкенда,
  // который читался как вечный банальный текст. Живое лицо — карта, нити, динамика.

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
  if (p.archetypes && p.archetypes.length) {
    root.appendChild(
      groupBlock(
        "Активные архетипы",
        p.archetypes,
        "Общечеловеческие образы, которые сейчас звучат в тебе — по Юнгу они живут в каждом.",
      ),
    );
  }

  if (c.is_sufficient && !(p.archetypes && p.archetypes.length)) {
    // Зрелый профиль без архетипов — НЕ пустой укор, а тёплое приглашение. Архетип —
    // сильное утверждение, поэтому его НЕ выдумывают в extraction (см. память), а зовут
    // человека в разговор, который образ проявит. Чипы — примеры образов ВООБЩЕ, не
    // гипотезы о юзере (эпистемическая скромность): подписаны «например, такие».
    const s = el("section", "group");
    s.appendChild(el("h2", "group-title", "Активные архетипы"));
    s.appendChild(
      el(
        "p",
        "group-sub",
        "Архетип — древний общечеловеческий образ, который вдруг отчётливо звучит в конкретной истории. По Юнгу они живут в каждом.",
      ),
    );
    const invite = el("div", "empty-note arch-invite");
    invite.appendChild(
      el(
        "p",
        "arch-invite-lead",
        "Здесь пока тихо — и это нормально: образы проявляются не из анкеты, а из живого сюжета.",
      ),
    );
    invite.appendChild(el("p", "arch-invite-hint", "Например, такие:"));
    const examples = el("div", "chips arch-invite-chips");
    ["Странник", "Тень", "Творец", "Мудрец", "Сирота"].forEach((name) =>
      examples.appendChild(el("span", "chip chip-ghost", name)),
    );
    invite.appendChild(examples);
    invite.appendChild(
      el(
        "p",
        "arch-invite-cta",
        "Расскажи мне в чате про повторяющийся сон, любимого героя или ситуацию, где ты вдруг узнал себя, — и первый образ проявится здесь.",
      ),
    );
    s.appendChild(invite);
    root.appendChild(s);
  }

  // Работа с привычкой (/habit): показываем только когда есть что показать — free без
  // сессий не получает пустую секцию-укор, а платный видит живой прогресс практики.
  if (p.habits && p.habits.length) {
    const sec = el("section", "group");
    sec.appendChild(el("h2", "group-title", "Работа с привычкой"));
    sec.appendChild(
      el(
        "p",
        "group-sub",
        "Триггер → потребность → замена → минимальная версия на трудный день. Срыв уточняет карту, а не обнуляет путь.",
      ),
    );
    p.habits.forEach((h) => sec.appendChild(habitCard(h)));
    // Живая практика (payload.ritual): сколько раз ритуал получился (кнопка «✅ Сделал»
    // под напоминанием в боте) и во сколько приходит напоминание. Ценность копится на
    // глазах — без стриков и стыда за пропуск, только «сколько раз получилось».
    const r = p.ritual;
    if (r && (r.done_count > 0 || r.reminder_hour != null)) {
      const parts = [];
      if (r.done_count > 0) {
        parts.push(
          "✅ ритуал получился " + r.done_count + " " + pluralRu(r.done_count, "раз", "раза", "раз"),
        );
      }
      if (r.reminder_hour != null) {
        parts.push("⏰ напоминание в " + String(r.reminder_hour).padStart(2, "0") + ":00");
      }
      sec.appendChild(el("p", "ritual-practice", parts.join(" · ")));
    }
    root.appendChild(sec);
  }

  // «Нити»: синтез — грани/привычки/образы, выросшие из ОДНОЙ потребности (payload.threads,
  // группировка по мотиву-тегу theme). Момент «меня реально поняли». Держим гипотезой:
  // eyebrow «возможно, одна нить», без диагноза; сырого evidence тут нет (152-ФЗ).
  if (p.threads && p.threads.length) {
    const sec = el("section", "group weave");
    sec.appendChild(el("h2", "group-title serif", "Что связано в тебе"));
    sec.appendChild(
      el(
        "p",
        "group-sub",
        "Разное поведение часто растёт из одного корня. Увидеть эту связь — и есть работа над " +
          "собой: меняешь не отдельный симптом, а общую нужду под ним. Вот что, похоже, связано у тебя.",
      ),
    );
    p.threads.forEach((t) => {
      const card = el("div", "weave-thread");
      card.appendChild(el("div", "weave-eyebrow", "одна нить"));
      // Инсайт вперёд: общая потребность — крупным. serves/need нередко начинается с
      // «гипотеза:» — срезаем, чтобы не задваивать рамку.
      const need = (t.need || "").replace(/^\s*гипотеза\s*[:—-]\s*/i, "").trim();
      card.appendChild(
        el(
          "p",
          "weave-need serif",
          need
            ? "Общий корень: " + need + "."
            : "Похоже, эти части растут из одной глубинной потребности.",
        ),
      );
      // Что именно связано — чипы граней/образов/привычек.
      card.appendChild(el("div", "weave-connects", "Связывает"));
      const chips = el("div", "chips weave-chips");
      t.members.forEach((m) => {
        const kindWord =
          m.kind === "facet" ? "грань" : m.kind === "archetype" ? "образ" : "привычку";
        const chip = el("span", "chip weave-chip");
        chip.appendChild(el("span", "weave-kind", kindWord));
        chip.appendChild(document.createTextNode(m.kind === "facet" ? m.label : m.name || ""));
        chips.appendChild(chip);
      });
      card.appendChild(chips);
      card.appendChild(
        el("p", "weave-why", "Потянешь за одну — отзовётся вся нить. На карте выше это золотая связь."),
      );
      sec.appendChild(card);
    });
    root.appendChild(sec);
  } else if (p.threads_locked) {
    // Free после демо: сервер отдал только ЧИСЛО нитей (содержимое не пришло в payload).
    // Тизер честный — нити реально найдены; открываются с подпиской (CTA скроллит к оплате).
    const sec = el("section", "group weave");
    sec.appendChild(el("h2", "group-title serif", "Что связано в тебе"));
    const card = el("div", "weave-thread");
    card.appendChild(el("div", "weave-eyebrow", "найдено, но скрыто"));
    card.appendChild(
      el(
        "p",
        "weave-need serif",
        "Я вижу " + p.threads_locked + " " +
          pluralRu(p.threads_locked, "нить", "нити", "нитей") + ": похоже, разные грани, привычки и образы " +
          "растут из одного корня. С подпиской покажу, что именно их связывает — и что с этим делать.",
      ),
    );
    const btn = el("button", "upgrade-btn weave-locked-btn", "Открыть нити 🔓");
    btn.addEventListener("click", () => {
      const up = document.querySelector(".upgrade");
      if (up) up.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    card.appendChild(btn);
    sec.appendChild(card);
    root.appendChild(sec);
  }

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

  // Платным/владельцу подписку не предлагаем; free видит CTA после показанной ценности.
  if (!p.is_paid) root.appendChild(upgradeSection(p.billing));

  if (p.invite_url) root.appendChild(shareRow(p.referral, p.invite_url));

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

let refreshTimer = null;
let refreshInFlight = null;
let refreshQueued = false;
let renderedProfileFingerprint = null;

function profileRenderFingerprint(profile) {
  if (!profile) return "null";
  // GET /api/profile records the visit and therefore rotates dynamics.since/history.at
  // even when the actual profile is unchanged. Those presentation-only timestamps must
  // not remount the whole page. A real dialogue/profile/payment change still alters the
  // rest of the payload and triggers a render; the fresh dynamics block is rendered with it.
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
  if (refreshInFlight) {
    refreshQueued = true;
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const profile = await fetchProfile();
      renderFetchedProfile(profile);
      scheduleRefresh(profile);
    } catch (_) {
      scheduleRefresh(null);
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

async function main() {
  await loadConfig();
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
    setView(stateView("Не сейчас", msg, "✦"));
    scheduleRefresh(null);
  }

  // Telegram 8.0+ явно сообщает, когда сохранённый WebView снова стал активным.
  // focus/visibility/pageshow остаются fallback для старых клиентов и браузеров.
  if (tg && typeof tg.onEvent === "function") tg.onEvent("activated", refreshProfileView);
  window.addEventListener("focus", refreshProfileView);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshProfileView();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshProfileView();
  });
}

main();
