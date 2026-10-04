(function(){
  'use strict';
  const {tracks,questions,evaluate,labels}=window.CareerModel;
  const paths=window.CareerPaths;
  const app=document.getElementById('app');
  const answers=Array(questions.length).fill(null);
  let step=-1;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const list=items=>'<ul>'+items.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul>';
  const url=(base,query)=>base+encodeURIComponent(query);
  const hh=role=>url('https://hh.ru/search/vacancy?work_format=REMOTE&text=',role);
  const youtube=query=>url('https://www.youtube.com/results?search_query=',query);
  function focusHeading(){const h=app.querySelector('h1,h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}window.scrollTo(0,0)}
  function intro(){
    step=-1;
    app.innerHTML=`<div class="eyebrow">Профориентация для удалённой работы</div>
      <h1>Какая удаленная работа <em>подойдет именно вам?</em></h1>
      <p class="lead">Пройдите тест и узнайте, какие сферы и профессии стоит попробовать. Получите план: что изучить, как проверить интерес к работе до покупки обучения и где искать первые вакансии или проекты.</p>
      <div class="chips"><span class="chip">${questions.length} вопросов</span><span class="chip">4 минуты</span><span class="chip">Готовый план действий</span></div>
      <div class="actions"><button class="primary" id="start">Пройти тест</button></div>
      <div class="overview proof-grid">
        <div class="card"><span class="card-kicker">Нет опыта?</span><h3>Начните с того, что вам уже близко</h3><p>Не нужно заранее знать названия профессий или уметь работать онлайн. Вопросы помогают увидеть ваши интересы, привычный способ работы и навыки, которые можно перенести из другой сферы.</p></div>
        <div class="card cream"><span class="card-kicker">Не хотите купить обучение наугад?</span><h3>Сначала попробуйте работу в деле</h3><p>После теста получите список профессий и маленькое задание по каждому направлению. Узнаете, что изучить, что искать на YouTube и как проверить требования в вакансиях до выбора курса.</p></div>
      </div>
      <p class="note">Тест помогает выбрать направления для проверки. Он не измеряет способности, не ставит психологический диагноз и не гарантирует работу или доход.</p>`;
    document.getElementById('start').onclick=()=>{step=0;renderQuestion();focusHeading()};
  }
  function stage(q){return q.kind==='interest'?'Что вам ближе':q.kind==='style'?'Ваш рабочий ритм':'Опыт и следующий шаг'}
  function renderQuestion(){
    const q=questions[step],multi=q.kind==='skills';
    const checked=multi?(answers[step]||[]):answers[step];
    const options=q.options.map((label,i)=>`<label class="option"><input type="${multi?'checkbox':'radio'}" name="answer" value="${multi?esc(q.values[i]):i}" ${multi?(checked.includes(q.values[i])?'checked':''):(checked===i?'checked':'')}><span>${esc(label)}</span></label>`).join('');
    app.innerHTML=`<section class="question"><div class="step-top"><span>Вопрос ${step+1} из ${questions.length}</span><span>${stage(q)}</span></div>
      <progress value="${step}" max="${questions.length}" aria-label="Прогресс теста"></progress>
      <h2 id="question-title">${esc(q.title)}</h2>
      ${multi?'<p class="question-hint" id="question-hint">Выберите один или несколько вариантов.</p>':'<p class="question-hint" id="question-hint">Выбирайте по тому, как вам ближе действовать сейчас. Профессиональный опыт не нужен.</p>'}
      <fieldset aria-labelledby="question-title" aria-describedby="question-hint"><div class="options">${options}</div></fieldset>
      <div class="actions"><button id="back">← Назад</button><button class="primary" id="next" ${(multi?!checked.length:checked===null)?'disabled':''}>${step===questions.length-1?'Узнать результат':'Дальше →'}</button></div>
      <p class="small muted">Можно вернуться и изменить ответ. Данные остаются только в этой вкладке.</p></section>`;
    app.querySelectorAll('input[name="answer"]').forEach(input=>input.onchange=()=>{
      if(multi){
        const chosen=[...app.querySelectorAll('input[name="answer"]:checked')].map(el=>el.value);
        if(input.value==='none'&&input.checked)app.querySelectorAll('input[name="answer"]').forEach(el=>{if(el.value!=='none')el.checked=false});
        else if(input.value!=='none'&&input.checked){const none=app.querySelector('input[value="none"]');if(none)none.checked=false}
        answers[step]=[...app.querySelectorAll('input[name="answer"]:checked')].map(el=>el.value);
      }else answers[step]=Number(input.value);
      document.getElementById('next').disabled=multi?!answers[step].length:answers[step]===null;
    });
    document.getElementById('back').onclick=()=>{if(step===0)intro();else{step--;renderQuestion()}focusHeading()};
    document.getElementById('next').onclick=()=>{if(answers[step]===null||(multi&&!answers[step].length))return;if(step<questions.length-1){step++;renderQuestion()}else renderResult(evaluate(answers));focusHeading()};
  }
  function skillHint(result,track){
    const overlap=(window.CareerModel.profiles[track.id].skills||[]).filter(key=>result.skills.includes(key));
    if(!result.skills.length)return 'Отсутствие опыта не исключает эту сферу: начните с учебной пробы и проверьте, хотите ли повторять такие задачи.';
    if(overlap.length)return 'Из вашего опыта может пригодиться: '+overlap.map(key=>({text:'тексты',visual:'визуальные материалы',numbers:'таблицы и расчёты',people:'общение с людьми',organization:'организация задач',web:'сайты или код',languages:'иностранный язык'})[key]).join(', ')+'.';
    return 'Прямого опыта в этой сфере вы пока не отметили. Это повод начать с маленькой учебной задачи, а не исключать направление.';
  }
  function pathCard(item,result){
    const track=tracks[item.index],path=paths[track.id];
    const reasons=item.reasons.length?'Ваш интерес к '+item.reasons.join(' и ')+' совпал с частью задач этой сферы.':'В ваших ответах заметен интерес к задачам этой сферы; проверьте его на практике.';
    return `<article class="card career-card" id="sphere-${track.id}"><div class="tag">Направление для проверки</div><h3>${esc(track.sphere)}</h3><p>${esc(track.essence)}</p>
      <p class="fit-note">${esc(reasons)} ${esc(skillHint(result,track))}</p>
      <h4>Какие профессии посмотреть</h4><ul class="roles">${track.roles.map(role=>`<li><strong>${esc(role[0])}</strong><br><span>${esc(role[1])}</span></li>`).join('')}</ul>
      <div class="result-section"><h4>1. Погрузитесь в сферу до покупки курса</h4><p>На YouTube ищите: <a href="${youtube(path.youtube)}" target="_blank" rel="noopener noreferrer">«${esc(path.youtube)}» ↗</a></p><p class="small muted">Поиск показывает разные видео; оцените автора и дату материала самостоятельно.</p><p><strong>Что почитать:</strong></p>${list(track.read)}<p><strong>Что изучить сначала:</strong></p>${list(track.study)}</div>
      <div class="result-section"><h4>2. Попробуйте работу на маленькой задаче</h4><p>${esc(track.try)}</p><p><strong>Что сохранить как учебный пример:</strong> ${esc(path.portfolio)}</p></div>
      <div class="result-section"><h4>3. Проверьте путь к работе</h4><p><strong>Вакансии:</strong> ${esc(path.jobs)}</p><p><strong>Первые проекты:</strong> ${esc(path.clients)}</p><a class="vacancy-link" href="${hh(track.roles[0][0])}" target="_blank" rel="noopener noreferrer">Открыть поиск вакансий ↗</a><p class="small muted">В поиске включён фильтр удалённой работы. Проверьте его и условия каждой вакансии.</p></div>
      <p class="small muted"><strong>Что важно знать заранее:</strong> ${esc(track.reality)}</p></article>`;
  }
  function introResult(result){
    if(result.uncertain)return {title:'Сначала сравните несколько направлений',lead:'Ответы пока не выделили достаточно ясного сочетания интересов. Это не ошибка: попробуйте две маленькие задачи из разных сфер и посмотрите, какую захочется продолжить.'};
    return {title:'Ваши направления для первой пробы',lead:'Это сферы, с которых разумно начать знакомство по вашим ответам. Они не закрывают остальные пути: сначала сравните реальные задачи и вакансии, затем выбирайте обучение.'};
  }
  function renderResult(result){
    const copy=introResult(result);
    const chosen=result.primary.map(item=>item.index);
    const other=result.ranked.filter(item=>!chosen.includes(item.index));
    const topInterests=Object.entries(result.dimensions).filter(([,value])=>value!==null&&value>=.67).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([key])=>labels[key]);
    const experienceNote=result.experience===0?'Опыт работы пока не нужен для учебной пробы. Не покупайте обучение до знакомства с реальными задачами.':result.experience===1?'Вспомните опыт из прежней сферы: общение, тексты, расчёты и организация могут стать опорой.':'Сопоставьте уже сделанные задачи с требованиями в свежих вакансиях.';
    const pathNote=result.path===0?'Ваш первый маршрут — вакансии и стажировки.':result.path===1?'Ваш первый маршрут — небольшие проектные задачи и рекомендации.':'Сравните работу в команде и отдельные проекты: обязанности и способ поиска отличаются.';
    app.innerHTML=`<div class="eyebrow">Результат профориентации</div><h1 class="results-title">${copy.title}</h1><p class="lead">${copy.lead}</p>
      <div class="card cream next-steps"><h3>Ваш план после теста</h3><ol><li>Выберите одно или два направления ниже и прочитайте обязанности профессий.</li><li>Откройте несколько свежих удалённых вакансий: выпишите повторяющиеся навыки, график и задачи.</li><li>Сделайте маленькую пробу до покупки обучения и сохраните результат как учебный пример.</li><li>Если задача понравилась, ищите обучение под конкретный пробел и начинайте откликаться на подходящие роли или небольшие проекты.</li></ol><p><strong>Где искать:</strong> удалённые вакансии — на сайтах работы и карьерных страницах компаний; первые проектные задачи — через рекомендации, профильные сообщества и площадки с заказами. Смотрите условия каждой задачи.</p><p>${esc(experienceNote)} ${esc(pathNote)}</p></div>
      ${topInterests.length?`<p class="profile-line"><strong>Что заметно в ответах:</strong> ${esc(topInterests.join(', '))}. Это интересы, а не оценка способностей.</p>`:''}
      ${chosen.length?`<div class="career-grid">${result.primary.map(item=>pathCard(item,result)).join('')}</div>`:''}
      <details class="other-spheres" ${result.uncertain?'open':''}><summary>${result.uncertain?'Сравнить 16 сфер удалённой работы':'Посмотреть остальные сферы'}</summary><div class="directory">${other.map(item=>{const track=tracks[item.index];return `<details><summary>${esc(track.sphere)} <span class="small muted">— ${esc(track.roles[0][0])}</span></summary>${pathCard(item,result)}</details>`}).join('')}</div></details>
      <details class="method"><summary>На чём основаны вопросы и рекомендации?</summary><p>Мы учитываем интерес к разным типам задач, привычный рабочий ритм и уже знакомые навыки. Структура интересов опирается на модель RIASEC. Для сравнения сфер использованы показатели интересов к похожим профессиям из базы O*NET 31.0 (США); соответствие этих профессий нашим русским направлениям и вопросы составлены автором. Рабочий стиль и знакомые навыки дают дополнительный сигнал, но отсутствие опыта не исключает профессию. Эта русская версия не проходила психометрическую проверку и не является официальным тестом O*NET.</p><p>Для более глубокой профориентации можно пройти <a href="https://www.mynextmove.org/explore/ip" target="_blank" rel="noopener noreferrer">официальный O*NET Interest Profiler ↗</a> (на английском). Данные: <a href="https://www.onetcenter.org/database.html" target="_blank" rel="noopener noreferrer">O*NET 31.0 Database ↗</a>, U.S. Department of Labor, Employment and Training Administration, <a href="https://www.onetcenter.org/license_db.html" target="_blank" rel="noopener noreferrer">CC BY 4.0 ↗</a>. Данные нормированы, профессии сгруппированы и описаны для этого проекта; USDOL/ETA не проверял и не одобрял эти изменения. O*NET® — товарный знак USDOL/ETA.</p></details>
      <p class="note">Не каждая профессия доступна удалённо в любой компании или стране. Проверьте требования, квалификацию, условия и формат конкретной вакансии. Результат не гарантирует трудоустройство или доход.</p>
      <div class="actions"><button id="edit">Изменить ответы</button><button id="restart">Пройти заново</button><button id="print">Сохранить или распечатать</button></div>`;
    document.getElementById('edit').onclick=()=>{step=0;renderQuestion();focusHeading()};
    document.getElementById('restart').onclick=()=>{answers.fill(null);intro();focusHeading()};
    document.getElementById('print').onclick=()=>window.print();
  }
  intro();
})();
