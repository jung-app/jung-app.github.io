// Что именно стережёт этот тест: правила владельца, а не форму экрана.
// До 18.09 он был привязан к pathPanel, вкладкам, «движению» и «сохранённому
// шагу». Эти разделы удалены, потому что соответствующих ключей нет ни в одном
// профиле в production, и тест, проверяющий их вёрстку, охранял пустоту.
// Здесь остались только запреты, которые владелец подтверждал многократно:
//   1. никаких счётчиков, серий и достижений;
//   2. один и тот же контент не показывается в двух местах;
//   3. догадка не выдаётся за подтверждённый факт;
//   4. первый визит получает приглашение, а не пустое место;
//   5. разговор остаётся главным и доступен всегда;
//   6. права на данные (экспорт и удаление) достижимы с экрана;
//   7. незакрытый черновик не теряется при выходе.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const extract = name => source.match(new RegExp('function '+name+'\\([^]*?\\n}'))[0];

class Node {
  constructor(tag, cls, text) { this.tag=tag; this.className=cls||''; this.text=text; this.children=[]; this.listeners={}; this.dataset={}; this.classList={add:c=>{this.className+=' '+c;}}; }
  append(...nodes) {this.children.push(...nodes);}
  appendChild(node) {if(node) this.children.push(node); return node;}
  addEventListener(name, fn) {this.listeners[name]=fn;}
  setAttribute(){}
  querySelectorAll(){return [];}
}
const el = (tag,cls,text) => new Node(tag,cls,text);
const flatten = root => { const out=[]; (function walk(n){ if(!n||typeof n!=='object') return; if(n.text) out.push(String(n.text)); (n.children||[]).forEach(walk); })(root); return out; };

let closed=0;
const sandbox = {
  el, closeToChat:()=>closed++,
  document:{createTextNode:t=>({text:String(t)})},
  confirmSection:async()=>{}, dismissSection:async()=>{},
  optionalBlock:(title,node)=>node ? el('details',null,title) : null,
  upgradeSection:()=>el('section','upgrade'),
  shareRow:()=>el('div','share'),
  memoryControlsBlock:()=>el('section','memory-controls','Ты управляешь памятью'),
  legalLinks:()=>el('nav','legal-links'),
  lastTurnLine:p=>p.live_sync&&p.live_sync.last_turn_at ? 'Мы говорили вчера.' : null,
  pluralRu:(n,one,few,many)=>n===1?one:(n<5?few:many), fmtDate:()=>'5 сен',
};
vm.createContext(sandbox);
vm.runInContext([extract('threadLine'),extract('evidenceBlock'),extract('understandingItem'),extract('habitItem'),extract('withheldNote'),extract('understandingScreen'),extract('quietFooter')].join('\n'), sandbox);

const facet = (over={}) => ({key:'fears', label:'Страхи', summary:'synthetic understanding line', user_confirmed:false, ...over});

// 5. Разговор доступен всегда и ведёт в чат, даже когда понимания ещё нет.
for (const p of [{}, {sections:[facet()]}, {sections:[]}]) {
  const screen = sandbox.understandingScreen(p);
  const talk = screen.children.find(n=>n.className==='talk');
  assert.ok(talk, 'conversation stays on the screen in every state');
  talk.children.find(n=>n.tag==='button').listeners.click();
}
assert.equal(closed,3,'the chat button works in every state');

// 4. Первый визит: приглашение, а не пустой экран.
const freshFlat = flatten(sandbox.understandingScreen({sections:[]}));
assert.ok(freshFlat.some(t=>/Расскажи, что сейчас/.test(t)), 'a first visit gets an invitation');
assert.ok(freshFlat.some(t=>/Пока я мало что о тебе знаю/.test(t)), 'an empty screen is honest, not broken');

// 1. Никаких счётчиков, серий, процентов и достижений — ни в одном состоянии.
const many = {sections:[facet({key:'a',label:'Тень'}),facet({key:'b',label:'Страхи',user_confirmed:true}),facet({key:'c',label:'Паттерны'})],
  threads:[{theme:'t',members:[{kind:'facet',label:'Тень'},{kind:'facet',label:'Страхи'}]}]};
