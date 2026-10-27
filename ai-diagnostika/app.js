(function () {
  'use strict';
  const M = window.AutomationModel;
  const app = document.getElementById('app');
  const KEY = 'prodigital-ai-diagnostika-v1';
  // Адрес функции персонального AI-разбора (Supabase Edge Function ai-advisor) задаётся
  // в index.html: window.AI_ADVISOR_URL. Пусто — AI-разбор скрыт, работает мгновенная диагностика.
  const AI_ENDPOINT = window.AI_ADVISOR_URL || '';
  const TELEGRAM = 'https://t.me/ka_anisimova';

  let state = load() || {answers: {}, pos: 0, ai: null};

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* хранилище недоступно */ } }
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.answers ? s : null; } catch (e) { return null; } }
  function reset() { state = {answers: {}, pos: 0, ai: null}; save(); }
  function focusTop() {
    const h = app.querySelector('h1,h2');
    if (h) { h.tabIndex = -1; h.focus({preventScroll: true}); }
    window.scrollTo(0, 0);
  }
  const answered = q => q.kind === 'multi' ? (state.answers[q.id] || []).length > 0 : state.answers[q.id] != null;
  const allDone = () => M.questions.every(answered);

  // ---------- Вступление ----------
  function intro() {
    const started = Object.keys(state.answers).length > 0;
    app.innerHTML = `<section class="intro">
      <div class="eyebrow">Диагностика для бизнеса · 2 минуты</div>
      <h1>Что в вашем бизнесе <em>стоит автоматизировать</em> в первую очередь?</h1>
      <p class="lead">Ответьте на 8 коротких вопросов о бизнесе и рутине команды. Сразу покажем 3 решения, которые освободят больше всего времени, и первый шаг для каждого.${AI_ENDPOINT ? ' А если опишете свою ситуацию словами — AI подготовит персональный разбор.' : ''}</p>
      <div class="actions">
        ${started ? `<button class="primary" id="resume">${allDone() ? 'Открыть мой результат' : 'Продолжить'}</button><button id="start">Начать заново</button>` : '<button class="primary" id="start">Пройти диагностику</button>'}
      </div>
      <h2>Как понять, что пора автоматизировать</h2>
      <div class="intro-cards criteria">
        <div class="card"><span class="card-kicker">Повторяется</span><p>Задача возникает каждую неделю и делается по похожему сценарию.</p></div>
        <div class="card"><span class="card-kicker">Отнимает время</span><p>На неё уходит больше 2–3 часов в неделю на человека.</p></div>
        <div class="card"><span class="card-kicker">Данные в цифре</span><p>Информация уже лежит в таблице, CRM, почте или мессенджере, а не только в голове.</p></div>
        <div class="card"><span class="card-kicker">Ошибка стоит денег</span><p>Потерянная заявка, опечатка в счёте или пропущенный срок бьют по выручке.</p></div>
      </div>
      <p class="note">Не стоит начинать с автоматизации того, что делается раз в месяц, каждый раз по-новому или ещё не отлажено руками: сначала процесс, потом робот.</p>
      <h2>Что обычно автоматизируют</h2>
      <ul class="examples">${M.solutions.slice(0, 8).map(s => `<li><strong>${esc(s.name)}</strong><span>${esc(s.does)}</span></li>`).join('')}</ul>
    </section>`;
    document.getElementById('start').onclick = () => { reset(); go(0); };
    const resume = document.getElementById('resume');
    if (resume) resume.onclick = () => {
      if (allDone()) return result();
      go(M.questions.findIndex(q => !answered(q)));
    };
  }

  // ---------- Вопрос ----------
  function go(pos) { state.pos = pos; save(); renderQuestion(); focusTop(); }

  function renderQuestion() {
    const q = M.questions[state.pos];
    const multi = q.kind === 'multi';
    const value = state.answers[q.id];
    const chosen = multi ? (value || []) : value;
    const total = M.questions.length;
    const options = q.options.map((o, i) => {
      const on = multi ? chosen.includes(o.value) : chosen === o.value;
      return `<button type="button" class="option${multi ? ' multi' : ''}" data-i="${i}" aria-pressed="${on}"><span class="mark" aria-hidden="true"></span><span>${esc(o.label)}</span></button>`;
    }).join('');
    app.innerHTML = `<section class="question" aria-labelledby="q-title">
      <div class="step-top"><span>Диагностика автоматизации</span><span>${state.pos + 1} из ${total}</span></div>
      <div class="progress" role="progressbar" aria-label="Прогресс" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${state.pos}"><span style="width:${Math.round(state.pos / total * 100)}%"></span></div>
      <h2 id="q-title">${esc(q.title)}</h2>
      ${q.hint ? `<p class="question-hint">${esc(q.hint)}</p>` : ''}
      <div class="options" role="group" aria-labelledby="q-title">${options}</div>
      <p class="status" id="status" role="status"></p>
      <div class="actions nav">
        <button type="button" id="back">← Назад</button>
        ${multi ? `<button type="button" class="primary" id="next">${state.pos === total - 1 ? 'Показать результат' : 'Дальше →'}</button>` : ''}
      </div>
    </section>`;
    app.querySelectorAll('.option').forEach(btn => btn.onclick = () => choose(q, Number(btn.dataset.i)));
    document.getElementById('back').onclick = () => (state.pos === 0 ? intro() : go(state.pos - 1));
    const next = document.getElementById('next');
    if (next) next.onclick = () => {
      if (!answered(q)) { document.getElementById('status').textContent = 'Выберите хотя бы один вариант.'; return; }
      advance();
    };
  }

  function choose(q, i) {
    const opt = q.options[i];
    if (q.kind === 'multi') {
      let list = (state.answers[q.id] || []).slice();
      if (list.includes(opt.value)) list = list.filter(v => v !== opt.value);
      else if (opt.exclusive) list = [opt.value];
      else {
        list = list.filter(v => !(q.options.find(o => o.value === v) || {}).exclusive);
        if (q.max && list.length >= q.max) {
          document.getElementById('status').textContent = `Можно выбрать не больше ${q.max}. Снимите один из вариантов.`;
          return;
        }
        list.push(opt.value);
      }
      state.answers[q.id] = list;
      state.ai = null;
      save();
      app.querySelectorAll('.option').forEach((b, k) => b.setAttribute('aria-pressed', String(list.includes(q.options[k].value))));
      document.getElementById('status').textContent = '';
      return;
    }
    state.answers[q.id] = opt.value;
    state.ai = null;
    save();
    app.querySelectorAll('.option').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    setTimeout(advance, 160);
  }

  function advance() {
    if (state.pos < M.questions.length - 1) return go(state.pos + 1);
    result();
  }

  // ---------- Результат ----------
  const complexityText = {1: 'Запуск за несколько дней', 2: 'Запуск за 1–3 недели', 3: 'Проект на месяц и больше'};
  const readinessText = {
    high: 'Высокая: данные уже в цифре и есть кому вести проект — можно начинать сразу.',
    mid: 'Средняя: начать можно, но часть данных придётся сначала собрать в таблицу или CRM.',
    low: 'Пока низкая: сначала стоит перенести данные из мессенджеров и головы в таблицу или CRM и назначить ответственного.'
  };

  function solutionCard(r, n) {
    const s = r.solution;
    return `<article class="card solution">
      <span class="card-kicker">${n === 0 ? 'Начать с этого' : `Решение ${n + 1}`}</span>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.does)}</p>
      <ul class="facts">
        <li>Освободит ≈ <strong>${Math.max(1, Math.round(r.saved * 4.3))} ч в месяц</strong> <span class="muted">(оценка)</span></li>
        <li>${esc(complexityText[s.complexity])}</li>
        ${r.needsData ? '<li>Сначала нужно собрать данные в таблицу или CRM</li>' : ''}
      </ul>
      <p class="first"><strong>Первый шаг:</strong> ${esc(s.first)}</p>
      ${s.proof ? `<p class="proof">Из практики: ${esc(s.proof)}</p>` : ''}
    </article>`;
  }

  function aiBlock() {
    if (!AI_ENDPOINT) return '';
    if (state.ai && state.ai.result) return aiResult(state.ai.result);
    return `<section class="card ai-form" id="ai">
      <span class="card-kicker">Персональный разбор от AI</span>
      <h2>Опишите свою ситуацию — получите разбор под ваш бизнес</h2>
      <p class="muted">Что за продукт, какая рутина отнимает больше всего времени, где сейчас теряются заявки или часы. Чем конкретнее, тем точнее разбор.</p>
      <label for="ai-text" class="sr">Опишите ситуацию</label>
      <textarea id="ai-text" rows="6" maxlength="3000" placeholder="Например: у нас студия ремонта, 4 менеджера. Каждый день приходит 20 заявок из Авито и сайта, менеджеры вручную считают сметы в Excel и отправляют их в WhatsApp, на одну смету уходит около часа...">${esc((state.ai && state.ai.text) || '')}</textarea>
      <label for="ai-contact" class="sr">Контакт для связи</label>
      <input id="ai-contact" type="text" maxlength="120" placeholder="Telegram или телефон — если хотите обсудить разбор (необязательно)" value="${esc((state.ai && state.ai.contact) || '')}">
      <div class="actions"><button class="primary" id="ai-go" type="button">Получить AI-разбор</button></div>
      <p class="status" id="ai-status" role="status"></p>
      <p class="small muted">Текст и ответы теста отправляются на наш сервер и в нейросеть Claude для подготовки разбора. Не указывайте персональные данные клиентов и пароли.</p>
    </section>`;
  }

  function list(items) { return `<ul>${(items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>`; }

  function aiResult(r) {
    return `<section class="card cream ai-result" id="ai">
      <span class="card-kicker">Персональный разбор от AI</span>
      <h2>${esc(r.headline || 'Ваш разбор')}</h2>
      <p>${esc(r.summary)}</p>
      ${(r.solutions || []).map((s, i) => `<div class="ai-solution">
        <h3>${i + 1}. ${esc(s.title)}</h3>
        <p>${esc(s.why)}</p>
        <h4>Как это будет работать</h4>${list(s.how)}
        <p class="small"><strong>Инструменты:</strong> ${esc((s.tools || []).join(', '))} · <strong>Сложность:</strong> ${esc(s.complexity)} · <strong>Экономия:</strong> ${esc(s.time_saved)}</p>
      </div>`).join('')}
      <h3>Что сделать на этой неделе</h3>${list(r.first_week)}
      ${(r.risks || []).length ? `<h3>На что обратить внимание</h3>${list(r.risks)}` : ''}
      ${(r.questions || []).length ? `<h3>Что уточним на созвоне</h3>${list(r.questions)}` : ''}
      <p class="small muted">Разбор подготовлен нейросетью по вашим ответам. Это предварительная оценка — точный план и стоимость дадим после короткого созвона.</p>
    </section>`;
  }

  function result() {
    const r = M.score(state.answers);
    const ready = r.ready;
    const body = r.tooEarly || !r.top.length
      ? `<div class="card"><h3>Похоже, автоматизировать пока рано</h3><p>Рутины немного: выгоднее сначала описать процессы и навести порядок в данных. Когда задач станет больше или вырастет поток заявок, автоматизация окупится быстрее. Если хотите, разберём вашу ситуацию на созвоне.</p></div>`
      : r.top.map(solutionCard).join('');
    app.innerHTML = `<section class="result">
      <div class="eyebrow">Результат диагностики</div>
      <h1>${r.top.length && !r.tooEarly ? `Можно освободить ≈ <em>${r.savedMonth} ч в месяц</em>` : 'Ваш результат'}</h1>
      <p class="lead">${r.top.length && !r.tooEarly ? `Это около ${r.savedWeek} ч в неделю из ${r.hours}, которые сейчас уходят на рутину. Начните с первого решения: оно даст самый быстрый эффект.` : ''}</p>
      <div class="chips">${r.tasks.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
      <div class="solutions">${body}</div>
      <div class="card readiness"><span class="card-kicker">Готовность к автоматизации</span><p>${esc(readinessText[ready.level])}</p></div>
      ${aiBlock()}
      <section class="card cta">
        <h2>Обсудим, с чего начать?</h2>
        <p>Разберём ваш процесс на бесплатном созвоне и предложим, что автоматизировать в первую очередь и сколько это будет стоить.</p>
        <div class="actions">
          <a class="button primary" href="${TELEGRAM}" target="_blank" rel="noopener">Написать в Telegram</a>
          <a class="button" href="../uslugi/ai-avtomatizacii-i-agenty/">Подробнее об услуге</a>
          <button type="button" id="again">Пройти заново</button>
        </div>
      </section>
      <p class="note">Часы — ориентировочная оценка: доля времени, которую обычно освобождает такое решение, умноженная на ваши ответы. Реальный эффект зависит от процессов и данных.</p>
    </section>`;
    document.getElementById('again').onclick = () => { reset(); intro(); focusTop(); };
    const goBtn = document.getElementById('ai-go');
    if (goBtn) goBtn.onclick = requestAi;
    focusTop();
  }

  async function requestAi() {
    const text = document.getElementById('ai-text').value.trim();
    const contact = document.getElementById('ai-contact').value.trim();
    const status = document.getElementById('ai-status');
    const btn = document.getElementById('ai-go');
    if (text.length < 40) { status.textContent = 'Опишите ситуацию чуть подробнее — хотя бы 2–3 предложения.'; return; }
    state.ai = {text, contact};
    save();
    btn.disabled = true;
    status.textContent = 'Готовим разбор — обычно это занимает до минуты…';
    try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({answers: M.describe(state.answers), instant: M.score(state.answers).top.map(t => t.solution.name), text, contact, page: location.pathname})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.result) throw new Error(data.error || 'Не удалось подготовить разбор');
      state.ai = {text, contact, result: data.result};
      save();
      const block = document.getElementById('ai');
      block.outerHTML = aiResult(data.result);
      document.getElementById('ai').scrollIntoView({behavior: 'smooth', block: 'start'});
    } catch (e) {
      btn.disabled = false;
      status.textContent = `${e.message}. Попробуйте ещё раз через минуту или напишите нам в Telegram.`;
    }
  }

  intro();
})();
