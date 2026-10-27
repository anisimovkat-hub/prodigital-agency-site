// Проверка модели диагностики: node ai-diagnostika/model.test.cjs
const assert = require('assert');
const M = require('./model.js');

const base = {biz: 'agency', team: 'small', leads: 'l2', hours: 'h3', data: ['sheets'], owner: 'me'};

// 1. Агентство с отчётами и КП: в топе отчёты и КП-агент, часы считаются.
let r = M.score({...base, tasks: ['reports', 'proposals', 'data_copy'], pains: ['overloaded']});
const ids = r.top.map(t => t.solution.id);
assert(ids.includes('reports_auto'), 'отчёты в топе');
assert(ids.includes('kp_agent'), 'КП-агент в топе');
assert(r.savedWeek > 0 && r.savedWeek <= r.hours * 0.6 + 0.5, 'экономия не больше 60% рутины');
assert(r.top.length <= 3);

// 2. Решения не дублируют одни и те же задачи.
const covered = r.top.flatMap(t => t.tasks);
assert.strictEqual(new Set(covered).size, covered.length, 'задачи в топе не повторяются');

// 3. Локальный бизнес, теряет заявки: бот или поток заявок первыми.
r = M.score({...base, biz: 'local', tasks: ['scheduling', 'answers_faq', 'lead_processing'], pains: ['lose_leads']});
assert(['lead_bot', 'lead_flow'].includes(r.top[0].solution.id), 'для локального бизнеса первым — заявки/бот');

// 4. Мало рутины — «рано автоматизировать».
r = M.score({...base, hours: 'h1', tasks: ['content'], pains: ['content']});
assert(r.tooEarly, 'мало рутины — рано');

// 5. Данные только в голове — отчёты требуют сначала собрать данные, готовность низкая.
r = M.score({...base, data: ['heads'], owner: 'none', tasks: ['reports'], pains: ['no_visibility']});
assert.strictEqual(r.ready.level, 'low');
assert(r.top[0].needsData, 'отчётам нужны данные в цифре');

// 6. Каждая задача покрыта хотя бы одним решением, у каждого решения есть первый шаг.
for (const t of M.tasks) assert(M.solutions.some(s => s.covers.includes(t.value)), `задача ${t.value} покрыта`);
for (const s of M.solutions) assert(s.first && s.does && s.name, `решение ${s.id} заполнено`);

// 7. describe переводит ответы в текст.
const d = M.describe({...base, tasks: ['reports'], pains: ['errors']});
assert(d.tasks.includes('отчёты') && d.biz.startsWith('Агентство'));
console.log('ok — 7 проверок пройдено');
