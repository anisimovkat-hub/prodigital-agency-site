(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.AutomationModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Рутинные задачи. Человек отмечает свои, потом указывает общее время в неделю.
  const tasks = [
    {value: 'answers_faq', label: 'Отвечать клиентам на одни и те же вопросы'},
    {value: 'lead_processing', label: 'Разбирать заявки и заносить их в CRM или таблицу'},
    {value: 'followups', label: 'Напоминать клиентам, дожимать, возвращать «потеряшек»'},
    {value: 'scheduling', label: 'Записывать клиентов, переносить и подтверждать встречи'},
    {value: 'proposals', label: 'Готовить коммерческие предложения, сметы, расчёты'},
    {value: 'documents', label: 'Оформлять счета, акты, договоры'},
    {value: 'reports', label: 'Собирать отчёты: реклама, продажи, отчёты для клиентов'},
    {value: 'data_copy', label: 'Переносить данные между таблицами и системами'},
    {value: 'monitoring', label: 'Следить за рекламой и ключевыми цифрами'},
    {value: 'team_control', label: 'Контролировать задачи и сроки сотрудников'},
    {value: 'content', label: 'Писать посты, тексты, сценарии'},
    {value: 'research', label: 'Изучать рынок, конкурентов, аудиторию'},
    {value: 'onboarding', label: 'Вводить в работу новых сотрудников, отвечать на их вопросы'}
  ];

  const questions = [
    {id: 'biz', kind: 'single', title: 'Какой у вас бизнес?', options: [
      {value: 'agency', label: 'Агентство или сервисная компания (услуги для бизнеса)'},
      {value: 'expert', label: 'Эксперт, консультант, онлайн-школа'},
      {value: 'ecom', label: 'Интернет-магазин, маркетплейсы, продажи товаров'},
      {value: 'b2b', label: 'Производство, B2B, IT-услуги'},
      {value: 'local', label: 'Клиника, салон, студия, кафе — локальный бизнес'},
      {value: 'realty', label: 'Недвижимость, туризм, релокация'},
      {value: 'other', label: 'Другое'}
    ]},
    {id: 'team', kind: 'single', title: 'Сколько человек в команде?', options: [
      {value: 'solo', label: 'Только я'},
      {value: 'small', label: '2–5 человек'},
      {value: 'mid', label: '6–20 человек'},
      {value: 'large', label: 'Больше 20'}
    ]},
    {id: 'leads', kind: 'single', title: 'Сколько обращений и заявок приходит в месяц?', options: [
      {value: 'l1', label: 'До 30'},
      {value: 'l2', label: '30–150'},
      {value: 'l3', label: '150–500'},
      {value: 'l4', label: 'Больше 500'}
    ]},
    {id: 'tasks', kind: 'multi', title: 'Что ваша команда делает руками каждую неделю?', hint: 'Отметьте всё, что повторяется регулярно и по похожему сценарию.',
      options: tasks},
    {id: 'hours', kind: 'single', title: 'Сколько часов в неделю уходит на всё отмеченное?', hint: 'Сумма по всей команде, примерно.', options: [
      {value: 'h1', label: 'До 5 часов', hours: 3},
      {value: 'h2', label: '5–15 часов', hours: 10},
      {value: 'h3', label: '15–40 часов', hours: 27},
      {value: 'h4', label: 'Больше 40 часов', hours: 50}
    ]},
    {id: 'pains', kind: 'multi', max: 2, title: 'Что болит сильнее всего?', hint: 'Выберите до двух вариантов.', options: [
      {value: 'lose_leads', label: 'Теряем заявки или долго на них отвечаем'},
      {value: 'overloaded', label: 'Команда перегружена рутиной, не хватает рук'},
      {value: 'no_visibility', label: 'Нет прозрачности: не видно цифр и кто что делает'},
      {value: 'errors', label: 'Ошибки в документах, цифрах, сроках'},
      {value: 'content', label: 'Контент и маркетинг идут нерегулярно'},
      {value: 'scale', label: 'Не получается расти без найма новых людей'}
    ]},
    {id: 'data', kind: 'multi', title: 'Где сейчас живут данные о клиентах и работе?', options: [
      {value: 'sheets', label: 'Google Таблицы или Excel'},
      {value: 'crm', label: 'CRM (amoCRM, Битрикс24 и другие)'},
      {value: 'accounting', label: '1С или учётная система'},
      {value: 'tracker', label: 'Notion, таск-трекер, сервис задач'},
      {value: 'messengers', label: 'В основном в мессенджерах и почте'},
      {value: 'heads', label: 'На бумаге или в голове', exclusive: true}
    ]},
    {id: 'owner', kind: 'single', title: 'Кто будет отвечать за автоматизацию с вашей стороны?', options: [
      {value: 'me', label: 'Я сам(а)'},
      {value: 'staff', label: 'Есть сотрудник или IT-специалист'},
      {value: 'none', label: 'Некому — нужен подрядчик «под ключ»'}
    ]}
  ];

  // Каталог решений. share — какая доля времени на задачу обычно освобождается (редакционная оценка),
  // complexity: 1 — дни, 2 — 1–3 недели, 3 — месяц и больше. structured — нужны данные в таблице/CRM.
  const solutions = [
    {id: 'lead_flow', name: 'Заявки без потерь: автоматическая передача в CRM или таблицу и напоминания',
      covers: ['lead_processing', 'followups'], share: .5, complexity: 1, structured: false,
      pains: ['lose_leads', 'no_visibility'], boost: {agency: 1.1, local: 1.15, realty: 1.2},
      does: 'Каждая заявка с сайта, из рекламы и мессенджеров сама попадает в CRM или таблицу, ответственный получает уведомление, а клиенту уходит напоминание, если ему не ответили.',
      first: 'Выпишите все источники заявок и куда каждая из них сейчас попадает.'},
    {id: 'lead_bot', name: 'Бот-приёмщик: квалифицирует заявку и записывает клиента 24/7',
      covers: ['answers_faq', 'scheduling', 'lead_processing'], share: .4, complexity: 2, structured: false,
      pains: ['lose_leads', 'overloaded'], boost: {local: 1.25, expert: 1.15, realty: 1.15},
      does: 'Бот в Telegram или на сайте отвечает на частые вопросы, задаёт уточняющие вопросы, записывает на консультацию и передаёт тёплую заявку менеджеру.',
      first: 'Соберите 20 самых частых вопросов клиентов и ответы на них.',
      proof: 'Telegram-бот для регистрации на вебинар: контакты, напоминания участникам и события для рекламной аналитики.'},
    {id: 'support_ai', name: 'AI-ассистент для ответов клиентам по вашей базе знаний',
      covers: ['answers_faq'], share: .5, complexity: 2, structured: false,
      pains: ['overloaded', 'lose_leads'], boost: {ecom: 1.2, expert: 1.1},
      does: 'Ассистент готовит ответы на вопросы клиентов по вашим материалам: условия, цены, сроки. Сложные случаи передаёт человеку.',
      first: 'Соберите в один документ условия, цены, сроки и ответы на возражения.'},
    {id: 'kp_agent', name: 'AI-агент для коммерческих предложений и расчётов',
      covers: ['proposals'], share: .6, complexity: 2, structured: false,
      pains: ['overloaded', 'lose_leads', 'errors'], boost: {agency: 1.25, b2b: 1.2},
      does: 'Агент изучает запрос клиента и ваши материалы, подбирает подходящее и собирает индивидуальное КП или расчёт по вашему шаблону. Менеджер только проверяет и отправляет.',
      first: 'Возьмите 3–5 лучших КП за последние месяцы: из них получится шаблон для агента.',
      proof: 'Для PR-агентства Talent Press мы сделали агента, который анализирует 50 000 источников и готовит индивидуальные КП.'},
    {id: 'docs_auto', name: 'Документы по шаблону: счета, акты, договоры',
      covers: ['documents'], share: .6, complexity: 1, structured: true,
      pains: ['errors', 'overloaded'], boost: {b2b: 1.15, agency: 1.1},
      does: 'Счета, акты и договоры собираются из данных сделки автоматически, без ручного копирования реквизитов и сумм.',
      first: 'Соберите шаблоны документов и список полей, которые в них меняются.'},
    {id: 'reports_auto', name: 'Автоматические отчёты по рекламе и продажам',
      covers: ['reports', 'data_copy'], share: .65, complexity: 1, structured: true,
      pains: ['no_visibility', 'overloaded'], boost: {agency: 1.3, ecom: 1.15},
      does: 'Статистика из рекламных кабинетов, CRM и таблиц собирается каждый день сама. Отчёт для вас или клиента готов к нужному дню.',
      first: 'Определите 5–7 цифр, которые вы реально смотрите каждую неделю.',
      proof: 'Наша операционная система агентства каждый день сама собирает статистику Meta* и Яндекс Директа по всем проектам.'},
    {id: 'kpi_alerts', name: 'Контроль KPI и сроков с уведомлениями в Telegram',
      covers: ['monitoring', 'team_control'], share: .6, complexity: 1, structured: true,
      pains: ['no_visibility', 'errors', 'lose_leads'], boost: {agency: 1.25, ecom: 1.1},
      does: 'Система сама сравнивает цифры с планом и пишет ответственному, если заявки подорожали, их стало меньше, реклама остановилась или задача просрочена.',
      first: 'Запишите цели по каждому направлению: сколько заявок и по какой цене нужно.',
      proof: 'У себя в агентстве мы так контролируем рекламу всех проектов и сроки задач команды.'},
    {id: 'content_agent', name: 'AI-агент для контента по вашей методике и голосу',
      covers: ['content'], share: .4, complexity: 2, structured: false,
      pains: ['content', 'overloaded'], boost: {expert: 1.3, agency: 1.1},
      does: 'Агент готовит темы, посты и сценарии по вашей методике и в вашем стиле. Вы правите и публикуете, а правки становятся правилами для агента.',
      first: 'Соберите 5–10 своих лучших текстов: по ним строится голос бренда.',
      proof: 'Наш AI-отдел маркетинга готовит исследования, стратегии и тексты по методикам агентства и учится на правках.'},
    {id: 'research_agent', name: 'AI-исследования рынка, конкурентов и аудитории',
      covers: ['research'], share: .5, complexity: 2, structured: false,
      pains: ['overloaded', 'scale'], boost: {agency: 1.15, b2b: 1.1},
      does: 'Агент собирает и сравнивает данные о рынке, конкурентах, отзывах и рекламе, отделяет факты от догадок и выдаёт выводы со ссылками.',
      first: 'Сформулируйте 1–2 вопроса, ответ на которые изменит ваше решение.'},
    {id: 'knowledge_base', name: 'База знаний и AI-помощник для сотрудников',
      covers: ['onboarding'], share: .4, complexity: 2, structured: false,
      pains: ['scale', 'overloaded', 'errors'], boost: {mid: 1.2, large: 1.3},
      does: 'Регламенты и ответы на типовые вопросы собраны в одном месте, а AI-помощник отвечает новичкам по ним. Руководитель перестаёт быть справочным бюро.',
      first: 'Запишите 10 вопросов, которые новые сотрудники задают чаще всего.'},
    {id: 'sync_auto', name: 'Связка систем: данные переносятся сами',
      covers: ['data_copy'], share: .65, complexity: 1, structured: true,
      pains: ['errors', 'overloaded'], boost: {ecom: 1.1, b2b: 1.1},
      does: 'Данные между таблицами, CRM, учётной системой и сервисами переносятся автоматически, без копирования руками.',
      first: 'Нарисуйте путь данных: откуда, куда и как часто вы их переносите.'}
  ];

  const MAX_SHARE_OF_ROUTINE = .6;

  const byId = Object.fromEntries(questions.map(q => [q.id, q]));
  const labelOf = (qid, value) => {
    const o = byId[qid].options.find(x => x.value === value);
    return o ? o.label : value;
  };

  function weeklyHours(answers) {
    const o = byId.hours.options.find(x => x.value === answers.hours);
    return o ? o.hours : 0;
  }

  // Готовность к автоматизации: есть ли данные в цифре и ответственный.
  function readiness(answers) {
    const data = answers.data || [];
    let score = 0;
    if (data.includes('crm')) score += 2;
    if (data.includes('sheets') || data.includes('accounting') || data.includes('tracker')) score += 1.5;
    if (data.includes('messengers')) score += .5;
    score = Math.min(score, 3);
    if (answers.owner === 'staff') score += 2;
    else if (answers.owner === 'me') score += 1;
    const level = score >= 4 ? 'high' : score >= 2 ? 'mid' : 'low';
    return {score, level, structured: data.some(d => ['crm', 'sheets', 'accounting', 'tracker'].includes(d))};
  }

  function score(answers) {
    const picked = answers.tasks || [];
    const hours = weeklyHours(answers);
    const perTask = picked.length ? hours / picked.length : 0;
    const pains = answers.pains || [];
    const ready = readiness(answers);
    const ranked = solutions.map(s => {
      const hit = s.covers.filter(t => picked.includes(t));
      let saved = hit.length * perTask * s.share;
      let weight = saved;
      const painHit = s.pains.filter(p => pains.includes(p));
      weight *= 1 + .25 * painHit.length;
      weight *= (s.boost[answers.biz] || 1) * (s.boost[answers.team] || 1);
      const needsData = s.structured && !ready.structured;
      if (needsData) weight *= .8;
      if (answers.owner === 'none' && s.complexity >= 2) weight *= .9;
      return {solution: s, tasks: hit, painHit, saved, weight, needsData};
    }).filter(r => r.tasks.length > 0 && r.saved > 0)
      .sort((a, b) => b.weight - a.weight || a.solution.complexity - b.solution.complexity);
    // Решения, которые закрывают одни и те же задачи, не повторяем в топе.
    const top = [];
    const used = new Set();
    for (const r of ranked) {
      const fresh = r.tasks.filter(t => !used.has(t));
      if (!fresh.length) continue;
      top.push(r);
      r.tasks.forEach(t => used.add(t));
      if (top.length === 3) break;
    }
    // Консервативно: автоматизация не забирает больше 60% рутины — остаются проверка, исключения, настройка.
    const rawWeek = top.reduce((sum, r) => sum + r.saved, 0);
    const cap = hours * MAX_SHARE_OF_ROUTINE;
    if (rawWeek > cap) top.forEach(r => { r.saved *= cap / rawWeek; });
    const savedWeek = Math.min(rawWeek, cap);
    return {
      top, ready, hours,
      savedWeek: Math.round(savedWeek),
      savedMonth: Math.round(savedWeek * 4.3),
      tooEarly: hours <= 3 && picked.length <= 2,
      tasks: picked.map(t => labelOf('tasks', t))
    };
  }

  // Краткое описание ответов человеческим языком — для AI-разбора и заявки.
  function describe(answers) {
    const one = id => answers[id] ? labelOf(id, answers[id]) : '—';
    const many = id => (answers[id] || []).map(v => labelOf(id, v)).join('; ') || '—';
    return {
      biz: one('biz'), team: one('team'), leads: one('leads'), tasks: many('tasks'),
      hours: one('hours'), pains: many('pains'), data: many('data'), owner: one('owner')
    };
  }

  return {questions, tasks, solutions, score, readiness, describe, weeklyHours};
});
