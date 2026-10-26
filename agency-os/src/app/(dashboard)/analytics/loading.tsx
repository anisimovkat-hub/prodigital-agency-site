/** Shown instantly while the server prepares analytics, so navigation never looks frozen. */
export default function AnalyticsLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Загружаем аналитику">
      <div className="h-16 animate-pulse rounded-xl border border-neutral-200 bg-white" />
      <div className="flex gap-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-8 w-24 animate-pulse rounded-full bg-neutral-100" />)}</div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        {Array.from({ length: 10 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl border border-neutral-200 bg-white" />)}
      </div>
      <p className="text-sm text-neutral-500">Загружаем аналитику…</p>
    </div>
  );
}
