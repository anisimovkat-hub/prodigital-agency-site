import { describe, expect, it } from "vitest";

import { formatDuration } from "@/lib/format";

describe("formatDuration", () => {
  it("возвращает прочерк для отсутствующей оценки", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("форматирует минуты без часов", () => {
    expect(formatDuration(45)).toBe("45 мин");
  });

  it("форматирует часы и минуты", () => {
    expect(formatDuration(150)).toBe("2 ч 30 мин");
  });

  it("не добавляет нулевые минуты к полным часам", () => {
    expect(formatDuration(120)).toBe("2 ч");
  });

  it("форматирует нулевую оценку", () => {
    expect(formatDuration(0)).toBe("0 мин");
  });
});
