import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const extract = name => source.match(new RegExp('function '+name+'\\([^]*?\\n}'))[0];
class Node {
  constructor(tag, cls, text) { this.tag=tag; this.className=cls; this.text=text; this.children=[]; this.listeners={}; }
  append(...nodes) {this.children.push(...nodes);}
  appendChild(node) {this.children.push(node); return node;}
  addEventListener(name, fn) {this.listeners[name]=fn;}
}
const el = (tag,cls,text) => new Node(tag,cls,text);
let closed=0;
const sandbox = {el, closeToChat:()=>closed++, document:{createTextNode:t=>({text:String(t)})}, switchProfileTab:()=>{}, todayBlock:p=>p.change_experiment ? el('section','today','saved') : null,
  stepAttemptBlock:()=>null, conversationOutcomeBlock:()=>null};
vm.createContext(sandbox);
vm.runInContext(extract('optionalBlock')+'\n'+extract('lastTurnLine')+'\n'+extract('pendingMemoryCount')+'\n'+extract('pathPanel'), sandbox);
// Счёт детей — хрупкая мера: главная несёт ещё и тихую сноску про «Память».
// Проверяем то, что действительно запрещено: задание, выведенное из стадии.
const savedStepBlocks = home => home.children.filter(n=>n.tag==='details');
for (const stage of ['portrait_ready','pattern_named','step_chosen','loop_completed']) {
  const home=sandbox.pathPanel({path:{activation:{stage}}, movement:{entries:[]}});
  assert.equal(savedStepBlocks(home).length,0,'inferred stage must not create a task');
  home.children[0].children.find(n=>n.tag==='button').listeners.click();
}
assert.equal(closed,4);
const home=sandbox.pathPanel({change_experiment:{action:'synthetic saved action'}, movement:{entries:[]}});
const saved=savedStepBlocks(home);
assert.equal(saved.length,1,'an actual saved step stays accessible');
assert.equal(saved[0].open,true);
// Главная НЕ дублирует «Память»: список записей живёт ровно в одном месте.
// Дублирование один раз уже уехало в production и было замечено владельцем.
const withMemory = {movement:{entries:[]}, live_sync:{last_turn_at:new Date(Date.now()-86400000).toISOString()},
  memory_center:{groups:[{class:'semantic', items:[
    {type_label:'Цель', content:'synthetic remembered goal', needs_confirmation:false, is_guess:false},
  ]}]}};
const memoryHome = sandbox.pathPanel(withMemory);
const homeFlat = [];
(function walk(n){ if(!n||typeof n!=='object') return; if(n.text) homeFlat.push(String(n.text)); (n.children||[]).forEach(walk); })(memoryHome);
assert.ok(!homeFlat.some(t=>t.includes('synthetic remembered goal')),
  'home must not duplicate the memory tab');
