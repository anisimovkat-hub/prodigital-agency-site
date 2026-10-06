export const MARKETING_SECTIONS = [
  "overview",
  "content",
  "ads",
] as const;

export type MarketingSection = (typeof MARKETING_SECTIONS)[number];

/** Tabs change presentation only; keep the project's report filters intact. */
export function analyticsSectionHref(query: string, section: MarketingSection): string {
  const params = new URLSearchParams(query);
  params.set("section", section);
  params.delete("view");
  return `/analytics?${params.toString()}`;
}

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
