import { redirect } from "next/navigation";

const KEYS = ["from", "to", "project", "gran", "account", "campaign", "goal"] as const;

export default async function LegacyAdsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const legacy = await searchParams;
  const next = new URLSearchParams({ section: "ads" });
  for (const key of KEYS) {
    const value = legacy[key];
    if (typeof value === "string" && value) next.set(key, value);
  }
  redirect(`/analytics?${next.toString()}`);
}
