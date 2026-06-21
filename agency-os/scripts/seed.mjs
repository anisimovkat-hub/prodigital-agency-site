#!/usr/bin/env node
// Наполняет базу тестовыми данными для разработки.
//
// Запуск:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs
//
// SUPABASE_SERVICE_ROLE_KEY берётся в Supabase Dashboard → Settings → API
// (Service Role Key, не Anon Key) — он обходит RLS и нужен только локально,
// в репозиторий не коммитится.
//
// Скрипт идемпотентен: повторный запуск не плодит дубликаты.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEED_PASSWORD = "agencyos123";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Укажите NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в переменных окружения.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find((user) => user.email === email);
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function getOrCreateUser(email) {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function upsertByMatch(table, match, payload) {
  const { data: existing, error: selectError } = await supabase
    .from(table)
    .select("id")
    .match(match)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ ...match, ...payload })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const TEAM = [
  {
    email: "owner@agencyos.dev",
    full_name: "Анна Иванова",
    role: "owner",
    position_title: "Управляющий партнёр",
  },
  {
    email: "pm@agencyos.dev",
    full_name: "Дмитрий Соколов",
    role: "pm",
    position_title: "Проект-менеджер",
  },
  {
    email: "specialist@agencyos.dev",
    full_name: "Мария Кузнецова",
    role: "specialist",
    position_title: "Таргетолог",
  },
];

async function seedTeam() {
  console.log("→ Сотрудники");
  const profileIds = {};
  for (const member of TEAM) {
    const user = await getOrCreateUser(member.email);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: member.full_name,
      role: member.role,
      position_title: member.position_title,
      email: member.email,
      is_active: true,
    });
    if (error) throw error;
    profileIds[member.email] = user.id;
  }
  return profileIds;
}

async function seedClients() {
  console.log("→ Клиенты");
  const clientIds = {};
  const clients = [
    {
      key: "coffee",
      name: "Кофейня «Бодрость»",
      status: "active",
      budget: 150000,
      email: "coffee@example.com",
    },
    {
      key: "techdom",
      name: "Интернет-магазин «Техно-Дом»",
      status: "active",
      budget: 400000,
      email: "tech-dom@example.com",
    },
    {
      key: "pulsefit",
      name: "Сеть фитнес-клубов «ПульсФит»",
      status: "paused",
      budget: 220000,
      email: "pulsefit@example.com",
    },
  ];
  for (const { key, name, ...payload } of clients) {
    clientIds[key] = await upsertByMatch("clients", { name }, payload);
  }
  return clientIds;
}

async function seedProjects(clientIds, profileIds) {
  console.log("→ Проекты");
  const projectIds = {};
  const projects = [
    {
      key: "coffee_target",
      name: "Таргет ВК — Кофейня «Бодрость»",
      client_id: clientIds.coffee,
      health: "green",
      stage: "active",
      budget: 80000,
      responsible_id: profileIds["specialist@agencyos.dev"],
      short_comment: "Стабильный поток заявок, тестируем новые креативы.",
    },
    {
      key: "techdom_ads",
      name: "Яндекс.Директ — Техно-Дом",
      client_id: clientIds.techdom,
      health: "yellow",
      stage: "active",
      budget: 250000,
      responsible_id: profileIds["pm@agencyos.dev"],
      short_comment: "Растёт CPL, нужна оптимизация кампаний.",
    },
    {
      key: "techdom_site",
      name: "Редизайн сайта — Техно-Дом",
      client_id: clientIds.techdom,
      health: "red",
      stage: "active",
      budget: 150000,
      responsible_id: profileIds["owner@agencyos.dev"],
      short_comment: "Срываются сроки сдачи макетов.",
    },
    {
      key: "pulsefit_smm",
      name: "SMM — ПульсФит",
      client_id: clientIds.pulsefit,
      health: "green",
      stage: "paused",
      budget: 60000,
      responsible_id: profileIds["specialist@agencyos.dev"],
      short_comment: "На паузе по просьбе клиента.",
    },
  ];
  for (const { key, name, ...payload } of projects) {
    projectIds[key] = await upsertByMatch("projects", { name }, payload);
  }
  return projectIds;
}

