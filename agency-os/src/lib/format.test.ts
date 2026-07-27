import { describe, expect, it } from "vitest";

import { formatDuration, formatTimerDuration } from "@/lib/format";

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

describe("formatTimerDuration", () => {
  it("форматирует накопленные секунды как таймер", () => {
    expect(formatTimerDuration(3_661)).toBe("01:01:01");
  });

  it("не показывает отрицательное время", () => {
    expect(formatTimerDuration(-10)).toBe("00:00:00");
  });
});
