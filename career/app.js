(function () {
  'use strict';
  const { tracks, questions, evaluate } = window.CareerModel;
  const app = document.getElementById('app');
  const answers = Array(questions.length).fill(null);
  let step = -1;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const list = items => '<ul>' + items.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul>';
  const roleSearch = role => 'https://hh.ru/search/vacancy?text=' + encodeURIComponent(role + ' удаленно');
  function focusHeading() {
    const heading = app.querySelector('h1,h2');
    if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
    window.scrollTo({top:0,behavior:'instant'});
  }
  function intro() {
    step = -1;
    app.innerHTML = `
      <div class="eyebrow">Ориентир по удалённым профессиям</div>
      <h1>Какая удалённая работа <em>может быть вам интересна?</em></h1>
      <p class="lead">Ответьте, какие повседневные задачи вам хотелось бы делать. В результате вы увидите возможные сферы и профессии, что стоит изучить и как проверить выбор на практике.</p>
      <div class="chips"><span class="chip">19 коротких вопросов</span><span class="chip">В своём темпе</span><span class="chip">Без регистрации</span></div>
      <div class="actions"><button class="primary" id="start">Подобрать направления →</button></div>
      <div class="overview">
        <div class="card"><h3>Если вы пока ничего не умеете</h3><p>Оцените интерес к самой работе, а не свой текущий опыт. У каждой сферы есть навыки, которые можно освоить.</p></div>
        <div class="card cream"><h3>Что будет в результате</h3><p>Профессии и реальные задачи, темы для изучения, маленькая проба и способ посмотреть требования в вакансиях.</p></div>
      </div>
      <p class="note">Это ориентир для выбора, а не тест способностей или гарантия трудоустройства. Мы показываем гипотезы по вашим ответам; окончательный выбор стоит проверить задачами и реальными вакансиями.</p>`;
    document.getElementById('start').onclick = () => { step = 0; renderQuestion(); focusHeading(); };
  }
  function renderQuestion() {
    const q = questions[step];
    app.innerHTML = `<section class="question">
      <div class="step-top"><span>Вопрос ${step + 1} из ${questions.length}</span><span>${q.kind === 'interest' ? 'Интерес к задачам' : 'Условия работы'}</span></div>
      <progress value="${step}" max="${questions.length}" aria-label="Прогресс опроса"></progress>
      <h2 id="question-title">${escape(q.title)}</h2><p class="lead" id="question-detail">${escape(q.detail)}</p>
      <fieldset aria-labelledby="question-title" aria-describedby="question-detail">
        <div class="options">${q.options.map((option, i) => `<label class="option"><input type="radio" name="answer" value="${i}" ${answers[step] === i ? 'checked' : ''}><span>${escape(option)}</span></label>`).join('')}</div>
      </fieldset>
      <div class="actions"><button id="back">← Назад</button><button class="primary" id="next" ${answers[step] === null ? 'disabled' : ''}>${step === questions.length - 1 ? 'Увидеть подсказки' : 'Дальше →'}</button></div>
      <p class="small muted">Можно ответить «Пока не знаю». Ответы хранятся только в этой вкладке.</p>
    </section>`;
    app.querySelectorAll('input[name="answer"]').forEach(input => {
      input.onchange = () => { answers[step] = Number(input.value); document.getElementById('next').disabled = false; };
    });
    document.getElementById('back').onclick = () => { if (step === 0) intro(); else { step--; renderQuestion(); } focusHeading(); };
    document.getElementById('next').onclick = () => {
      if (answers[step] === null) return;
      if (step < questions.length - 1) { step++; renderQuestion(); }
      else renderResult(evaluate(answers));
      focusHeading();
    };
  }
  function caveat(track, result) {
    if (result.communication === 0 && ['operations','clients'].includes(track.id))
      return '<p class="fit-note">Вы предпочли переписку и самостоятельную работу. В этой сфере проверьте, сколько звонков и встреч требует конкретная вакансия.</p>';
    if (result.format === 1 && ['operations','clients','tech'].includes(track.id))
      return '<p class="fit-note">Вы ищете отдельные проекты. В этой сфере часть ролей чаще встречается внутри команды: проверьте формат вакансий до долгого обучения.</p>';
    return '';
  }
  function trackCard(index, result, compact = false) {
    const track = tracks[index], reasons = result.reasons[index];
    const evidence = reasons.length
      ? '<p class="small muted"><strong>Что в ваших ответах указывает сюда:</strong> ' + escape(reasons.slice(0, 2).join(' ')) + '</p>'
      : '<p class="small muted">По этим задачам пока мало уверенных ответов. Используйте список как вариант для сравнения.</p>';
    return `<article class="card career-card" id="sphere-${track.id}">
      <div class="tag">Сфера удалённой работы</div><h3>${escape(track.sphere)}</h3><p>${escape(track.essence)}</p>${compact ? '' : evidence}
      <h4>Какие профессии посмотреть</h4>
      <ul class="roles">${track.roles.map(role => `<li><strong>${escape(role[0])}</strong><br><span>${escape(role[1])}</span></li>`).join('')}</ul>
      <h4>Что изучать сначала</h4>${list(track.study)}
      <h4>О чём почитать подробнее</h4>${list(track.read)}
      <h4>Как проверить интерес</h4><p>${escape(track.try)}</p>
      <p class="small muted"><strong>Что в работе может быть непросто:</strong> ${escape(track.reality)}</p>
      ${caveat(track, result)}
      <a class="vacancy-link" href="${roleSearch(track.roles[0][0])}" target="_blank" rel="noopener noreferrer">Посмотреть вакансии по первой роли ↗</a>
    </article>`;
  }
  function startHint(result) {
    if (result.experience === 0) return 'Начните с описаний профессий и одной учебной задачи. Не нужно выбирать курс до того, как вы поймёте реальные обязанности.';
    if (result.experience === 1) return 'Выпишите навыки из прежней работы, которые можно перенести: общение, тексты, таблицы, организация или работа с инструментами. Сверьте их с требованиями вакансий.';
    if (result.experience === 2) return 'Сравните уже выполненные задачи с выбранными ролями. Найдите пробелы в навыках по нескольким вакансиям, а не по одной.';
    return 'Сначала посмотрите описания двух профессий и попробуйте по одной маленькой задаче из каждой. Так легче понять, какой опыт у вас уже есть.';
  }
  function resultIntro(result) {
    if (result.uncertain) return {title:'Пока рано выбирать одну сферу', lead:'Ответы не выделили достаточно ясные направления. Это нормально, если вы только знакомитесь с удалённой работой. Ниже можно сравнить восемь сфер и попробовать короткие задачи без выбора профессии навсегда.'};
    return {title: result.primary.length === 1 ? 'Сфера для первого знакомства' : 'Сферы для первого знакомства',
      lead: 'По вашим ответам стоит подробнее рассмотреть: ' + result.primary.map(i => tracks[i].sphere.toLowerCase()).join(', ') + '. Это подсказка об интересе к задачам, а не оценка способности или прогноз трудоустройства.'};
  }
  function renderResult(result) {
    const introText = resultIntro(result);
    const visible = result.uncertain ? [] : result.primary;
    const other = tracks.map((_, i) => i).filter(i => !visible.includes(i));
    app.innerHTML = `<div class="eyebrow">Ваш ориентир</div>
      <h1 class="results-title">${introText.title}</h1><p class="lead">${introText.lead}</p>
      <div class="card cream next-steps"><h3>Что сделать дальше</h3>
        <ol><li>Прочитайте о повседневных задачах двух профессий из результата.</li>
        <li>Откройте несколько свежих вакансий и выпишите обязанности, навыки и формат работы. Слово «удалённо» в поиске само по себе не гарантирует такой формат: проверьте каждое объявление.</li>
        <li>Попробуйте маленькое задание ниже. Отметьте, хочется ли разбираться и повторять такую работу.</li></ol>
        <p>${escape(startHint(result))}</p></div>
      ${visible.length ? `<div class="career-grid">${visible.map(i => trackCard(i, result)).join('')}</div>` : ''}
      <details class="other-spheres" ${result.uncertain ? 'open' : ''}><summary>${result.uncertain ? 'Сравнить сферы и профессии' : 'Посмотреть другие сферы'}</summary><div class="career-grid">${other.map(i => trackCard(i, result, true)).join('')}</div></details>
      <details><summary>Как получились подсказки</summary><p>Для каждой сферы мы спросили о двух типичных занятиях. Ответы «совсем не интересно» — «очень интересно» дают от 0 до 4 баллов за занятие. «Пока не знаю» не засчитывается. Показываем до трёх сфер, если оба занятия получили ответы и их сумма — не меньше 5 из 8. Если интерес распределён слишком широко или данных мало, предлагаем сравнить сферы без назначения победителя.</p><p>Вопросы об общении, формате работы и опыте меняют пояснения к следующему шагу, но не баллы. Эти баллы не показывают процент пригодности и не являются психологической диагностикой.</p></details>
      <p class="note">Здесь представлены распространённые направления, но не все удалённые профессии. Названия ролей и требования различаются по компаниям. Проверьте выбранную гипотезу по реальным вакансиям и задачам до решения об обучении.</p>
      <div class="actions"><button id="edit">Изменить ответы</button><button id="restart">Пройти заново</button><button id="print">Сохранить или распечатать</button></div>`;
    document.getElementById('edit').onclick = () => { step = 0; renderQuestion(); focusHeading(); };
    document.getElementById('restart').onclick = () => { answers.fill(null); intro(); focusHeading(); };
    document.getElementById('print').onclick = () => window.print();
  }
  intro();
})();