async function seedTasks(projectIds, profileIds) {
  console.log("→ Задачи");
  const taskIds = {};
  const tasks = [
    {
      key: "creative_batch",
      project_id: projectIds.coffee_target,
      title: "Подготовить 5 новых креативов",
      assignee_id: profileIds["specialist@agencyos.dev"],
      creator_id: profileIds["pm@agencyos.dev"],
      status: "in_progress",
      priority: "high",
      task_type: "creative",
      due_date: addDays(1),
      is_important: true,
      is_urgent: false,
      description: "Сделать варианты под акцию выходного дня.",
    },
    {
      key: "cpl_report",
      project_id: projectIds.techdom_ads,
      title: "Разобраться с ростом CPL",
      assignee_id: profileIds["pm@agencyos.dev"],
      creator_id: profileIds["owner@agencyos.dev"],
      status: "todo",
      priority: "urgent",
      task_type: "analytics",
      due_date: addDays(-1),
      is_important: true,
      is_urgent: true,
      description: "CPL вырос на 40% за неделю, нужен аудит кампаний.",
    },
    {
      key: "site_layout",
      project_id: projectIds.techdom_site,
      title: "Сдать макеты главной страницы",
      assignee_id: profileIds["specialist@agencyos.dev"],
      creator_id: profileIds["owner@agencyos.dev"],
      status: "review",
      priority: "urgent",
      task_type: "website",
      due_date: addDays(-3),
      is_important: true,
      is_urgent: true,
      description: "Просрочено, клиент уже спрашивал статус.",
    },
    {
      key: "monthly_report",
      project_id: projectIds.coffee_target,
      title: "Собрать отчёт за месяц",
      assignee_id: profileIds["pm@agencyos.dev"],
      creator_id: profileIds["pm@agencyos.dev"],
      status: "todo",
      priority: "medium",
      task_type: "report",
      due_date: addDays(0),
      is_important: false,
      is_urgent: false,
    },
    {
      key: "client_call",
      project_id: projectIds.techdom_ads,
      title: "Созвон с клиентом по итогам недели",
      assignee_id: profileIds["pm@agencyos.dev"],
      creator_id: profileIds["pm@agencyos.dev"],
      status: "todo",
      priority: "medium",
      task_type: "communication",
      due_date: addDays(2),
      is_important: false,
      is_urgent: false,
    },
    {
      key: "smm_plan",
      project_id: projectIds.pulsefit_smm,
      title: "Составить контент-план на возобновление",
      assignee_id: profileIds["specialist@agencyos.dev"],
      creator_id: profileIds["specialist@agencyos.dev"],
      status: "backlog",
      priority: "low",
      task_type: "content",
      due_date: null,
      is_important: false,
      is_urgent: false,
    },
    {
      key: "done_audit",
      project_id: projectIds.coffee_target,
      title: "Аудит рекламного кабинета",
      assignee_id: profileIds["specialist@agencyos.dev"],
      creator_id: profileIds["pm@agencyos.dev"],
      status: "done",
      priority: "medium",
      task_type: "ads",
      due_date: addDays(-7),
      is_important: false,
      is_urgent: false,
      completed_at: new Date().toISOString(),
    },
  ];
  for (const { key, ...payload } of tasks) {
    taskIds[key] = await upsertByMatch(
      "tasks",
      { project_id: payload.project_id, title: payload.title },
      payload,
    );
  }
  return taskIds;
}

