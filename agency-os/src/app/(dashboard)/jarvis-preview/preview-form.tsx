"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { chooseIntakeField, nextIntakeQuestion, type IntakeCatalog } from "@/lib/task-intake-flow";
import { parseIntakeEdit, parseIntakeTask, splitIntakeTasks, type ParsedIntakeTask } from "@/lib/task-intake-parser";
import { formatTelegramTaskMessage } from "@/lib/telegram-task-message";

type PreviewItem = ParsedIntakeTask & { cancelled?: boolean };
export function JarvisPreview({ catalog }: { catalog: IntakeCatalog }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [error, setError] = useState("");
  const [other, setOther] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<Record<number, string>>({});
  const update = (index: number, item: PreviewItem) => setItems((current) => current.map((old, i) => i === index ? item : old));
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
    <div><h1 className="text-2xl font-semibold">Проверка Джарвиса</h1>
      <p className="mt-2 text-sm text-neutral-600">Введите задачу так, как написали бы её боту. Несколько задач разделите строками или словами «и ещё».</p></div>
    <p role="note" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">Тестовый режим: задачи в рабочей CRM не создаются, сообщения сотрудникам не отправляются. Названия проектов и сотрудников взяты из вашего справочника.</p>
    <form className="flex flex-col gap-3" onSubmit={(event) => {
      event.preventDefault(); const sources = splitIntakeTasks(text);
      if (!sources.length || sources.length > 20 || text.length > 12000) { setError("Введите от 1 до 20 задач, не больше 12 000 знаков."); return; }
      setError(""); setOther({}); setEditing({}); setItems(sources.map((source) => parseIntakeTask(source, catalog.projects, catalog.profiles)));
    }}>
      <Label htmlFor="jarvis-task-text">Текст задачи</Label>
      <Textarea id="jarvis-task-text" value={text} onChange={(event) => setText(event.target.value)} rows={4} maxLength={12000} placeholder="Илона Team Trip завтра подготовить отчёт" required />
      <div><Button type="submit">Проверить задачу</Button></div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
    <div aria-live="polite" className="flex flex-col gap-4">
      {items.map((item, index) => {
        const question = nextIntakeQuestion(item, catalog);
        const project = catalog.projects.find((p) => p.id === item.projectId);
        const assignee = catalog.profiles.find((p) => p.id === item.assigneeId);
        return <section key={index} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Задача {index + 1}</h2><span className="text-sm text-neutral-500">{item.cancelled ? "Отменена" : question ? "Нужно уточнение" : "Черновик готов"}</span></div>
          {!item.cancelled && <>
            {question ? <div className="flex flex-col gap-3">
              <p className="font-medium">{question.prompt}</p>
              <div className="flex flex-wrap gap-2">{question.choices.map((choice) => <Button key={choice.id} type="button" variant="secondary" onClick={() => {
                if (choice.id === "other") setOther((state) => ({ ...state, [index]: true }));
                else { update(index, chooseIntakeField(item, question.field, choice.id)); setOther((state) => ({ ...state, [index]: false })); }
              }}>{choice.label}</Button>)}</div>
              {(other[index] || question.field === "title") && <>
                {question.field === "title" ? <input aria-label={`Название задачи ${index + 1}`} className="rounded-md border p-2" onBlur={(event) => { if (event.target.value.trim()) update(index, chooseIntakeField(item, "title", event.target.value)); }} /> : <Select aria-label={question.field === "project" ? "Выбрать проект" : "Выбрать сотрудника"} defaultValue="" onChange={(event) => { if (event.target.value) { update(index, chooseIntakeField(item, question.field, event.target.value)); setOther((state) => ({ ...state, [index]: false })); } }}>
                  <option value="" disabled>Выберите</option>
                  {(question.field === "project" ? catalog.projects.filter((p) => ["active", "launching"].includes(p.stage ?? "")) : catalog.profiles).map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                </Select>}
              </>}
            </div> : <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"><dt className="text-neutral-500">Проект</dt><dd>{project?.name}</dd><dt className="text-neutral-500">Исполнитель</dt><dd>{assignee?.name}</dd><dt className="text-neutral-500">Срок</dt><dd>{item.dueDate ?? "Без срока"}</dd></dl>
              <div className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm" dangerouslySetInnerHTML={{ __html: formatTelegramTaskMessage({ projectName: project?.name ?? null, title: item.title, description: item.description, dueDate: item.dueDate, workstream: null }) }} />
              <div className="flex flex-wrap gap-2"><Button type="button" disabled>Отправить сотруднику</Button><Button type="button" variant="secondary" onClick={() => setEditing((state) => ({ ...state, [index]: "срок завтра" }))}>Внести правки</Button></div>
              <p className="text-xs text-neutral-500">Отправка доступна после выпуска рабочего бота.</p>
            </>}
            {editing[index] !== undefined && <div className="flex flex-col gap-2"><Label htmlFor={`edit-task-${index}`}>Правка задачи</Label><Textarea id={`edit-task-${index}`} value={editing[index]} onChange={(event) => setEditing((state) => ({ ...state, [index]: event.target.value }))} /><div><Button type="button" variant="secondary" onClick={() => { update(index, parseIntakeEdit(editing[index], item, catalog.projects, catalog.profiles)); setEditing((state) => { const next = { ...state }; delete next[index]; return next; }); }}>Применить правки</Button></div></div>}
            <div><Button type="button" variant="ghost" onClick={() => update(index, { ...item, cancelled: true })}>Отменить</Button></div>
          </>}
        </section>;
      })}
    </div>
  </div>;
}
