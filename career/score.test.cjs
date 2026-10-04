const assert = require('node:assert/strict');
const M = require('./model.js');
const {questions, spheres, roles, evaluate, rolesFor, plan, stages} = M;

// Структура
assert.equal(questions.length, 26);
assert.deepEqual(stages.map(s => questions.filter(q => q.stage === s.n).length), [10, 10, 6]);
const ids = new Set(questions.map(q => q.id));
assert.equal(ids.size, questions.length, 'id вопросов уникальны');
for (const r of roles) assert.ok(M.sphereById[r.sphere], 'сфера роли ' + r.id);
for (const s of spheres) {
  assert.ok(roles.some(r => r.sphere === s.id), 'у сферы есть профессии ' + s.id);
  assert.ok(s.try && s.youtube && s.reality && s.essence, 'контент сферы ' + s.id);
}
for (const id of Object.values(M.marketingByType)) assert.ok(M.roleById[id] && M.sphereById[M.roleById[id].sphere].mk);
for (const o of [...M.experienceOptions, ...M.praiseOptions]) for (const s of o.spheres) assert.ok(M.sphereById[s]);
for (const o of M.experienceOptions) for (const b of o.bridge) assert.ok(M.roleById[b], 'мост ' + b);

// Баланс типов: в каждом этапе каждый тип предлагается одинаковое число раз
for (const n of [1, 2]) {
  const cnt = {};
  questions.filter(q => q.stage === n && q.kind === 'interest').forEach(q => q.options.filter(o => o.type).forEach(o => cnt[o.type] = (cnt[o.type] || 0) + 1));
  assert.equal(new Set(Object.values(cnt)).size, 1, 'баланс этапа ' + n);
  assert.equal(Object.keys(cnt).length, 6);
}

// Ответы «всегда выбираю тип X»
const pick = (letter, upTo = 2) => {
  const a = {};
  questions.filter(q => q.kind === 'interest' && q.stage <= upTo).forEach(q => {
    const i = q.options.findIndex(o => o.type === letter);
    a[q.id] = i >= 0 ? i : 0;
  });
  return a;
};
const expectTop = {A: ['design', 'smm', 'texts'], I: ['data', 'tech', 'it'], S: ['edu'], E: ['marketing', 'smm', 'marketplace', 'hr', 'clients'], C: ['ops', 'data', 'marketplace', 'clients'], R: ['tech', 'it', 'design']};
for (const L of 'RIASEC') {
  const r = evaluate(pick(L, 1));
  assert.equal(r.types[0], L, 'ведущий тип ' + L);
  assert.equal(r.top.length, 3, 'всегда три сферы');
  assert.ok(expectTop[L].includes(r.top[0].id), L + ' → ' + r.top[0].id);
}

// Нейтральный вариант есть везде и ничего не засчитывает
for (const q of questions.filter(q => q.kind === 'interest')) assert.equal(q.options[q.options.length - 1].type, null);
const allNeutral = {};
questions.filter(q => q.kind === 'interest').forEach(q => allNeutral[q.id] = q.options.length - 1);
assert.equal(evaluate(allNeutral).count, 0);
assert.deepEqual(evaluate(allNeutral).types, []);
assert.equal(evaluate({...allNeutral, experience: ['teaching']}).top[0].id, 'edu', 'без интересов решает опыт');

// Пустые ответы не ломают оценку и не дают пустой результат
assert.equal(evaluate({}).top.length, 3);

// Опыт поднимает связанную сферу
const base = pick('S', 1);
const withTeach = {...base, experience: ['teaching']};
const sc = (r, id) => r.ranked.find(x => x.id === id).score;
assert.ok(sc(evaluate(withTeach), 'edu') > sc(evaluate(base), 'edu'));

// Фильтры этапа 3
const callsQ = questions.find(q => q.id === 'calls');
const noCalls = {...pick('E'), calls: callsQ.options.findIndex(o => o.value === 0)};
assert.ok(!rolesFor('clients', noCalls).some(r => r.calls), 'без звонков');
assert.ok(rolesFor('clients', pick('E')).some(r => r.calls));
const learnQ = questions.find(q => q.id === 'learn');
const now = {...pick('A'), learn: learnQ.options.findIndex(o => o.value === 'now')};
assert.ok(!rolesFor('design', now).some(r => r.level === 'long'), 'долгий путь скрыт');
assert.ok(rolesFor('design', now).filter(r => r.level === 'course').every(r => r.later), 'курсы — на будущее');
assert.ok(!rolesFor('edu', pick('S')).some(r => r.level === 'base'), 'репетитор только с опытом');
assert.ok(rolesFor('edu', withTeach).some(r => r.id === 'tutor'));

// План: мама с 2 часами, с телефона, хочет сразу
const hoursQ = questions.find(q => q.id === 'hours'), compQ = questions.find(q => q.id === 'computer');
const mom = {...pick('S'), experience: ['none'], praise: ['listen'], hours: 0, learn: 0, computer: 0, english: 0, discipline: 1, format: 2, people: 1, calls: 2, detail: 0, routine: 0, persistence: 1};
const p = plan(mom);
assert.ok(p.quick.length >= 1, 'есть с чего начать');
assert.ok(p.quick.every(r => ['now', 'short'].includes(r.level)));
assert.ok(p.quick[0].low && p.quick[0].phone, 'первый вариант подходит под 2 часа и телефон: ' + p.quick[0].id);
assert.ok(p.marketing.role, 'маркетинговая версия есть всегда');
assert.ok(!p.quick.some(r => r.calls));

// Человек с дипломом бухгалтера
const acc = {...pick('C'), experience: ['finance']};
assert.ok(plan(acc).bridges.some(r => r.id === 'accountant'));

console.log('Career model v2: 26 questions in 3 stages, balanced RIASEC, ' + spheres.length + ' spheres, ' + roles.length + ' roles, filters and plan PASS');
