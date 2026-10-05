import { describe, expect, it } from "vitest";

import { candidateGoals, goalsWithData, resolveCampaignGoal } from "@/lib/ad-goals";

const counts = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe("candidateGoals", () => {
  it("reads the pixel event of a conversion campaign", () => {
    expect(candidateGoals("meta", "OUTCOME_SALES", "OFFSITE_CONVERSIONS:ADD_TO_CART")).toEqual(["cart"]);
  });
  it("uses a custom conversion when the ad set optimizes for it", () => {
    expect(candidateGoals("meta", "OUTCOME_LEADS", "OFFSITE_CONVERSIONS:custom:42")).toEqual(["custom:42"]);
  });
  it("falls back to the campaign objective", () => {
    expect(candidateGoals("meta", "OUTCOME_TRAFFIC", null)).toEqual(["landing", "clicks", "profile"]);
  });
  it("gives reach campaigns no target action", () => {
    expect(candidateGoals("meta", "OUTCOME_AWARENESS", "REACH")).toEqual([]);
  });
  it("maps connected platforms to their single goal", () => {
    expect(candidateGoals("telegram_ads", null, null)).toEqual(["telegram_joins"]);
  });
});

describe("resolveCampaignGoal", () => {
  it("picks one lead variant instead of adding form and pixel leads", () => {
    expect(resolveCampaignGoal(["leads"], counts({ "offsite_conversion.fb_pixel_lead": 4, "onsite_conversion.lead_grouped": 9 })))
      .toEqual({ key: "leads", action: "onsite_conversion.lead_grouped" });
  });
  it("keeps an honest zero for a lead campaign without leads", () => {
    expect(resolveCampaignGoal(["leads"], counts({ link_click: 50 }))).toEqual({ key: "leads", action: "lead" });
  });
  it("chooses the first objective candidate that has results", () => {
    expect(resolveCampaignGoal(["leads", "messages"], counts({ "onsite_conversion.messaging_conversation_started_7d": 3 })))
      .toEqual({ key: "messages", action: "onsite_conversion.messaging_conversation_started_7d" });
  });
});

describe("goalsWithData", () => {
  it("lists business goals and custom conversions present in the data", () => {
    expect(goalsWithData(["add_to_cart", "purchase", "offsite_conversion.custom.7", "post_reaction"])).toEqual(["purchases", "cart", "custom:7"]);
  });
});
