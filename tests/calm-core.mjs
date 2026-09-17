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
const sandbox = {el, closeToChat:()=>closed++, todayBlock:p=>p.change_experiment ? el('section','today','saved') : null,
  stepAttemptBlock:()=>null, conversationOutcomeBlock:()=>null};
vm.createContext(sandbox);
vm.runInContext(extract('optionalBlock')+'\n'+extract('memoryGlanceBlock')+'\n'+extract('pathPanel'), sandbox);
for (const stage of ['portrait_ready','pattern_named','step_chosen','loop_completed']) {
  const home=sandbox.pathPanel({path:{activation:{stage}}, movement:{entries:[]}});
  assert.equal(home.children.length,1,'inferred stage must not create a task');
  home.children[0].children.find(n=>n.tag==='button').listeners.click();
}
assert.equal(closed,4);
const home=sandbox.pathPanel({change_experiment:{action:'synthetic saved action'}, movement:{entries:[]}});
assert.equal(home.children.length,2,'an actual saved step stays accessible');
assert.equal(home.children[1].open,true);
// Главная показывает память, но остаётся спокойной: никаких счётчиков и достижений.
const withMemory = {movement:{entries:[]}, memory_center:{groups:[
  {class:'semantic', items:[
    {type_label:'Цель', content:'confirmed fact', needs_confirmation:false, is_guess:false},
    {type_label:'Граница', content:'a guess', needs_confirmation:false, is_guess:true},
    {type_label:'Ценность', content:'pending one', needs_confirmation:true, is_guess:false},
  ]},
  {class:'working', items:[{type_label:'Открытая тема', content:'fourth item', needs_confirmation:false, is_guess:false}]},
]}};
const memoryHome = sandbox.pathPanel(withMemory);
const glance = memoryHome.children[1];
assert.ok(glance, 'home must show what is remembered');
const rendered = JSON.stringify(glance);
assert.ok(rendered.includes('confirmed fact'), 'remembered content must be visible');
const flat = [];
(function walk(n){ if(!n||typeof n!=='object') return; if(n.text) flat.push(String(n.text)); (n.children||[]).forEach(walk); })(glance);
assert.ok(!flat.some(t=>/\d+\s*(из|дн|раз|подряд|%)/.test(t)), 'no counters or streaks on home');
assert.ok(!flat.some(t=>/достижени|прогресс|серия|уровень/i.test(t)), 'no achievement language on home');
// Подтверждённое вытесняет догадку: на главной человек видит себя, а не наши догадки.
assert.ok(!flat.includes('a guess'), 'a guess never displaces confirmed memory on home');
assert.ok(flat.includes('confirmed fact') && flat.includes('pending one'),
  'confirmed and pending memory both surface before any guess');
// Но когда догадка всё-таки попадает на экран, она подписана как догадка.
const guessOnly = sandbox.pathPanel({movement:{entries:[]}, memory_center:{groups:[
  {class:'semantic', items:[{type_label:'Граница', content:'a guess', needs_confirmation:false, is_guess:true}]},
]}});
const guessFlat=[];
(function walk(n){ if(!n||typeof n!=='object') return; if(n.text) guessFlat.push(String(n.text)); (n.children||[]).forEach(walk); })(guessOnly.children[1]);
assert.ok(guessFlat.includes('догадка'), 'a guess is always labelled as a guess');
// Пустая память не создаёт пустой блок и не требует ничего заполнять.
assert.equal(sandbox.pathPanel({movement:{entries:[]}, memory_center:{groups:[]}}).children.length, 1,
  'empty memory must not create an empty prompt to fill');

let selected, opened=false, scrolled=false;
const movement = vm.runInNewContext('('+extract('openMovement')+')', {
  switchProfileTab:key=>selected=key,
  document:{getElementById:id=>id==='movement-tool' ? {
    set open(value){opened=value;}, scrollIntoView(){scrolled=true;},
  } : null},
});
movement();
assert.equal(selected,'sessions'); assert.ok(opened && scrolled);
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