const manyFlat = flatten(sandbox.understandingScreen(many));
const manyJoined = manyFlat.join(' ');
assert.ok(!/\b\d+\s*(из|раз|подряд|%)/.test(manyJoined), 'no counters or streaks');
assert.ok(!/достижени|прогресс|серия|уровень|баллов/i.test(manyJoined), 'no achievement language');
assert.ok(!/\b(2|3)\s+(темы|записи|раздела)/.test(manyJoined), 'the screen never counts what it shows');

// 2. Один контент в одном месте: текст темы не повторяется на экране дважды.
const summaries = manyFlat.filter(t=>t==='synthetic understanding line');
assert.equal(summaries.length, 3, 'each understanding appears exactly once');

// 3. Нить помечена как догадка и не выдаётся за вывод.
const threadFlat = manyFlat.join(' ');
assert.ok(/догадка, а не вывод/.test(threadFlat), 'a thread is explicitly a guess');
// Нить из одного элемента не рисуется: связи из одной точки не бывает.
assert.equal(sandbox.threadLine({members:[{kind:'facet',label:'Тень'}]}), null, 'a single member is not a thread');

// Подтверждённое не спрашивают повторно, неподтверждённое даёт оба выбора.
const confirmed = sandbox.understandingItem(facet({user_confirmed:true}));
assert.equal(confirmed.children.filter(n=>n.className==='understanding-ask').length, 0, 'a confirmed understanding is not re-asked');
const open = sandbox.understandingItem(facet());
const ask = open.children.find(n=>n.className==='understanding-ask');
assert.equal(ask.children.length, 2, 'an open understanding offers both answers');
assert.ok(ask.children.some(b=>/Не про меня/.test(b.text)), 'the person can always disagree');

// Лента наблюдений: свёрнута, полная, и это не счётчик достижений.
const withEvidence = facet({evidence:[
  {observation:'наблюдение одно', observed_at:'2026-09-01T10:00:00.000Z'},
  {observation:'наблюдение два', observed_at:'2026-09-09T10:00:00.000Z'},
  {observation:'наблюдение три', observed_at:'2026-09-05T10:00:00.000Z'},
]});
const evItem = sandbox.understandingItem(withEvidence);
const ledger = evItem.children.find(n=>n.tag==='details');
assert.ok(ledger, 'observations are reachable');
const evRows = flatten(ledger).filter(t=>/^наблюдение /.test(t));
assert.equal(evRows.length, 3, 'every observation survives to the screen');
assert.deepEqual(evRows, ['наблюдение два','наблюдение три','наблюдение одно'], 'newest first');

// 6. Права на данные достижимы с экрана в любом состоянии.
for (const p of [{sections:[]}, many]) {
  assert.ok(flatten(sandbox.understandingScreen(p)).some(t=>/Ты управляешь памятью|Мои данные/.test(t)),
    'export and deletion stay reachable');
}

// 7. Незакрытый черновик не теряется при выходе.
let exitCalls=0;
const guardedClose=vm.runInNewContext('('+extract('closeToChat')+')', {
  hasMemoryDraft:()=>true,
  document:{querySelector:()=>({closest:()=>null}), getElementById:()=>({textContent:'', scrollIntoView(){}})},
  announceAction(){}, tg:{close(){exitCalls++;}},
});
guardedClose(); assert.equal(exitCalls,0,'closing preserves an unsaved form');

let dirty = false; const closingChanges=[];
const nativeGuard = vm.runInNewContext('let nativeDraftProtected = null; ('+extract('syncDraftCloseProtection')+')', {
  hasMemoryDraft:()=>dirty,
  tg:{enableClosingConfirmation(){closingChanges.push(true);},disableClosingConfirmation(){closingChanges.push(false);}},
});
nativeGuard(); dirty=true; nativeGuard(); nativeGuard(); dirty=false; nativeGuard();
assert.deepEqual(closingChanges,[false,true,false]);

console.log('Calm core rules passed: no counters, no duplication, a guess stays a guess, data rights reachable, drafts survive');