assert.ok(homeFlat.some(t=>/Мы говорили вчера/.test(t)), 'home links back to the last conversation');
assert.ok(!homeFlat.some(t=>/\d+\s*(из|раз|подряд|%)/.test(t)), 'no counters or streaks on home');
assert.ok(!homeFlat.some(t=>/достижени|прогресс|серия|уровень/i.test(t)), 'no achievement language on home');
// Без прошлого разговора остаётся приглашение, а не пустое место.
const fresh = sandbox.pathPanel({movement:{entries:[]}});
const freshFlat=[];
(function walk(n){ if(!n||typeof n!=='object') return; if(n.text) freshFlat.push(String(n.text)); (n.children||[]).forEach(walk); })(fresh);
assert.ok(freshFlat.some(t=>/Расскажи, что сейчас/.test(t)), 'a first visit still gets an invitation');
// Сноска зовёт в «Память» только когда там нужен выбор человека, и никогда не
// превращается в счётчик: «несколько», а не число.
const pendingHome = sandbox.pathPanel({movement:{entries:[]}, memory_center:{groups:[{class:'semantic', items:[
  {type_label:'Граница', content:'a', needs_confirmation:true, is_guess:false},
  {type_label:'Цель', content:'b', needs_confirmation:true, is_guess:false},
  {type_label:'Предпочтение', content:'c', needs_confirmation:true, is_guess:true},
]}]}});
const pendFlat=[];
(function walk(n){ if(!n||typeof n!=='object') return; if(n.text) pendFlat.push(String(n.text)); (n.children||[]).forEach(walk); })(pendingHome);
const joined = pendFlat.join(' ');
assert.ok(/Несколько записей ждут/.test(joined), 'pending memory invites a decision');
assert.ok(!/\b[23]\b/.test(joined), 'the invitation must not become a count');
// Догадка не считается ждущей решения: подтверждать её одним нажатием нельзя.
const guessOnlyHome = sandbox.pathPanel({movement:{entries:[]}, memory_center:{groups:[{class:'semantic', items:[
  {type_label:'Предпочтение', content:'c', needs_confirmation:true, is_guess:true},
]}]}});
const guessFlat=[];
(function walk(n){ if(!n||typeof n!=='object') return; if(n.text) guessFlat.push(String(n.text)); (n.children||[]).forEach(walk); })(guessOnlyHome);
assert.ok(!/ждут|ждёт/.test(guessFlat.join(' ')), 'a guess is never presented as awaiting a decision');

let selected, opened=false, scrolled=false;
const movement = vm.runInNewContext('('+extract('openMovement')+')', {
  switchProfileTab:key=>selected=key,
  document:{getElementById:id=>id==='movement-tool' ? {
    set open(value){opened=value;}, scrollIntoView(){scrolled=true;},
  } : null},
});
movement();
// Записи движения переехали в «Память» вместе с остальным сохранённым.
assert.equal(selected,'memory'); assert.ok(opened && scrolled);
// Без сохранённых записей вкладки практик нет: ссылка молчит, а не бросает
// человека на главную без объяснения.
let strandedTab = null;
vm.runInNewContext('('+extract('openMovement')+')', {
  switchProfileTab:key=>{strandedTab=key;},
  document:{getElementById:()=>null},
})();
assert.equal(strandedTab, null, 'movement link must not switch to a tab that is not rendered');
let exitCalls=0;
const guardedClose=vm.runInNewContext('('+extract('closeToChat')+')', {
  hasMemoryDraft:()=>true,
  document:{querySelector:()=>({closest:()=>null}), getElementById:()=>({textContent:'', scrollIntoView(){}})},
  announceAction(){}, tg:{close(){exitCalls++;}},
});
guardedClose(); assert.equal(exitCalls,0,'closing must preserve an unsaved or pending form');
console.log('Calm core behavior passed: no inferred tasks, actual step, legacy movement link, draft exit');

let dirty = false; const closingChanges=[];
const nativeGuard = vm.runInNewContext('let nativeDraftProtected = null; ('+extract('syncDraftCloseProtection')+')', {
  hasMemoryDraft:()=>dirty,
  tg:{enableClosingConfirmation(){closingChanges.push(true);},disableClosingConfirmation(){closingChanges.push(false);}},
});
nativeGuard(); dirty=true; nativeGuard(); nativeGuard(); dirty=false; nativeGuard();
assert.deepEqual(closingChanges,[false,true,false]);

let answered = false; let questions=[];
const feedback = vm.runInNewContext('('+extract('conversationOutcomeBlock')+')', {
  changeExperimentView:step=>step?.action ? step : null,
  hasOutcome:(_,event)=>answered && event==='conversation_insight',
  el, labelSection(){}, outcomeQuestion:q=>{questions.push(q.event);return el('fieldset');},
});
const profile={change_experiment:{},outcome_prompts:{conversation_key:'synthetic'},outcome_feedback:[]};
feedback(profile); assert.deepEqual(questions,['conversation_insight']);
answered=true; assert.equal(feedback(profile),null);
answered=false; questions=[];
feedback({...profile,change_experiment:{action:'synthetic actual step'}});
assert.deepEqual(questions,['conversation_insight','next_step_clarity']);
