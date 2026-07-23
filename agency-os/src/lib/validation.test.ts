import { describe, expect, it } from "vitest";

import { createTaskSchema } from "@/lib/validation";

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
