import { describe, expect, it } from "vitest";

import {
  createTaskSchema,
  taskAttachmentSchema,
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
