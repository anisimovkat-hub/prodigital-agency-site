type QueryError = { message: string };
type PageResult<T> = { data: T[] | null; error: QueryError | null };

/** PostgREST caps each response; a large range does not guarantee a complete dataset. */
export async function fetchCompleteQuery<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  label: string,
  maxRows = 100_000,
): Promise<PageResult<T>> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const result = await loadPage(offset, offset + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < pageSize) return { data: rows, error: null };
  }
  return { data: null, error: { message: `${label}: превышен предел полного отчёта. Сократите период.` } };
}
