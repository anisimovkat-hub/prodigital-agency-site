import { describe, expect, it } from "vitest";

import { formatCampaignCompletionMessage } from "./telegram-campaign-completions";

describe("formatCampaignCompletionMessage", () => {
  it("keeps the completion handoff concise and action-oriented", () => {
    expect(formatCampaignCompletionMessage({
      client_label: "mos.ru",
      application_number: 4,
      campaign_name: "онлайн-консультации",
      scheduled_for: "2026-10-15",
    })).toBe([
      "<b>mos.ru / заявка 4 / онлайн-консультации</b>",
      "<b>Завершение РК — 15.10</b>",
      "Нужно прислать номера всех РК.",
      "Нужно прислать общую статистику по этой РК после отключения.",
    ].join("\n\n"));
  });
});
