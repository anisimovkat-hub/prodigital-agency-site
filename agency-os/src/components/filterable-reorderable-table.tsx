"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  GripVertical,
  X,
} from "lucide-react";
import {
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortDirection = "asc" | "desc";
type SortState<Id extends string> = { column: Id; direction: SortDirection };
type TableValue = string | number | null;

export type FilterableTableColumn<Row, Id extends string> = {
  id: Id;
  label: string;
  cell: (row: Row) => ReactNode;
  sortValue: (row: Row) => TableValue;
  filterValue?: (row: Row) => string | null;
  initialSortDirection?: SortDirection;
  className?: string;
};

type FilterableReorderableTableProps<Row, Id extends string> = {
  columns: readonly FilterableTableColumn<Row, Id>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  storageKey: string;
  emptyText?: string;
  minWidthClassName?: string;
};

export function FilterableReorderableTable<Row, Id extends string>({
  columns,
  rows,
  rowKey,
  storageKey,
  emptyText = "По выбранным фильтрам ничего не найдено.",
  minWidthClassName,
}: FilterableReorderableTableProps<Row, Id>) {
  const defaultOrder = useMemo(() => columns.map((column) => column.id), [columns]);
  const [columnOrder, setColumnOrder] = useState<Id[]>(defaultOrder);
  const [sort, setSort] = useState<SortState<Id> | null>(null);
  const [filters, setFilters] = useState<Partial<Record<Id, string[]>>>({});
  const [draggedColumn, setDraggedColumn] = useState<Id | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Id | null>(null);

  useEffect(() => {
    function loadOrder() {
      try {
        const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
        setColumnOrder(normalizeOrder(saved, defaultOrder));
      } catch {
        setColumnOrder(defaultOrder);
      }
    }

    loadOrder();
    window.addEventListener("storage", loadOrder);
    window.addEventListener(`${storageKey}:changed`, loadOrder);
    return () => {
      window.removeEventListener("storage", loadOrder);
      window.removeEventListener(`${storageKey}:changed`, loadOrder);
    };
  }, [defaultOrder, storageKey]);

  const columnsById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  );
  const orderedColumns = columnOrder.flatMap((id) => {
    const column = columnsById.get(id);
    return column ? [column] : [];
  });
  const filterOptions = useMemo(() => {
    const options = new Map<Id, string[]>();
    for (const column of columns) {
      if (!column.filterValue) continue;
      const values = new Set(rows.map((row) => column.filterValue?.(row) ?? ""));
      options.set(column.id, [...values].sort((a, b) => a.localeCompare(b, "ru")));
    }
    return options;
  }, [columns, rows]);
  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        (Object.entries(filters) as Array<[Id, string[] | undefined]>).every(([columnId, selectedValues]) => {
          if (!selectedValues?.length) return true;
          const column = columnsById.get(columnId);
          return selectedValues.includes(column?.filterValue?.(row) ?? "");
        }),
      ),
    [columnsById, filters, rows],
  );
  const visibleRows = useMemo(
    () => sortRows(filteredRows, sort, columnsById),
    [columnsById, filteredRows, sort],
  );
  const activeFilterCount = Object.values(
    filters as Partial<Record<string, string[]>>,
  ).filter((values) => values?.length).length;

  function toggleSort(column: FilterableTableColumn<Row, Id>) {
    setSort((current) => {
      if (current?.column !== column.id) {
        return {
          column: column.id,
          direction: column.initialSortDirection ?? "asc",
        };
      }
      return {
        column: column.id,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  }

  function updateFilter(column: Id, value: string) {
    setFilters((current) => {
      const selected = current[column] ?? [];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      return { ...current, [column]: next };
    });
  }

  function persistOrder(nextOrder: Id[]) {
    setColumnOrder(nextOrder);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextOrder));
      window.dispatchEvent(new Event(`${storageKey}:changed`));
    } catch {
      // The order still changes in the current tab if local storage is unavailable.
    }
  }

  function moveColumn(source: Id, target: Id) {
    if (source === target) return;
    const sourceIndex = columnOrder.indexOf(source);
    const targetIndex = columnOrder.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...columnOrder];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    persistOrder(next);
  }

  function handleDrop(event: DragEvent<HTMLTableCellElement>, target: Id) {
    event.preventDefault();
    const source = (draggedColumn ?? event.dataTransfer.getData("text/plain")) as Id;
    if (columnOrder.includes(source)) moveColumn(source, target);
    setDraggedColumn(null);
    setDragOverColumn(null);
  }

  function handleMoveKeyDown(event: KeyboardEvent<HTMLSpanElement>, column: Id) {
    if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const index = columnOrder.indexOf(column);
    const target = columnOrder[event.key === "ArrowLeft" ? index - 1 : index + 1];
    if (target) moveColumn(column, target);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <p>
          Нажмите на название столбца для сортировки. Отфильтруйте по значку
          воронки. Потяните за <GripVertical className="inline size-3.5 align-[-3px]" aria-hidden />, чтобы изменить порядок.
        </p>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="size-3.5" aria-hidden /> Сбросить фильтры ({activeFilterCount})
          </button>
        )}
      </div>

      <Table className={cn("min-w-[760px]", minWidthClassName)}>
        <TableHeader>
          <TableRow>
            {orderedColumns.map((column) => (
              <TableHead
                key={column.id}
                aria-sort={ariaSort(sort, column.id)}
                className={cn(
                  "transition-colors",
                  column.className,
                  dragOverColumn === column.id && "bg-blue-50",
                )}
                onDragEnter={() => setDragOverColumn(column.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => handleDrop(event, column.id)}
              >
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-1 rounded px-0.5 py-1 text-left hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                    onClick={() => toggleSort(column)}
                  >
                    <span>{column.label}</span>
                    <SortIcon sort={sort} column={column.id} />
                  </button>
                  {column.filterValue && (
                    <ColumnFilter
                      column={column}
                      options={filterOptions.get(column.id) ?? []}
                      selected={filters[column.id] ?? []}
                      onToggle={updateFilter}
                    />
                  )}
                  <span
                    draggable
                    role="button"
                    tabIndex={0}
                    aria-label={`Переместить столбец «${column.label}». Alt + стрелка влево или вправо`}
                    title="Перетащить столбец"
                    className="cursor-grab rounded p-0.5 text-neutral-300 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 active:cursor-grabbing"
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", column.id);
                      setDraggedColumn(column.id);
                    }}
                    onDragEnd={() => {
                      setDraggedColumn(null);
                      setDragOverColumn(null);
                    }}
                    onKeyDown={(event) => handleMoveKeyDown(event, column.id)}
                  >
                    <GripVertical className="size-3.5" aria-hidden />
                  </span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.length === 0 && <TableEmpty colSpan={orderedColumns.length}>{emptyText}</TableEmpty>}
          {visibleRows.map((row) => (
            <TableRow key={rowKey(row)}>
              {orderedColumns.map((column) => (
                <TableCell key={column.id} className={column.className}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ColumnFilter<Row, Id extends string>({
  column,
  options,
  selected,
  onToggle,
}: {
  column: FilterableTableColumn<Row, Id>;
  options: string[];
  selected: string[];
  onToggle: (column: Id, value: string) => void;
}) {
  return (
    <details className="relative">
      <summary
        className={cn(
          "flex cursor-pointer list-none rounded p-1 text-neutral-300 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 [&::-webkit-details-marker]:hidden",
          selected.length > 0 && "bg-blue-50 text-blue-600",
        )}
        aria-label={`Фильтр «${column.label}»`}
        title={`Фильтр «${column.label}»`}
      >
        <Filter className="size-3.5" aria-hidden />
      </summary>
      <div className="absolute left-0 z-30 mt-1 w-60 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <span className="text-xs font-medium text-neutral-700">{column.label}</span>
          {selected.length > 0 && (
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => selected.forEach((value) => onToggle(column.id, value))}
            >
              Очистить
            </button>
          )}
        </div>
        <div className="max-h-60 space-y-0.5 overflow-y-auto">
          {options.map((value) => (
            <label
              key={value || "__empty"}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-neutral-50"
            >
              <Checkbox
                checked={selected.includes(value)}
                onChange={() => onToggle(column.id, value)}
              />
              <span className="truncate">{value || "Не заполнено"}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}

function SortIcon<Id extends string>({
  sort,
  column,
}: {
  sort: SortState<Id> | null;
  column: Id;
}) {
  if (sort?.column !== column) return <ArrowUpDown className="size-3.5 text-neutral-300" aria-hidden />;
  return sort.direction === "asc"
    ? <ArrowUp className="size-3.5" aria-hidden />
    : <ArrowDown className="size-3.5" aria-hidden />;
}

function ariaSort<Id extends string>(sort: SortState<Id> | null, column: Id) {
  if (sort?.column !== column) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function normalizeOrder<Id extends string>(value: unknown, defaultOrder: Id[]): Id[] {
  if (!Array.isArray(value) || value.length !== defaultOrder.length) return defaultOrder;
  const allowed = new Set(defaultOrder);
  return value.every((item) => typeof item === "string" && allowed.has(item as Id)) && new Set(value).size === defaultOrder.length
    ? value as Id[]
    : defaultOrder;
}

function sortRows<Row, Id extends string>(
  rows: Row[],
  sort: SortState<Id> | null,
  columns: Map<Id, FilterableTableColumn<Row, Id>>,
) {
  if (!sort) return rows;
  const column = columns.get(sort.column);
  if (!column) return rows;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const result = compareValues(column.sortValue(left.row), column.sortValue(right.row));
      return result === 0 ? left.index - right.index : sort.direction === "asc" ? result : -result;
    })
    .map(({ row }) => row);
}

function compareValues(left: TableValue, right: TableValue) {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "ru");
}
