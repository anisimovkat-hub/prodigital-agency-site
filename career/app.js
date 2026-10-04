(function () {
  'use strict';
  const M = window.CareerModel;
  const {questions, stages, types, levels, sphereById} = M;
  const app = document.getElementById('app');
  const KEY = 'career-quiz-v2';
  const TELEGRAM = 'https://t.me/ka_anisimova';
  // Адрес сервера для сохранения ответов. Пока пусто — ответы хранятся только
  // в браузере человека. Если указать адрес, после каждого этапа туда уйдёт
  // анонимная запись {id, stage, answers, types, top, at} методом POST.
  const SYNC_URL = '';
  const FORECAST_FROM = 3;

  let state = load() || {answers: {}, pos: 0, snapshot: null};
  let view = 'intro';
  let prevOrder = null;
  let lastPrev = null;
  let forecastOpen = false;

  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const stageQuestions = n => questions.filter(q => q.stage === n);
  const firstIndexOf = n => questions.findIndex(q => q.stage === n);
  const answered = q => q.kind === 'multi' ? Array.isArray(state.answers[q.id]) && state.answers[q.id].length > 0 : typeof state.answers[q.id] === 'number';
  const stageDone = n => stageQuestions(n).every(answered);
  const typeName = letters => letters.map(k => types[k].name).join(' + ');

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* хранилище недоступно */ } }
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.answers ? s : null; } catch (e) { return null; } }
  function respondentId() {
    if (!state.id) { state.id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); save(); }
    return state.id;
  }
  function sync(stage, r) {
    if (!SYNC_URL) return;
    const body = JSON.stringify({id: respondentId(), stage, answers: state.answers, types: r.types, top: r.top.map(t => t.id), at: new Date().toISOString()});
    try { fetch(SYNC_URL, {method: 'POST', headers: {'Content-Type': 'application/json'}, body, keepalive: true}).catch(() => {}); } catch (e) { /* сеть недоступна */ }
  }
  function reset() { state = {answers: {}, pos: 0, snapshot: null}; prevOrder = null; lastPrev = null; save(); }

  function focusTop() {
    const h = app.querySelector('h1,h2');
    if (h) { h.tabIndex = -1; h.focus({preventScroll: true}); }
    window.scrollTo(0, 0);
  }

  // ---------- Вступление ----------
  function intro() {
    view = 'intro';
    const started = Object.keys(state.answers).length > 0;
    const resumeLabel = stageDone(3) ? 'Открыть мой план' : 'Продолжить с места остановки';
    app.innerHTML = `<section class="intro">
      <div class="eyebrow">Профориентация для удалённой работы</div>
      <h1>Какая удалённая работа <em>подойдёт именно вам?</em></h1>
      <p class="lead">Ответьте на простые вопросы из жизни и узнайте, какие профессии вам по характеру. Покажем, что можно начать уже сейчас, а чему стоит поучиться.</p>
      <div class="actions">
        ${started ? `<button class="primary" id="resume">${resumeLabel}</button><button id="start">Начать заново</button>` : '<button class="primary" id="start">Пройти тест</button>'}
      </div>
      <ol class="stage-list">
        ${stages.map(s => `<li><span class="stage-num">${s.n}</span><div><strong>${esc(s.name)}</strong><span>${stageQuestions(s.n).length} вопросов · ${esc(s.unlock)}</span></div></li>`).join('')}
      </ol>
      <p class="small muted">Первый результат через 2 минуты. Дальше — по желанию.</p>
      <div class="intro-cards">
        <div class="card"><span class="card-kicker">Нет опыта или давно не работали?</span><p>Профессиональный опыт не нужен. Вопросы о привычных ситуациях: семья, друзья, покупки.</p></div>
        <div class="card"><span class="card-kicker">Всего 2–3 часа в день?</span><p>Покажем варианты, где можно начать без обучения, и профессии, в которые можно вырасти.</p></div>
        <div class="card"><span class="card-kicker">Не хотите покупать курс наугад?</span><p>Для каждой сферы есть маленькое пробное задание, которое можно сделать бесплатно.</p></div>
      </div>
      <p class="note">Тест помогает выбрать направления для проверки. Он не измеряет способности, не ставит психологический диагноз и не гарантирует работу или доход.</p>
    </section>`;
    document.getElementById('start').onclick = () => { reset(); go(0); };
    const resume = document.getElementById('resume');
    if (resume) resume.onclick = () => {
      if (stageDone(3)) return showStage(3);
      const next = questions.findIndex(q => !answered(q));
      const n = questions[next].stage;
      if (next === firstIndexOf(n) && n > 1) return showStage(n - 1);
      go(next);
    };
  }

  // ---------- Вопрос ----------
  function go(pos) { state.pos = pos; save(); renderQuestion(); focusTop(); }

  function renderQuestion() {
    view = 'question';
    const q = questions[state.pos];
    const inStage = stageQuestions(q.stage);
    const k = inStage.indexOf(q);
    const stage = stages[q.stage - 1];
    const multi = q.kind === 'multi';
    const value = state.answers[q.id];
    const chosen = multi ? (value || []) : value;
    const options = q.options.map((o, i) => {
      const on = multi ? chosen.includes(o.value) : chosen === i;
      return `<button type="button" class="option${multi ? ' multi' : ''}" data-i="${i}" aria-pressed="${on}"><span class="mark" aria-hidden="true"></span><span>${esc(o.label)}</span></button>`;
    }).join('');
    const hint = q.hint || (q.kind === 'interest' ? 'Выберите самый близкий вариант. Если ничего не про вас — последний.' : '');
    app.innerHTML = `<div class="quiz">
      <section class="question" aria-labelledby="q-title">
        <div class="step-top"><span>Этап ${q.stage} из 3 · ${esc(stage.name)}</span><span>${k + 1} из ${inStage.length}</span></div>
        <div class="progress" role="progressbar" aria-label="Прогресс этапа" aria-valuemin="0" aria-valuemax="${inStage.length}" aria-valuenow="${k}"><span style="width:${Math.round(k / inStage.length * 100)}%"></span></div>
        <div id="forecast-slot"></div>
        <h2 id="q-title">${esc(q.title)}</h2>
        ${hint ? `<p class="question-hint">${esc(hint)}</p>` : ''}
        <div class="options" role="group" aria-labelledby="q-title">${options}</div>
        <p class="status" id="status" role="status"></p>
        <div class="actions nav">
          <button type="button" id="back">← Назад</button>
          ${multi ? `<button type="button" class="primary" id="next">${k === inStage.length - 1 ? 'Узнать результат' : 'Дальше →'}</button>` : ''}
        </div>
      </section>
      <aside class="forecast-side" id="forecast-side" aria-live="polite"></aside>
    </div>`;
    renderForecast(true);
    app.querySelectorAll('.option').forEach(btn => btn.onclick = () => choose(q, Number(btn.dataset.i), btn));
    document.getElementById('back').onclick = back;
    const next = document.getElementById('next');
    if (next) next.onclick = () => {
      if (!answered(q)) { document.getElementById('status').textContent = 'Выберите хотя бы один вариант.'; return; }
      advance();
    };
  }

  function choose(q, i, btn) {
    if (q.kind === 'multi') {
      const opt = q.options[i];
      let list = (state.answers[q.id] || []).slice();
      if (list.includes(opt.value)) list = list.filter(v => v !== opt.value);
      else if (opt.exclusive) list = [opt.value];
      else {
        list = list.filter(v => !(q.options.find(o => o.value === v) || {}).exclusive);
        if (list.length >= q.max) { document.getElementById('status').textContent = `Можно выбрать не больше ${q.max}. Снимите один из вариантов.`; return; }
        list.push(opt.value);
      }
      state.answers[q.id] = list;
      document.getElementById('status').textContent = '';
      app.querySelectorAll('.option').forEach((b, j) => b.setAttribute('aria-pressed', list.includes(q.options[j].value)));
      save();
      renderForecast();
      if (opt.exclusive && list.length) { app.querySelectorAll('.option').forEach(b => { b.disabled = true; }); setTimeout(advance, 260); }
      return;
    }
    state.answers[q.id] = i;
    save();
    app.querySelectorAll('.option').forEach(b => b.setAttribute('aria-pressed', b === btn));
    renderForecast();
    app.querySelectorAll('.option').forEach(b => { b.disabled = true; });
    setTimeout(advance, 260);
  }

  function advance() {
    const q = questions[state.pos];
    const last = stageQuestions(q.stage).slice(-1)[0] === q;
    if (last) return showStage(q.stage);
    go(state.pos + 1);
  }

  function back() {
    if (state.pos === 0) return intro(), focusTop();
    const q = questions[state.pos];
    if (state.pos === firstIndexOf(q.stage)) return showStage(q.stage - 1);
    go(state.pos - 1);
  }

  // ---------- Живой прогноз ----------
  function forecastHtml(r, compact, prev) {
    if (r.count < FORECAST_FROM) {
      const left = FORECAST_FROM - r.count;
      return `<div class="forecast waiting"><div class="fc-head"><strong>Ваш прогноз</strong></div><p>Появится через ${left} ${left === 1 ? 'ответ' : 'ответа'}.</p></div>`;
    }
    const scores = r.ranked.map(x => x.score);
    const max = Math.max(...scores), min = Math.min(...scores);
    const open = forecastOpen || !compact;
    const rows = r.ranked.slice(0, open ? 5 : 3).map((x, i) => {
      const w = max > min ? 18 + 78 * (x.score - min) / (max - min) : 50;
      const up = prev && prev.indexOf(x.id) > i ? '<span class="up" title="поднялась">↑</span>' : '';
      return `<li><span class="fc-name">${esc(sphereById[x.id].name)}${up}</span><span class="fc-bar"><span style="width:${Math.round(w)}%"></span></span></li>`;
    }).join('');
    const head = compact
      ? `<button type="button" class="fc-head" aria-expanded="${forecastOpen}"><strong>Ваш прогноз</strong><span class="fc-more">${forecastOpen ? 'свернуть ▴' : 'подробнее ▾'}</span></button>`
      : '<div class="fc-head"><strong>Ваш прогноз</strong></div>';
    const typeLine = open ? `<p class="fc-type">${r.types.length ? `Похоже, вы <strong>${esc(typeName(r.types))}</strong>. ` : ''}Прогноз меняется с каждым ответом.</p>` : '';
    return `<div class="forecast">${head}<ol class="fc-list">${rows}</ol>${typeLine}</div>`;
  }

  function renderForecast(keepArrows) {
    const slot = document.getElementById('forecast-slot');
    const side = document.getElementById('forecast-side');
    if (!slot || !side) return;
    const r = M.evaluate(state.answers);
    const prev = keepArrows ? lastPrev : prevOrder;
    slot.innerHTML = forecastHtml(r, true, prev);
    side.innerHTML = forecastHtml(r, false, prev);
    const t = slot.querySelector('button.fc-head');
    if (t) t.onclick = () => { forecastOpen = !forecastOpen; renderForecast(true); };
    if (!keepArrows && r.count >= FORECAST_FROM) { lastPrev = prevOrder; prevOrder = r.ranked.map(x => x.id); }
  }

  // ---------- Результаты этапов ----------
  const searchQuery = r => '«' + r.q.charAt(0).toLowerCase() + r.q.slice(1) + ' удалённо»';

  function typeLine(r) {
    if (!r.types.length) return 'Ваши интересы пока не выделились, поэтому мы опирались на опыт и рабочий ритм.';
    return `Ваш тип — ${typeName(r.types)}. Вы ${types[r.types[0]].about}, а ещё ${types[r.types[1]].about}.`;
  }

  function whyShort(item, r) {
    const s = sphereById[item.id];
    const parts = [];
    const strong = r.types.filter(k => s.ria[k] >= .55).map(k => types[k].name.toLowerCase());
    if (strong.length) parts.push(`подходит типу «${strong.join('» и «')}»`);
    if (item.jobHit) parts.push('пригодится прошлый опыт');
    if (item.praiseHits) parts.push('совпадает с тем, за что вас хвалят');
    if (item.style !== null && item.style >= .75) parts.push('подходит ваш рабочий ритм');
    const text = parts.length ? parts.join(', ') : 'ближе к вашим ответам, чем большинство сфер';
    return text[0].toUpperCase() + text.slice(1) + '.';
  }

  function summary(r, top, title) {
    const best = top[0].score || 1;
    return `<div class="card summary">
      <h2>${esc(title)}</h2>
      <ol class="sum-list">${top.map((t, i) => `<li>
        <span class="sum-n">${i + 1}</span>
        <div class="sum-body">
          <a class="sum-name" href="#s-${t.id}">${esc(sphereById[t.id].name)}</a>${t.change ? ' <span class="pill pill-new">новое</span>' : ''}
          <span class="sum-bar" aria-hidden="true"><span style="width:${Math.round(Math.max(.25, t.score / best) * 100)}%"></span></span>
          <span class="sum-why">${esc(whyShort(t, r))}</span>
        </div></li>`).join('')}</ol>
    </div>`;
  }

  function roleDetails(r) {
    const flags = (r.notes || []).length ? `<span class="flag">${esc(r.notes.join('; '))}</span>` : '';
    return `<details class="role"><summary>${esc(r.name)}</summary>
      <p>${esc(r.what)}</p>
      <p class="learn">Как начать: ${esc(r.learn)}</p>
      <p class="learn">Запрос для поиска вакансий: ${esc(searchQuery(r))}</p>${flags}
    </details>`;
  }

  function ladder(sphereId, detailed) {
    const list = M.rolesFor(sphereId, state.answers);
    const groups = ['now', 'short', 'base', 'course', 'long'].map(lv => [lv, list.filter(r => r.level === lv)]).filter(([, l]) => l.length);
    return `<div class="ladder">${groups.map(([lv, l]) => {
      const later = l.every(x => x.later) ? ' <span class="later">на будущее</span>' : '';
      const head = `<span aria-hidden="true">${levels[lv].icon}</span> <strong>${esc(levels[lv].short)}</strong>${later}`;
      return detailed
        ? `<div class="rung"><div class="rung-head">${head}</div>${l.map(roleDetails).join('')}</div>`
        : `<p class="rung-line">${head}: ${l.map(x => esc(x.name)).join(', ')}</p>`;
    }).join('')}</div>`;
  }

  function sphereCard(item, mode) {
    const s = sphereById[item.id];
    return `<article class="card sphere-card" id="s-${s.id}">
      <div class="sphere-top">${item.change ? '<span class="pill pill-new">новое</span>' : ''}${s.mk ? '<span class="pill">маркетинг</span>' : ''}</div>
      <h3>${esc(s.name)}</h3>
      <p class="essence">${esc(s.essence)}</p>
      ${ladder(item.id, mode !== 'preview')}
      ${mode === 'full' ? `<details class="try"><summary>Попробовать бесплатно до покупки курса</summary><p>${esc(s.try)}</p><p class="learn">Что поискать на YouTube: «${esc(s.youtube)}»</p><p class="learn">Важно знать заранее: ${esc(s.reality)}</p></details>` : ''}
    </article>`;
  }

  function marketingBlock(r) {
    const role = M.roleById[M.marketingByType[r.types[0] || 'E']];
    return `<div class="card mk-card">
      <span class="card-kicker">Маркетинговая версия вашего типа</span>
      <h3>${esc(role.name)}</h3>
      <p>${esc(role.what)}</p>
      <p class="learn">Как начать: ${esc(role.learn)}</p>
    </div>`;
  }

  function continueCard(n, where) {
    const next = stages[n];
    const count = stageQuestions(next.n).length;
    if (where === 'top') return `<div class="card next-banner">
      <p>Ответьте ещё на ${count} вопросов, чтобы получить более точный прогноз, или посмотрите предварительные результаты ниже.</p>
      <button class="primary continue">Продолжить тестирование →</button>
    </div>`;
    return `<div class="card unlock">
      <span class="card-kicker">Этап ${next.n} из 3 · ещё ${count} вопросов, около 2 минут</span>
      <h3>${esc(next.name)}</h3>
      <p>${n === 1 ? 'Уточним, какие профессии внутри этих сфер подходят вам по характеру, а какие лучше не рассматривать.' : 'Учтём ваше время, готовность учиться, компьютер и английский. Соберём план: что начать сейчас, во что вырасти и как искать работу.'}</p>
      <button class="primary continue">Продолжить тестирование →</button>
    </div>`;
  }

  function withChanges(r) {
    const before = state.snapshot || [];
    return r.top.map(t => ({...t, change: before.length && !before.includes(t.id) ? 'новое' : ''}));
  }

  function showStage(n) {
    if (n === 3) return showPlan();
    view = 'stage';
    const r = M.evaluate(state.answers);
    const top = n === 2 ? withChanges(r) : r.top;
    if (n === 1) { state.snapshot = r.top.map(t => t.id); save(); }
    sync(n, r);
    app.innerHTML = `<section class="results">
      ${continueCard(n, 'top')}
      <div class="eyebrow">Этап ${n} из 3 пройден${n === 2 ? ' · прогноз уточнён' : ''}</div>
      <h1>Предварительные результаты тестирования</h1>
      <p class="lead">${esc(typeLine(r))}</p>
      ${n === 2 && r.styleAnswers.calls === 0 ? '<p class="profile-line">Вы сказали, что звонить незнакомым людям некомфортно, поэтому профессии со звонками мы убрали.</p>' : ''}
      ${summary(r, top, 'Вам больше всего подходят')}
      <h2 class="section-title">Подробнее о каждой сфере</h2>
      <p class="small muted">${n === 1 ? 'Ступени показывают, с чего можно начать без обучения и во что вырасти.' : 'Нажмите на профессию, чтобы узнать, что в ней делают и как начать.'}</p>
      <div class="sphere-grid">${top.map(t => sphereCard(t, n === 1 ? 'preview' : 'roles')).join('')}</div>
      ${r.top.some(t => sphereById[t.id].mk) ? '' : marketingBlock(r)}
      ${continueCard(n, 'bottom')}
      <div class="actions"><button id="edit">← Изменить ответы</button><button id="stop">Начать заново</button></div>
    </section>`;
    app.querySelectorAll('.continue').forEach(b => b.onclick = () => {
      const next = questions.findIndex(q => q.stage === n + 1 && !answered(q));
      go(next >= 0 ? next : firstIndexOf(n + 1));
    });
    document.getElementById('edit').onclick = () => go(firstIndexOf(n));
    document.getElementById('stop').onclick = () => { reset(); intro(); focusTop(); };
    focusTop();
  }

  function howToSearch() {
    const format = M.answerValue(state.answers, 'format');
    const discipline = M.answerValue(state.answers, 'discipline');
    const team = '<li><strong>Работа в команде.</strong> Ищите на сайтах вакансий с фильтром «удалённая работа», в Telegram-каналах и чатах с удалёнными вакансиями. К названию профессии добавляйте слова «удалённо», «без опыта», «стажёр», «помощник».</li>';
    const free = '<li><strong>Свои клиенты.</strong> Начните со знакомых предпринимателей и рекомендаций, потом — биржи фриланса и профильные чаты. Сначала берите небольшую задачу за фиксированную цену.</li>';
    let items = format === 'team' ? team : format === 'freelance' ? free : team + free;
    if (discipline === 'low' && format !== 'team') items += '<li>Вы честно сказали, что без внешних сроков будете откладывать. Для старта надёжнее работа в команде с понятным графиком.</li>';
    return `<ul class="search-list">${items}</ul>`;
  }

  function roleCard(r) {
    return `<li class="role-card">
      <span class="lvl">${levels[r.level].icon} ${esc(levels[r.level].name)}</span>
      <strong>${esc(r.name)}</strong>
      <span>${esc(r.what)}</span>
      <span class="learn">Как начать: ${esc(r.learn)}</span>
      <span class="learn">Запрос для поиска: ${esc(searchQuery(r))}</span>
      ${(r.notes || []).length ? `<span class="flag">${esc(r.notes.join('; '))}</span>` : ''}
    </li>`;
  }

  function showPlan() {
    view = 'plan';
    const p = M.plan(state.answers);
    const r = p.result;
    const top = withChanges(r);
    sync(3, r);
    const hours = M.answerValue(state.answers, 'hours');
    const learn = M.answerValue(state.answers, 'learn');
    const computer = M.answerValue(state.answers, 'computer');
    const situation = M.answerValue(state.answers, 'situation');
    const learnText = {now: 'хотите начать сразу', short: 'учиться до месяца', course: 'учиться 1–5 месяцев', long: 'готовы к долгому обучению'}[learn];
    const hoursText = {low: '2–3 часа в день', mid: '3–5 часов в день', full: 'полный день'}[hours];
    const bridges = p.bridges.filter(b => !p.quick.some(q => q.id === b.id) && !p.growth.some(g => g.id === b.id));
    const lead = {
      fresh: 'Опыт не нужен: начните с того, что можно делать сразу, а параллельно присмотритесь к профессии на вырост.',
      diploma: 'Ваш диплом и прежний опыт — преимущество. Сначала посмотрите, как применить их удалённо.',
      switch: 'Вы меняете сферу, и прошлый опыт ускорит переход.',
      online: 'У вас уже есть опыт онлайн-работы, поэтому начинаем с профессий, в которые стоит вырасти.'
    }[situation] || '';
    const quickHtml = `<div class="card cream plan-card"><h2>Начать сейчас</h2><p class="small">Без дорогого обучения: первые деньги и понимание, нравится ли сфера.</p>
      <ul class="role-cards">${p.quick.map(roleCard).join('') || '<li>По вашим условиям быстрых вариантов нет — посмотрите профессии на вырост.</li>'}</ul></div>`;
    const growthHtml = p.growth.length ? `<div class="card plan-card"><h2>Профессия на вырост</h2><p class="small">${learn === 'now' || learn === 'short' ? 'Можно учиться параллельно с простой работой: доход здесь выше.' : 'Вы готовы учиться, поэтому можно сразу целиться в профессию.'}</p>
      <ul class="role-cards">${p.growth.map(roleCard).join('')}</ul></div>` : '';
    const bridgeHtml = bridges.length ? `<div class="card plan-card"><h2>${situation === 'diploma' ? 'Ваша профессия → удалённо' : 'Ваш опыт → удалённо'}</h2><p class="small">Опираются на то, чем вы уже занимались, поэтому войти обычно быстрее.</p>
      <ul class="role-cards">${bridges.slice(0, 3).map(roleCard).join('')}</ul></div>` : '';
    const order = situation === 'online' ? [growthHtml, quickHtml, bridgeHtml]
      : situation === 'diploma' || situation === 'switch' ? [bridgeHtml, quickHtml, growthHtml]
      : [quickHtml, growthHtml, bridgeHtml];
    app.innerHTML = `<section class="results">
      <div class="eyebrow">Тест пройден</div>
      <h1>Ваши результаты и план</h1>
      <p class="lead">${esc(typeLine(r))} ${esc(lead)}</p>
      <div class="chips"><span class="chip">${esc(hoursText)}</span><span class="chip">${esc(learnText)}</span>${computer === 'phone' ? '<span class="chip">начинаем с телефона</span>' : ''}</div>
      ${summary(r, top, 'Вам больше всего подходят')}
      ${order.join('')}
      ${[...p.quick, ...p.growth, ...bridges.slice(0, 3)].some(x => x.id === M.marketingByType[r.types[0] || 'E']) ? '' : marketingBlock(r)}
      <div class="card plan-card"><h2>Как искать работу</h2>${howToSearch()}
        <ol class="steps"><li>Выберите 1–2 профессии из плана.</li><li>Сделайте бесплатное пробное задание (оно в карточке сферы ниже).</li><li>Найдите по запросу 5 свежих вакансий и выпишите, что в них повторяется.</li><li>Если задача понравилась — учитесь тому, чего не хватает по вакансиям.</li></ol>
      </div>
      <h2 class="section-title">Подробнее о каждой сфере</h2>
      <div class="sphere-grid">${top.map(t => sphereCard(t, 'full')).join('')}</div>
      <div class="card consult"><h3>Хотите разобрать результат?</h3><p>Напишите Катерине в Telegram, какие профессии вам выпали, и задайте вопросы.</p><a class="button primary" href="${TELEGRAM}" target="_blank" rel="noopener noreferrer">Написать в Telegram</a></div>
      <details class="method"><summary>На чём основан тест?</summary>
        <p>Вопросы об интересах построены на модели Холланда (RIASEC) — шесть типов интересов, на которых основан официальный O*NET Interest Profiler Министерства труда США. Вы выбирали один вариант из нескольких, и каждый тип предлагался одинаковое число раз. Профили большинства сфер сравниваются с данными о похожих профессиях из базы O*NET 31.0 (лицензия CC BY 4.0), остальные оценены автором. Учитываются также рабочий ритм, прошлый опыт и то, за что вас хвалят.</p>
        <p>Русские вопросы, веса и подбор профессий составлены для этого сайта и не проходили психометрическую проверку. Это ориентир для первой пробы, а не официальный тест.</p>
      </details>
      <p class="note">Не каждая профессия доступна удалённо в любой компании. Проверяйте условия каждой вакансии. Результат не гарантирует трудоустройство или доход.</p>
      <div class="actions"><button id="edit">← Изменить ответы</button><button id="print">Сохранить или распечатать</button><button id="restart">Пройти заново</button></div>
    </section>`;
    document.getElementById('edit').onclick = () => go(firstIndexOf(3));
    document.getElementById('print').onclick = () => window.print();
    document.getElementById('restart').onclick = () => { reset(); intro(); focusTop(); };
    focusTop();
  }

  intro();
})();
