# Explicit Yandex report attribution and bounded recovery

This patch retains the existing LC UI and imports LC as before. It additionally
collects seven verified Kolvika goals with **LSCCD** and six ESTT goals with
**AUTO**, using exact account, project and external-login identities in
`yandex-report-requirements.ts`. Models are never renamed or summed.

Required report goals are independent of UI visibility. Hidden purchase goal
`3071291494` is explicitly collected; `hidden` and `is_primary` remain untouched.
Other accounts keep their existing behavior. LC selection stays capped at 60
goals; each additional required-model request has at most seven goals.

## Manual recovery — not a schedule

After the exact PR commit is reviewed, merged and production is READY:

1. Save a read-only before snapshot of scoped conversion rows, metrics, goal
   settings and direction campaign lists. Verify fresh account identities.
2. Apply only `scripts/reconcile-kolvika-campaigns-20261031.sql`. It appends four
   verified campaign UUIDs to three existing directions, checks identities and
   conflicting assignments, and is safe to repeat. Brand campaign `715599027`
   stays unallocated. No new directions or goal settings are created.
3. In the existing owner session POST `/api/reports/yandex/backfill` with JSON
   containing **only** `accountId`, once for each account from the policy. Same-origin
   POST, a valid existing user session, active owner role and exact allowlist are
   required. No new key, token or persistent right is needed.
4. The server uses its existing account credential internally. The period is
   fixed to **2026-10-16 through 2026-10-29**; requests cannot expand it. Only
   required goals in LC and the account's required model are upserted, keyed by
   `(campaign_id,date,action_type)`. Metrics, campaigns, settings, older history
   and other accounts/actions are not written. No deletion or broad sync occurs.
5. Save the response as new audit evidence: exact model, goal IDs, period, raw
   Direct TSV and SHA256 are returned to the owner; no request headers or credentials
   are returned. Report rejection/missing columns fail instead of creating zeros.
6. Re-read the bounded rows and compare each required model/goal/campaign scope
   to the raw TSV and independent Direct reference. Compare before/after metrics
   and owner goal flags. Missing cells remain unmeasured; explicit API `--` in a
   requested conversion column is measured zero. Direct UI `–` is not interpreted
   as API zero without the API evidence.

Writes are batched and **not atomic across batches**. A failed request can mean
partial recovery. Safely retry the same account and re-read full coverage;
a successful HTTP response or a passing code test alone is not acceptance.

## Bound and release checks

Read-only inspection on 2026-10-31 found 107 Kolvika campaigns / 201 catalog goals
and 42 ESTT campaigns / 188 catalog goals; 64 and 77 campaign-day metric rows in
the recovery window. The conversion-only recovery upper bound is
`107 × 14 × 7 × 2 = 20,972` plus `42 × 14 × 6 × 2 = 7,056` rows, four Reports
requests total (one goal batch per model/account). Returned campaigns must already
belong to the exact approved account/project. All rows validate before the first
write. New mappings and conversion upserts are independently idempotent.

Check TypeScript, ESLint, all Vitest tests and production Webpack build; review
the exact diff against the fresh production SHA, exact-SHA CI and Vercel READY.
After release, inspect all active accounts' `last_sync_at` without changing
their schedules. Existing LC report consumers remain unchanged intentionally.

Unresolved ESTT penny differences are not corrected by changing spend. The
original ESTT employee-filled workbook, including its first two tabs, is outside
this patch and must remain untouched. No personal Jarvis, Telegram sends,
cron configuration, schema, RLS, credential, bid or budget change is included.

API contract: [report specification](https://yandex.ru/dev/direct/doc/en/spec)
documents explicit attribution and separate model columns. The parser fails if
the returned suffix differs from the requested model.
