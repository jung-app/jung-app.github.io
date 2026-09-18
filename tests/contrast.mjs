// Читаемость меряется, а не оценивается на глаз.
//
// 18.09 палитра перестала наследоваться от --tg-theme-* и стала своей. Это
// сняло «простецкий» вид стокового мессенджера, но вместе с тем сняло и
// гарантию читаемости, которую раньше давал клиент: теперь за контраст
// отвечаем мы. Тест берёт значения ИЗ styles.css, а не из копии, поэтому
// правка цвета без проверки контраста роняет сборку.
//
// Порог WCAG AA 4.5:1 для текста. Проверяются обе темы: пары, которые
// реально встречаются на экране, а не все возможные сочетания.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

// Берём последний блок объявлений для каждой темы: слой облика идёт в конце
// файла и намеренно переопределяет более ранние значения.
function tokens(selector) {
  const blocks = [...css.matchAll(new RegExp(selector.replace(/[[\]"^$.*+?()|{}\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g'))];
  assert.ok(blocks.length, `не найден блок ${selector}`);
  const found = {};
  for (const block of blocks) {
    for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      found[name] = value;
    }
  }
  return found;
}

const hex = h => {
  h = h.replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const luminance = h => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const MIN = 4.5;
const themes = {
  'светлая': tokens(':root'),
  'тёмная': tokens(':root[data-telegram-theme="dark"]'),
};

// Пары «что на чём лежит» в реальной вёрстке одного экрана.
const pairs = [
  ['--text', '--bg', 'текст на фоне'],
  ['--text', '--surface', 'текст на карточке'],
  ['--text', '--surface-alt', 'текст на вторичной поверхности'],
  ['--muted', '--bg', 'приглушённый на фоне'],
  ['--muted', '--surface', 'приглушённый на карточке'],
  ['--on-action', '--action', 'подпись на кнопке'],
  ['--link', '--surface', 'ссылка на карточке'],
  ['--accent', '--surface', 'акцент на карточке'],
];

let checked = 0;
for (const [theme, t] of Object.entries(themes)) {
  for (const [fgName, bgName, label] of pairs) {
    const fg = t[fgName];
    const bg = t[bgName];
    assert.ok(fg, `${theme}: не задан ${fgName}`);
    assert.ok(bg, `${theme}: не задан ${bgName}`);
    const r = ratio(fg, bg);
    assert.ok(
      r >= MIN,
      `${theme}, ${label}: контраст ${r.toFixed(2)}:1 ниже ${MIN}:1 (${fg} на ${bg})`
    );
    checked += 1;
  }
}

// Палитра должна быть своей. Если --bg снова начнёт читать --tg-theme-bg-color,
// продукт вернётся к стоковому виду мессенджера, и проверка выше станет ложью:
// реальные цвета будет задавать клиент, а не этот файл.
const ownPalette = css.slice(css.indexOf('ОБЛИК 2026'));
assert.ok(ownPalette.length, 'слой облика исчез из styles.css');
assert.ok(
  /--bg:\s*#/.test(ownPalette),
  '--bg снова наследуется от темы Telegram: измеренный контраст перестал что-либо значить'
);

console.log(`Контраст проверен: ${checked} пар в двух темах, минимум ${MIN}:1`);
