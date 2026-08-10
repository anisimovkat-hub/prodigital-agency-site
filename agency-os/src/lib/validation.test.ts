import { describe, expect, it } from "vitest";

import {
  createRecurringTaskSchema,
  createTaskSchema,
  taskAttachmentSchema,
  updateProjectQuickFieldSchema,
  updateTaskDueDateSchema,
  updateRecurringScheduleSchema,
  updateTaskSchema,
} from "@/lib/validation";

const validTask = {
  title: "Подготовить отчёт",
  project_id: "00000000-0000-4000-8000-000000000001",
  task_type: "report",
  priority: "medium",
};

describe("createTaskSchema estimate_minutes", () => {
  it("конвертирует часы из формы в минуты", () => {
    const result = createTaskSchema.parse({
      ...validTask,
      estimate_minutes: "1.25",
    });

    expect(result.estimate_minutes).toBe(75);
  });

  it("округляет дробные минуты", () => {
    const result = createTaskSchema.parse({
      ...validTask,
      estimate_minutes: "0.26",
    });

    expect(result.estimate_minutes).toBe(16);
  });

  it("сохраняет пустую необязательную оценку как null", () => {
    const result = createTaskSchema.parse({
      ...validTask,
      estimate_minutes: "",
    });

    expect(result.estimate_minutes).toBeNull();
  });

  it("отклоняет отрицательную оценку", () => {
    const result = createTaskSchema.safeParse({
      ...validTask,
      estimate_minutes: "-1",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  const validUpdate = {
    id: "00000000-0000-4000-8000-000000000002",
    title: "Обновлённая задача",
    project_id: "",
    assignee_id: "",
    status: "in_progress",
    task_type: "content",
    priority: "high",
    due_date: "",
    estimate_minutes: "2.5",
    description: "ТЗ и ссылки",
    is_important: true,
    is_urgent: false,
  };

  it("принимает все редактируемые поля и переводит часы в минуты", () => {
    const result = updateTaskSchema.parse(validUpdate);

    expect(result.project_id).toBeUndefined();
    expect(result.status).toBe("in_progress");
    expect(result.estimate_minutes).toBe(150);
  });

  it("отклоняет неизвестный статус", () => {
    expect(
      updateTaskSchema.safeParse({ ...validUpdate, status: "unknown" }).success,
    ).toBe(false);
  });
});

describe("updateTaskDueDateSchema", () => {
  it("принимает новую дату", () => {
    const result = updateTaskDueDateSchema.parse({
      id: "00000000-0000-4000-8000-000000000002",
      due_date: "2026-07-31",
    });

    expect(result.due_date).toBe("2026-07-31");
  });

  it("превращает пустую дату в undefined для очистки дедлайна", () => {
    const result = updateTaskDueDateSchema.parse({
      id: "00000000-0000-4000-8000-000000000002",
      due_date: "",
    });

    expect(result.due_date).toBeUndefined();
  });
});

describe("updateProjectQuickFieldSchema", () => {
  const id = "00000000-0000-4000-8000-000000000003";

  it("принимает быстрый выбор состояния проекта", () => {
    expect(
      updateProjectQuickFieldSchema.parse({
        id,
        field: "health",
        value: "yellow",
      }),
    ).toEqual({ id, field: "health", value: "yellow" });
  });

  it("принимает быстрый выбор стадии проекта", () => {
    expect(
      updateProjectQuickFieldSchema.safeParse({
        id,
        field: "stage",
        value: "finished",
      }).success,
    ).toBe(true);
  });

  it("не позволяет передать значение не от выбранного поля", () => {
    expect(
      updateProjectQuickFieldSchema.safeParse({
        id,
        field: "health",
        value: "finished",
      }).success,
    ).toBe(false);
  });
});

describe("taskAttachmentSchema", () => {
  it("принимает корректную ссылку", () => {
    expect(
      taskAttachmentSchema.safeParse({
        task_id: "00000000-0000-4000-8000-000000000002",
        url: "https://docs.google.com/document/d/example",
        title: "ТЗ",
      }).success,
    ).toBe(true);
  });

  it("отклоняет текст вместо ссылки", () => {
    expect(
      taskAttachmentSchema.safeParse({
        task_id: "00000000-0000-4000-8000-000000000002",
        url: "не ссылка",
      }).success,
    ).toBe(false);
  });
});

describe("recurring task schemas", () => {
  const validRecurring = {
    title: "Опубликовать reels",
    project_id: "00000000-0000-4000-8000-000000000001",
    assignee_id: "00000000-0000-4000-8000-000000000002",
    task_type: "content",
    priority: "medium",
    frequency: "daily",
    weekdays: [],
    anchor_date: "2026-07-24",
  };

  it("принимает ежедневный шаблон", () => {
    expect(createRecurringTaskSchema.safeParse(validRecurring).success).toBe(
      true,
    );
  });

  it("требует дни недели для еженедельного шаблона", () => {
    const result = createRecurringTaskSchema.safeParse({
      ...validRecurring,
      frequency: "weekly",
    });

    expect(result.success).toBe(false);
  });

  it("принимает несколько дней недели", () => {
    const result = updateRecurringScheduleSchema.parse({
      id: "00000000-0000-4000-8000-000000000003",
      frequency: "weekly",
      weekdays: ["1", "3", "5"],
      anchor_date: "2026-07-24",
    });

    expect(result.weekdays).toEqual([1, 3, 5]);
  });
});
