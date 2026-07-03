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

// Карточка привычки: {привычка, чему служит, ритуал замещения, прогресс}.
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

  if (item.serves) card.appendChild(habitField("чему служит", item.serves));
  if (item.ritual) card.appendChild(habitField("ритуал замещения", item.ritual, "habit-field--ritual"));

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
function sparkline(history) {
  const pts = (history || []).filter((p) => p && typeof p.score === "number");
  if (pts.length < 2) return null;

  const W = 240;
  const H = 48;
  const pad = 4;
  const scores = pts.map((p) => p.score);
  const max = Math.max(...scores, 1);
  const min = Math.min(...scores, 0);
  const span = Math.max(1, max - min);
  const stepX = (W - pad * 2) / (pts.length - 1);
  const xy = pts.map((p, i) => {
    const x = pad + i * stepX;
    const y = H - pad - ((p.score - min) / span) * (H - pad * 2);
    return [x, y];
  });
  const line = xy.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
  const area = line + ` L${(W - pad).toFixed(1)} ${H - pad} L${pad} ${H - pad} Z`;
  const [lx, ly] = xy[xy.length - 1];

  const wrap = el("div", "spark");
  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="spark-svg" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e8c074" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#e8c074" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#sparkfill)" />
      <path d="${line}" fill="none" stroke="#e8c074" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3" fill="#e8c074" />
    </svg>`;
  const cap = el("div", "spark-cap");
  cap.appendChild(el("span", null, "глубина во времени"));
  cap.appendChild(el("span", "spark-now", scores[scores.length - 1] + "%"));
  wrap.appendChild(cap);
  return wrap;
}

function dynamicsBlock(d) {
  if (!d) return null;
  const sec = el("section", "dynamics");
  sec.appendChild(el("div", "dynamics-label", "С прошлого визита"));

  if (d.is_first_view) {
    sec.appendChild(
      el("p", "dynamics-text", "Это первый снимок твоего образа. В следующий раз покажу, что в нём изменилось."),
    );
  } else if (!d.has_changes) {
    sec.appendChild(
      el("p", "dynamics-text", "С нашего прошлого разговора образ не менялся. Продолжим — и он станет глубже."),
    );
  } else {
    const row = el("div", "dynamics-row");
    if (d.delta_percent) {
      const up = d.delta_percent > 0;
      const pill = el("span", "delta" + (up ? " delta--up" : " delta--down"));
      pill.textContent = (up ? "+" : "−") + Math.abs(d.delta_percent) + "% глубины";
      row.appendChild(pill);
    }
    (d.new_sections || []).forEach((label) =>
      row.appendChild(el("span", "delta delta--new", "новое: " + label)),
    );
    (d.new_archetypes || []).forEach((name) =>
      row.appendChild(el("span", "delta delta--arch", "архетип: " + name)),
    );
    (d.new_habits || []).forEach((name) =>
      row.appendChild(el("span", "delta delta--habit", "практика: " + name)),
    );
    sec.appendChild(row);
  }

  // Траектория глубины — показываем всегда, когда накопилось ≥2 точек (даже без свежих
  // изменений): возвращающийся видит свой путь, а не только дельту последнего визита.
  const spark = sparkline(d.history);
  if (spark) sec.appendChild(spark);
  return sec;
}

// Кнопка «позвать близкого»: открывает нативный share-лист Telegram с реф-ссылкой юзера
// (приходит в payload.invite_url с бэкенда). ВАЖНО (152-ФЗ): текст карточки обезличен —
// никаких граней/гипотез/архетипов, только приглашение. Делятся ссылкой, не профилем.
function shareRow(inviteUrl) {
  const sec = el("section", "share");
  const btn = el("button", "share-btn", "Позвать близкого в путь");
  btn.type = "button";
  btn.addEventListener("click", () => {
    const text =
      "Я иду путём самопознания с этим проводником — юнгианская работа над собой прямо в Telegram. Попробуй и ты 🌑";
    const link = "https://t.me/share/url?url=" + encodeURIComponent(inviteUrl) + "&text=" + encodeURIComponent(text);
    if (tg && typeof tg.openTelegramLink === "function") tg.openTelegramLink(link);
    else window.open(link, "_blank");
  });
  sec.appendChild(btn);
  sec.appendChild(
    el("p", "share-hint", "Другу — бесплатное знакомство, тебе — бонусные дни, когда он останется."),
  );
  return sec;
}

// Запросить у бэкенда ссылку на оплату подписки картой (lava.top). Та же страница оплаты,
// что и по кнопке «Оплатить картой» в чате; зачисление приходит вебхуком lava.
async function requestInvoice(period) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetch(base.replace(/\/$/, "") + "/api/invoice", {
    method: "POST",
    headers: { Authorization: "tma " + initData, "Content-Type": "application/json" },
    body: JSON.stringify({ period: period || "monthly" }),
  });
  if (!res.ok) throw new Error("http-" + res.status);
  return (await res.json()).url;
}

// Оплата прямо из мини-аппа: человек увидел свой образ → платит картой, не возвращаясь
// в чат. Замыкает петлю «ценность → оплата» в точке пика. lava.top — внешняя защищённая
// страница, поэтому открываем её tg.openLink (НЕ openInvoice — тот только для нативных
// Telegram-инвойсов в звёздах). Доступ начисляет вебхук; профиль перечитается как платный.
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
      if (tg && typeof tg.openLink === "function") {
        tg.openLink(url); // встроенный браузер Telegram → защищённая страница оплаты
      } else {
        window.open(url, "_blank");
      }
      restore();
      pollForActivation(); // когда вебхук зачислит подписку — покажем подтверждение сами
    })
    .catch(() => {
      restore();
      if (tg && typeof tg.showAlert === "function")
        tg.showAlert("Не получилось открыть оплату. Попробуй ещё раз или набери /upgrade в чате.");
    });
}

// После открытия страницы оплаты картой — лёгкий поллинг профиля: как только вебхук lava
// начислит подписку (is_paid=true), показываем подтверждение, не требуя ручного обновления.
// Внешняя оплата не даёт колбэка статуса (в отличие от openInvoice), поэтому опрашиваем сами.
function pollForActivation() {
  let attempts = 0;
  const tick = async () => {
    attempts += 1;
    try {
      const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
      const initData = tg && tg.initData ? tg.initData : "";
      const res = await fetch(base.replace(/\/$/, "") + "/api/profile", {
        headers: { Authorization: "tma " + initData },
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

// Панель подписки (только для free): после показа реального образа продаём ПАМЯТЬ —
// продолжение пути, а не «безлимит». Существующие грани не прячем (это данные юзера,
// 152-ФЗ «ты хозяин данных») — показываем, что открывает подписка, и кнопку оплаты.
function upgradeSection(billing) {
  const sec = el("section", "upgrade");
  sec.appendChild(el("div", "upgrade-label", "Дальше — вместе"));
  sec.appendChild(el("h2", "upgrade-title serif", "Я не забуду тебя завтра"));
  sec.appendChild(
    el(
      "p",
      "upgrade-text",
      "Сейчас этот образ живёт, пока мы говорим. С подпиской я помню твой путь между " +
        "сессиями: возвращаюсь к тому, что важно, и веду глубже — а не с чистого листа.",
    ),
  );
  const perks = el("ul", "upgrade-perks");
  // Канон ценности — зеркало subscription_comparison() в app/handlers/payments.py.
  // Держи в синхроне с ботом и лендингом (активное воображение скрыто до раскатки).
  [
    "Память между сессиями — продолжаем, где остановились",
    "Безлимитные разговоры с проводником",
    "Растущий портрет тебя и вехи внутреннего роста",
    "Дневник снов 🌙 — бережная работа с образами снов",
    "Работа с привычками 🌿 — чему служит привычка и чем её заместить",
    "Я сам бережно пишу первым между сессиями",
  ].forEach((t) => {
    const li = el("li", "upgrade-perk");
    li.appendChild(el("span", "perk-mark", "🔓"));
    li.appendChild(el("span", "perk-text", t));
    perks.appendChild(li);
  });
  sec.appendChild(perks);
  // Два тарифа: месяц — дефолт (низкий порог первого «да»), год — якорь со скидкой.
  // Цены приходят в payload.billing (ярлыки UI; суммы живут на офферах lava).
  const b = billing || {};
  const monthly = b.monthly_rub || 0;
  const btn = el(
    "button",
    "upgrade-btn",
    monthly ? "Месяц — " + monthly + " ₽" : "Продолжить с памятью",
  );
  btn.type = "button";
  btn.addEventListener("click", () => startUpgrade(btn, "monthly"));
  sec.appendChild(btn);
  if (b.annual_available && b.annual_rub) {
    const saved = monthly ? Math.round((1 - b.annual_rub / (12 * monthly)) * 100) : 0;
    const ybtn = el(
      "button",
      "upgrade-btn upgrade-btn-annual",
      "Год — " + b.annual_rub + " ₽" + (saved > 0 ? " (выгода " + saved + "%)" : ""),
    );
    ybtn.type = "button";
    ybtn.addEventListener("click", () => startUpgrade(ybtn, "annual"));
    sec.appendChild(ybtn);
  }
  sec.appendChild(el("p", "upgrade-hint", "Оплата банковской картой. Доступ открывается сразу после оплаты."));
  return sec;
}

function groupBlock(title, items, sub) {
  const sec = el("section", "group");
  sec.appendChild(el("h2", "group-title", title));
  if (sub) sec.appendChild(el("p", "group-sub", sub));
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
  brand.appendChild(el("div", "brand-kicker", "Мой образ"));
  brand.appendChild(el("div", "brand-name", p.pseudonym || "Аноним"));
  top.appendChild(brand);
  const upd = fmtDate(p.updated_at);
  if (upd) top.appendChild(el("div", "datepill", "обновлён " + upd));
  root.appendChild(top);

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
        "Из сессий /habit: чему служит привычка и какой ритуал может кормить ту же потребность честнее.",
      ),
    );
    p.habits.forEach((h) => sec.appendChild(habitCard(h)));
    root.appendChild(sec);
  }

  // «Нити»: синтез — грани/привычки/образы, выросшие из ОДНОЙ потребности (payload.threads,
  // группировка по мотиву-тегу theme). Момент «меня реально поняли». Держим гипотезой:
  // eyebrow «возможно, одна нить», без диагноза; сырого evidence тут нет (152-ФЗ).
  if (p.threads && p.threads.length) {
    const sec = el("section", "group weave");
    sec.appendChild(el("h2", "group-title serif", "Нити образа"));
    sec.appendChild(
      el(
        "p",
        "group-sub",
        "Похоже, разные грани растут из одной глубинной потребности — вот как они переплетаются.",
      ),
    );
    p.threads.forEach((t) => {
      const card = el("div", "weave-thread");
      card.appendChild(el("div", "weave-eyebrow", "возможно, одна нить"));
      const chips = el("div", "chips weave-chips");
      t.members.forEach((m) => {
        const kindWord =
          m.kind === "facet" ? "грань" : m.kind === "archetype" ? "образ" : "привычка";
        const chip = el("span", "chip weave-chip");
        chip.appendChild(el("span", "weave-kind", kindWord));
        chip.appendChild(document.createTextNode(m.kind === "facet" ? m.label : m.name || ""));
        chips.appendChild(chip);
      });
      card.appendChild(chips);
      // serves нередко уже начинается с «гипотеза:» — срезаем, чтобы не задваивать рамку.
      const need = (t.need || "").replace(/^\s*гипотеза\s*[:—-]\s*/i, "").trim();
      card.appendChild(
        el(
          "p",
          "weave-need",
          need
            ? "Их питает одна потребность — " + need + "."
            : "Похоже, их питает одна глубинная потребность.",
        ),
      );
      sec.appendChild(card);
    });
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

  if (p.invite_url) root.appendChild(shareRow(p.invite_url));

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
