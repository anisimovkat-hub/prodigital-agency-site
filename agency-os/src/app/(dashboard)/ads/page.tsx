import { SyncMetaButton } from "@/app/(dashboard)/ads/sync-button";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  actionTypeLabel,
  summarizeCampaigns,
  type ConversionRow,
} from "@/lib/ad-analytics";
import { createClient } from "@/lib/supabase/server";

// Синхронизация с Meta ходит в Graph API по всем кабинетам — даём запас времени
// server action'ам этой страницы (см. route segment config maxDuration).
export const maxDuration = 60;

type AdAccountRow = {
  id: string;
  name: string | null;
  external_id: string;
  currency: string | null;
  project: { name: string } | null;
};

type AdCampaignRow = {
  id: string;
  name: string | null;
  objective: string | null;
  status: string | null;
  ad_account_id: string;
  project: { name: string } | null;
};

function fmt(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function fmtMoney(value: number): string {
  return value.toLocaleString("ru-RU", {
    maximumFractionDigits: value < 100 ? 2 : 0,
  });
}

function fmtPercent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

export default async function AdsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();

  if (profile?.role !== "owner") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900">Реклама</h1>
        <p className="text-sm text-neutral-500">
          Раздел доступен только владельцу.
        </p>
      </div>
    );
  }

  const until = new Date();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);
  const untilISO = until.toISOString().slice(0, 10);

  const [{ data: accounts }, { data: metrics }, { data: campaigns }, { data: summary }] =
    await Promise.all([
      supabase
        .from("ad_accounts")
        .select("id,name,external_id,currency, project:projects(name)")
        .eq("platform", "meta")
        .order("name"),
      supabase
        .from("ad_metrics")
        .select("ad_account_id,spend,leads,date")
        .gte("date", sinceISO),
      supabase
        .from("ad_campaigns")
        .select(
          "id,name,objective,status,ad_account_id, project:projects(name)",
        ),
      supabase.rpc("ad_campaign_period_summary", {
        p_since: sinceISO,
        p_until: untilISO,
      }),
    ]);

  const agg = new Map<string, { spend: number; leads: number; lastDate: string }>();
  for (const row of metrics ?? []) {
    const cur = agg.get(row.ad_account_id) ?? { spend: 0, leads: 0, lastDate: "" };
    cur.spend += Number(row.spend ?? 0);
    cur.leads += Number(row.leads ?? 0);
    if (row.date > cur.lastDate) cur.lastDate = row.date;
    agg.set(row.ad_account_id, cur);
  }

  const rows = (accounts ?? []) as AdAccountRow[];
  const accountById = new Map(rows.map((account) => [account.id, account]));
  const campaignRows = (campaigns ?? []) as AdCampaignRow[];

  // Свод из RPC разворачиваем в плоские строки — дальше считает та же чистая
  // функция, что покрыта тестами (её же переиспользует аналитический UI фазы B).
  const campaignMetrics = (summary ?? []).map((row) => ({
    campaign_id: row.campaign_id,
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
  }));
  const conversions: ConversionRow[] = [];
  for (const row of summary ?? []) {
    for (const item of row.conversions ?? []) {
      conversions.push({
        campaign_id: row.campaign_id,
        action_type: item.action_type,
        count: Number(item.count ?? 0),
        value: Number(item.value ?? 0),
      });
    }
  }
  const summaries = summarizeCampaigns(campaignMetrics, conversions);

  const campaignTable = campaignRows
    .map((campaign) => ({
      campaign,
      account: accountById.get(campaign.ad_account_id) ?? null,
      stats: summaries.get(campaign.id) ?? null,
    }))
    .sort((a, b) => (b.stats?.spend ?? 0) - (a.stats?.spend ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Реклама (Meta)</h1>
        <p className="text-sm text-neutral-500">
          Статистика за последние 30 дней. Суммы — в валюте кабинета. Данные
          обновляются кнопкой ниже (позже — автоматически).
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <SyncMetaButton />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">Кабинеты</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Кабинет</TableHead>
              <TableHead>Проект</TableHead>
              <TableHead>Валюта</TableHead>
              <TableHead>Расход 30д</TableHead>
              <TableHead>Лиды 30д</TableHead>
              <TableHead>CPL</TableHead>
              <TableHead>Последние данные</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableEmpty colSpan={7}>
                Кабинетов пока нет. Нажмите «Обновить статистику Меты» — подтянем
                кабинеты и метрики из токена.
              </TableEmpty>
            )}
            {rows.map((account) => {
              const a = agg.get(account.id);
              const spend = a?.spend ?? 0;
              const leads = a?.leads ?? 0;
              const cpl = leads > 0 ? spend / leads : null;
              return (
                <TableRow key={account.id}>
                  <TableCell className="font-medium text-neutral-900">
                    {account.name ?? account.external_id}
                  </TableCell>
                  <TableCell className="text-neutral-600">
                    {account.project?.name ?? "— не привязан"}
                  </TableCell>
                  <TableCell className="text-neutral-500">
                    {account.currency ?? "—"}
                  </TableCell>
                  <TableCell>{fmt(spend)}</TableCell>
                  <TableCell>{fmt(leads)}</TableCell>
                  <TableCell>{cpl === null ? "—" : fmt(cpl)}</TableCell>
                  <TableCell className="text-neutral-500">
                    {a?.lastDate || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">Кампании</h2>
        <p className="text-sm text-neutral-500">
          У кампаний разные цели, поэтому «Главная цель» выбирается по данным самой
          кампании, а CPA считается по ней. Под названием — все цели за период.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Кампания</TableHead>
              <TableHead>Проект</TableHead>
              <TableHead>Кабинет</TableHead>
              <TableHead>Расход 30д</TableHead>
              <TableHead>Главная цель</TableHead>
              <TableHead>Конверсий</TableHead>
              <TableHead>CPA</TableHead>
              <TableHead>CTR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaignTable.length === 0 && (
              <TableEmpty colSpan={8}>
                Кампаний пока нет. Нажмите «Обновить статистику Меты» — подтянем
                кампании и конверсии по всем целям.
              </TableEmpty>
            )}
            {campaignTable.map(({ campaign, account, stats }) => (
              <TableRow key={campaign.id}>
                <TableCell className="max-w-xs">
                  <div className="font-medium text-neutral-900">
                    {campaign.name ?? "Без названия"}
                  </div>
                  {stats && stats.goals.length > 0 && (
                    <div className="text-xs text-neutral-500">
                      {stats.goals
                        .map(
                          (goal) =>
                            `${actionTypeLabel(goal.actionType)}: ${fmt(goal.count)}`,
                        )
                        .join(" · ")}
                    </div>
                  )}
                  {campaign.status && campaign.status !== "ACTIVE" && (
                    <div className="text-xs text-neutral-400">
                      статус: {campaign.status}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-neutral-600">
                  {campaign.project?.name ?? "— не привязана"}
                </TableCell>
                <TableCell className="text-neutral-500">
                  {account?.name ?? "—"}
                </TableCell>
                <TableCell>
                  {stats ? fmtMoney(stats.spend) : "—"}{" "}
                  <span className="text-xs text-neutral-400">
                    {account?.currency ?? ""}
                  </span>
                </TableCell>
                <TableCell className="text-neutral-600">
                  {stats?.primaryGoal
                    ? actionTypeLabel(stats.primaryGoal.actionType)
                    : "—"}
                </TableCell>
                <TableCell>
                  {stats?.primaryGoal ? fmt(stats.primaryGoal.count) : "—"}
                </TableCell>
                <TableCell>
                  {stats?.cpa === null || stats?.cpa === undefined
                    ? "—"
                    : fmtMoney(stats.cpa)}
                </TableCell>
                <TableCell className="text-neutral-500">
                  {fmtPercent(stats?.ctr ?? null)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
