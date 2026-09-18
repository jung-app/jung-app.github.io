// Что стережёт этот тест: отказ должен называть свою причину.
//
// Владелец 18.09: нажал «подтвердить» в памяти и получил «не удалось».
// Измерено: initData Telegram живёт максимум час (WEBAPP_INIT_DATA_MAX_AGE,
// жёсткий потолок 3600 с в app/webapp/server.py) и НЕ обновляется, пока
// мини-апп открыт. Запрос возвращал 401, но confirmSection/dismissSection
// не отличали его от сетевой ошибки, а вызывающий код ловил `catch (_)` и
// показывал «Проверь связь». Человек жал ещё раз и получал тот же отказ,
// потому что чинит это переоткрытие из чата, а не повтор.
//
// Поэтому здесь проверяется контракт, а не вёрстка:
//   1. каждый авторизованный вызов различает 401 отдельной веткой;
//   2. текст для истёкшей сессии говорит, что делать (открыть заново),
//      и не врёт про связь.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const fn = name => {
  const m = source.match(new RegExp('async function ' + name + '\\([^]*?\\n}'));
  assert.ok(m, `не найдена функция ${name}`);
  return m[0];
};

// 1. Ни один авторизованный вызов не смеет молча схлопнуть 401 в http-401:
// иначе UI снова не сможет отличить истёкшую сессию от сбоя сети.
for (const name of ['confirmSection', 'dismissSection', 'controlMemory', 'fetchProfile']) {
  assert.match(
    fn(name),
    /res\.status === 401/,
    `${name}: истёкшая сессия должна распознаваться отдельно от прочих ошибок`,
  );
}

// 2. Сообщение об истёкшей сессии ведёт к починке и не обвиняет связь.
const expired = source.match(/Сессия устарела[^"]*/g) || [];
assert.ok(expired.length >= 2, 'нет текста про устаревшую сессию там, где он нужен');
for (const text of expired) {
  assert.match(text, /заново из чата/, 'текст должен говорить, что делать');
  assert.doesNotMatch(text, /связ/i, 'истёкшая сессия — это не проблема связи');
}

// 3. Решение по гипотезе не должно глотать причину отказа: `catch (_)`
// возвращал бы ровно ту ошибку, с которой всё началось.
const decide = source.match(/const decide = \([^]*?\n  };/);
assert.ok(decide, 'не найден обработчик выбора по гипотезе');
assert.doesNotMatch(decide[0], /catch \(_\)/, 'причина отказа не должна отбрасываться');

console.log('Session expiry contract passed: a refusal says why and how to fix it');
