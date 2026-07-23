import { describe, expect, it } from "vitest";

import {
  DEFAULT_TODAY_COLUMN_ORDER,
  moveTodayColumn,
  normalizeTodayColumnOrder,
  sortTodayTableRows,
  type TodayTableSortableRow,
} from "@/lib/today-table";

function row(
  title: string,
  overrides: Partial<TodayTableSortableRow> = {},
): TodayTableSortableRow {
  return {
    title,
    projectName: null,
    assigneeName: null,
    priority: "medium",
    dueDate: null,
    status: "todo",
    done: false,
    ...overrides,
  };
}

describe("sortTodayTableRows", () => {
  it("сохраняет умный порядок страницы, пока пользователь не выбрал столбец", () => {
    const rows = [row("Срочная"), row("Просроченная")];

    expect(sortTodayTableRows(rows, null)).toEqual(rows);
    expect(sortTodayTableRows(rows, null)).not.toBe(rows);
  });

  it("сортирует по проекту и оставляет пустые значения в конце", () => {
    const rows = [
      row("Без проекта"),
      row("B", { projectName: "Яндекс" }),
      row("A", { projectName: "Альфа" }),
    ];

    expect(
      sortTodayTableRows(rows, { column: "project", direction: "asc" }).map(
        (item) => item.title,
      ),
    ).toEqual(["A", "B", "Без проекта"]);
  });

  it("сортирует приоритеты от срочного к низкому", () => {
    const rows = [
      row("Средний"),
      row("Срочный", { priority: "urgent" }),
      row("Низкий", { priority: "low" }),
      row("Высокий", { priority: "high" }),
    ];

    expect(
      sortTodayTableRows(rows, {
        column: "priority",
        direction: "desc",
      }).map((item) => item.title),
    ).toEqual(["Срочный", "Высокий", "Средний", "Низкий"]);
  });

  it("сортирует дедлайны и оставляет задачи без даты в конце", () => {
    const rows = [
      row("Без даты"),
      row("Позже", { dueDate: "2026-08-12" }),
      row("Раньше", { dueDate: "2026-08-10" }),
    ];

    expect(
      sortTodayTableRows(rows, { column: "due_date", direction: "asc" }).map(
        (item) => item.title,
      ),
    ).toEqual(["Раньше", "Позже", "Без даты"]);

    expect(
      sortTodayTableRows(rows, { column: "due_date", direction: "desc" }).map(
        (item) => item.title,
      ),
    ).toEqual(["Позже", "Раньше", "Без даты"]);
  });
});

describe("порядок столбцов", () => {
  it("перемещает столбец на выбранное место", () => {
    expect(
      moveTodayColumn(
        [...DEFAULT_TODAY_COLUMN_ORDER],
        "status",
        "project",
      ),
    ).toEqual([
      "status",
      "project",
      "title",
      "assignee",
      "priority",
      "due_date",
      "done",
    ]);
  });

  it("отбрасывает повреждённое сохранённое значение", () => {
    expect(normalizeTodayColumnOrder(["title", "title"])).toEqual(
      DEFAULT_TODAY_COLUMN_ORDER,
    );
  });
});
