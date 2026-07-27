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
import { createClient } from "@/lib/supabase/server";

type AdAccountRow = {
  id: string;
  name: string | null;
  external_id: string;
  currency: string | null;
  project: { name: string } | null;
};

function fmt(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
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

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);

  const [{ data: accounts }, { data: metrics }] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select("id,name,external_id,currency, project:projects(name)")
      .eq("platform", "meta")
      .order("name"),
    supabase
      .from("ad_metrics")
      .select("ad_account_id,spend,leads,date")
      .gte("date", sinceISO),
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Реклама (Meta)</h1>
        <p className="text-sm text-neutral-500">
          Статистика по рекламным кабинетам за последние 30 дней. Валюта расхода
          зависит от кабинета. Данные обновляются кнопкой ниже (позже — автоматически).
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <SyncMetaButton />
      </div>

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
    </div>
  );
}