async function seedTaskExtras(taskIds, profileIds) {
  console.log("→ Чеклисты и комментарии");
  const checklistItems = [
    { task_key: "creative_batch", title: "Баннер 1080×1080", position: 0 },
    { task_key: "creative_batch", title: "Баннер 1080×1350", position: 1 },
    { task_key: "creative_batch", title: "Видео 15 сек", position: 2 },
  ];
  for (const { task_key, ...payload } of checklistItems) {
    await upsertByMatch(
      "task_checklist_items",
      { task_id: taskIds[task_key], title: payload.title },
      { position: payload.position },
    );
  }

  const comments = [
    {
      task_key: "site_layout",
      author_email: "owner@agencyos.dev",
      body: "Клиент просит ускорить сдачу, держим в курсе.",
    },
    {
      task_key: "cpl_report",
      author_email: "pm@agencyos.dev",
      body: "Похоже, дело в новой аудитории — проверяем настройки.",
    },
  ];
  for (const { task_key, author_email, body } of comments) {
    const { data: existing } = await supabase
      .from("task_comments")
      .select("id")
      .eq("task_id", taskIds[task_key])
      .eq("body", body)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskIds[task_key],
        author_id: profileIds[author_email],
        body,
      });
      if (error) throw error;
    }
  }
}

async function seedKpiEntries(projectIds) {
  console.log("→ KPI");
  for (let i = 6; i >= 0; i -= 1) {
    const entryDate = addDays(-i);
    const spend = 4000 + i * 150;
    const impressions = 25000 + i * 500;
    const clicks = 600 + i * 10;
    const leads = 18 + (i % 3);
    const sales = 5 + (i % 2);
    const revenue = sales * 9000;
    await upsertByMatch(
      "kpi_entries",
      { project_id: projectIds.coffee_target, entry_date: entryDate },
      { spend, impressions, clicks, leads, sales, revenue },
    );
  }

  for (let i = 6; i >= 0; i -= 1) {
    const entryDate = addDays(-i);
    const spend = 12000 + i * 600;
    const impressions = 60000 + i * 1200;
    const clicks = 900 + i * 15;
    const leads = 10 + (i % 4);
    const sales = 2 + (i % 2);
    const revenue = sales * 15000;
    await upsertByMatch(
      "kpi_entries",
      { project_id: projectIds.techdom_ads, entry_date: entryDate },
      { spend, impressions, clicks, leads, sales, revenue },
    );
  }
}

async function seedNotes(projectIds, profileIds) {
  console.log("→ Заметки по проектам");
  const notes = [
    {
      project_id: projectIds.coffee_target,
      type: "hypothesis",
      body: "Видео-креативы дадут CTR выше статичных баннеров.",
      status: "testing",
      author_id: profileIds["specialist@agencyos.dev"],
    },
    {
      project_id: projectIds.techdom_ads,
      type: "risk",
      body: "Рост CPL может привести к перерасходу бюджета к концу месяца.",
      status: "open",
      author_id: profileIds["pm@agencyos.dev"],
    },
    {
      project_id: projectIds.techdom_site,
      type: "history",
      body: "Первая версия макетов отклонена клиентом 10 числа.",
      status: null,
      author_id: profileIds["owner@agencyos.dev"],
    },
    {
      project_id: projectIds.pulsefit_smm,
      type: "client_note",
      body: "Клиент попросил приостановить продвижение до открытия нового зала.",
      status: null,
      author_id: profileIds["specialist@agencyos.dev"],
    },
  ];
  for (const note of notes) {
    const { data: existing } = await supabase
      .from("project_notes")
      .select("id")
      .eq("project_id", note.project_id)
      .eq("body", note.body)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase.from("project_notes").insert(note);
      if (error) throw error;
    }
  }
}

async function main() {
  const profileIds = await seedTeam();
  const clientIds = await seedClients();
  const projectIds = await seedProjects(clientIds, profileIds);
  const taskIds = await seedTasks(projectIds, profileIds);
  await seedTaskExtras(taskIds, profileIds);
  await seedKpiEntries(projectIds);
  await seedNotes(projectIds, profileIds);

  console.log("\nГотово. Тестовые пользователи (пароль одинаковый для всех):");
  for (const member of TEAM) {
    console.log(`  ${member.email} / ${SEED_PASSWORD}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
