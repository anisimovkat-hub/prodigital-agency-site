import { describe, expect, it } from "vitest";

import { getInitials } from "@/components/avatar";

describe("getInitials", () => {
  it("берёт первые буквы имени и фамилии", () => {
    expect(getInitials("Анна Петрова")).toBe("АП");
  });

  it("использует первую букву для имени из одного слова", () => {
    expect(getInitials("Анна")).toBe("А");
  });

  it("берёт первое и последнее слово в полном имени", () => {
    expect(getInitials("Анна Сергеевна Петрова")).toBe("АП");
  });

  it("показывает заглушку без имени", () => {
    expect(getInitials(null)).toBe("?");
  });
});
