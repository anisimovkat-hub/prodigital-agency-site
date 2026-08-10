export const MARKETING_SECTIONS = [
  "overview",
  "content",
  "ads",
  "audience",
] as const;

export type MarketingSection = (typeof MARKETING_SECTIONS)[number];

export function marketingSection(
  value: string | null | undefined,
  legacyView?: string | null,
): MarketingSection {
  if (MARKETING_SECTIONS.includes(value as MarketingSection)) {
    return value as MarketingSection;
  }
  if (legacyView === "organic") return "content";
  if (legacyView === "ads") return "ads";
  return "overview";
}
