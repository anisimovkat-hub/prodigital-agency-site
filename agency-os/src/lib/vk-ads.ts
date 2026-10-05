import "server-only";

const API = "https://ads.vk.com/api/v2";

export type VkCredential = { clientId: string; clientSecret: string; accessToken?: string; refreshToken?: string; expiresAt?: number };

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(`${API}/oauth2/token.json`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number | string; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) throw new Error(`VK Реклама: ${json.error_description ?? json.error ?? response.status}`);
  return json;
}

/**
 * Returns a working access token. VK allows only 5 live tokens per client, so we reuse
 * and refresh the stored one; if the limit is reached, old tokens are revoked first.
 */
export async function ensureVkToken(credential: VkCredential): Promise<{ credential: VkCredential; changed: boolean }> {
  if (credential.accessToken && (credential.expiresAt ?? 0) > Date.now() + 60_000) return { credential, changed: false };
  const base = { client_id: credential.clientId, client_secret: credential.clientSecret };
  let json;
  try {
    json = credential.refreshToken
      ? await tokenRequest({ ...base, grant_type: "refresh_token", refresh_token: credential.refreshToken })
      : await tokenRequest({ ...base, grant_type: "client_credentials" });
  } catch {
    // Expired refresh token or token limit: start over with a clean client_credentials token.
    await fetch(`${API}/oauth2/token/delete.json`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(base) });
    json = await tokenRequest({ ...base, grant_type: "client_credentials" });
  }
  return {
    changed: true,
    credential: {
      ...credential,
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? credential.refreshToken,
      expiresAt: Date.now() + Number(json.expires_in ?? 86_400) * 1000,
    },
  };
}

async function get<T>(token: string, path: string, query: Record<string, string>): Promise<T> {
  const response = await fetch(`${API}/${path}?${new URLSearchParams(query)}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
  const json = (await response.json()) as T & { error?: { message?: string; code?: string } };
  if (!response.ok || json.error) throw new Error(`VK Реклама: ${json.error?.message ?? json.error?.code ?? response.status}`);
  return json;
}

export async function fetchVkAccountName(token: string): Promise<string | null> {
  const user = await get<{ username?: string; id?: number }>(token, "user.json", {});
  return user.username ?? (user.id ? `VK ${user.id}` : null);
}

export type VkCampaignDay = { campaignId: string; name: string; date: string; spend: number; impressions: number; clicks: number; goals: number };

type VkRow = { date: string; base?: { shows?: number | string; clicks?: number | string; spent?: number | string; goals?: number | string } };

/** Daily statistics of all campaigns, spend in the account currency without VAT. */
export async function fetchVkCampaignDays(token: string, from: string, to: string): Promise<VkCampaignDay[]> {
  const campaigns: { id: number; name: string }[] = [];
  for (let offset = 0; offset < 10_000; offset += 250) {
    const page = await get<{ items?: { id: number; name: string }[]; count?: number }>(token, "campaigns.json", { fields: "id,name", limit: "250", offset: String(offset), _status__in: "active,blocked,deleted" });
    campaigns.push(...(page.items ?? []));
    if ((page.items?.length ?? 0) < 250) break;
  }
  const names = new Map(campaigns.map((campaign) => [String(campaign.id), campaign.name]));
  const days: VkCampaignDay[] = [];
  for (let index = 0; index < campaigns.length; index += 200) {
    const ids = campaigns.slice(index, index + 200).map((campaign) => campaign.id).join(",");
    const stats = await get<{ items?: { id: number; rows?: VkRow[] }[] }>(token, "statistics/campaigns/day.json", { id: ids, date_from: from, date_to: to, metrics: "base" });
    for (const item of stats.items ?? []) {
      for (const row of item.rows ?? []) {
        const impressions = Number(row.base?.shows ?? 0), clicks = Number(row.base?.clicks ?? 0), spend = Number(row.base?.spent ?? 0);
        if (!impressions && !clicks && !spend) continue;
        days.push({ campaignId: String(item.id), name: names.get(String(item.id)) ?? `Кампания ${item.id}`, date: row.date, spend, impressions, clicks, goals: Number(row.base?.goals ?? 0) });
      }
    }
  }
  return days;
}
