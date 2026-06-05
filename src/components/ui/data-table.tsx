"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { DropdownItem, DropdownMenu } from "@/components/ui/dropdown-menu";
import { downloadCsv } from "@/lib/admin/export-csv";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  label: string;
  /** Render the cell content */
  render: (row: T) => ReactNode;
  /** Sort accessor — return a comparable primitive */
  sortAccessor?: (row: T) => string | number | null | undefined;
  /** Plain value for CSV export (fallback: sortAccessor) */
  exportValue?: (row: T) => string | number | null | undefined;
  /** Column width: any valid grid template value (e.g. "1fr", "auto", "120px") */
  width?: string;
  /** Hide on small screens (still hides at md breakpoint inside the desktop table) */
  hideOnMobile?: boolean;
  /** Oculta la columna por defecto (toggleable desde el menú de columnas) */
  defaultHidden?: boolean;
  /** Align cell content */
  align?: "left" | "right" | "center";
};

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** When provided, an active row gets the yellow left-border highlight (Badgie style) */
  isActiveRow?: (row: T) => boolean;
  /** Click handler for rows */
  onRowClick?: (row: T) => void;
  /** Initial sort */
  defaultSort?: { key: string; direction: "asc" | "desc" };
  /** Rows per page options */
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  /** Element rendered when data is empty */
  emptyState?: ReactNode;
  /** Mobile-only card renderer. */
  mobileCard?: (row: T) => ReactNode;
  className?: string;
  /** Densidad de las filas. */
  density?: "comfortable" | "compact";
  /** Cabecera fija al hacer scroll (sticky bajo la topbar). */
  stickyHeader?: boolean;
  /** Muestra el menú de columnas visibles. */
  enableColumnToggle?: boolean;
  /** Nombre de archivo para activar el botón "Exportar CSV". */
  exportFilename?: string;
  /** Contenido extra a la derecha de la barra de herramientas. */
  toolbarRight?: ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  isActiveRow,
  onRowClick,
  defaultSort,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 25,
  emptyState,
  mobileCard,
  className,
  density = "comfortable",
  stickyHeader = false,
  enableColumnToggle = false,
  exportFilename,
  toolbarRight,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenKeys.has(c.key)),
    [columns, hiddenKeys],
  );

  const gridTemplate = useMemo(
    () => visibleColumns.map((c) => c.width ?? "1fr").join(" "),
    [visibleColumns],
  );

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortAccessor) return data;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = col.sortAccessor!(a);
      const vb = col.sortAccessor!(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [data, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  function handleSort(col: Column<T>) {
    if (!col.sortAccessor) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, direction: "asc" };
      if (prev.direction === "asc") return { key: col.key, direction: "desc" };
      return undefined;
    });
  }

  function toggleColumn(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExport() {
    if (!exportFilename) return;
    const cols = visibleColumns.filter((c) => c.label);
    const header = cols.map((c) => c.label);
    const body = sorted.map((row) =>
      cols.map((c) => {
        const v = c.exportValue?.(row) ?? c.sortAccessor?.(row);
        return v == null ? "" : v;
      }),
    );
    downloadCsv(exportFilename, [header, ...body]);
  }

  const rowPadY = density === "compact" ? "py-2" : "py-3.5";
  const headerPadY = density === "compact" ? "py-2" : "py-2.5";
  const toolbarVisible = enableColumnToggle || exportFilename || toolbarRight;
  const toggleableColumns = columns.filter((c) => c.label);

  if (data.length === 0 && emptyState && !toolbarVisible) return <>{emptyState}</>;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {toolbarVisible && (
        <div className="flex items-center justify-end gap-2">
          {toolbarRight}
          {enableColumnToggle && (
            <DropdownMenu
              align="end"
              triggerLabel="Columnas"
              triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12.5px] font-medium text-[var(--muted)] transition-colors hover:text-foreground"
              trigger={
                <>
                  <Columns3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Columnas</span>
                </>
              }
            >
              {toggleableColumns.map((c) => {
                const visible = !hiddenKeys.has(c.key);
                return (
                  <DropdownItem
                    key={c.key}
                    icon={visible ? <Check className="h-4 w-4 text-[var(--primary)]" /> : <span />}
                    onSelect={() => toggleColumn(c.key)}
                    closeOnSelect={false}
                  >
                    {c.label}
                  </DropdownItem>
                );
              })}
            </DropdownMenu>
          )}
          {exportFilename && (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12.5px] font-medium text-[var(--muted)] transition-colors hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          )}
        </div>
      )}

      {data.length === 0 && emptyState ? (
        <>{emptyState}</>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {/* ── Desktop header (md+) ───────────────────────────────── */}
          <div
            className={cn(
              "hidden items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)]/60 px-5 md:grid",
              headerPadY,
              stickyHeader && "sticky top-14 z-10",
            )}
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {visibleColumns.map((col) => {
              const isSorted = sort?.key === col.key;
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => handleSort(col)}
                  disabled={!col.sortAccessor}
                  className={cn(
                    "group flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] transition-colors",
                    col.sortAccessor && "cursor-pointer hover:text-foreground",
                    col.hideOnMobile && "hidden lg:flex",
                    col.align === "right" && "justify-end",
                    col.align === "center" && "justify-center",
                  )}
                >
                  <span>{col.label}</span>
                  {col.sortAccessor && (
                    <span className="text-[var(--border-strong)] group-hover:text-foreground">
                      {isSorted ? (
                        sort?.direction === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Rows ───────────────────────────────────────────────── */}
          <div>
            {paginated.map((row, i) => {
              const active = isActiveRow?.(row) ?? false;
              const key = rowKey(row);
              return (
                <div
                  key={key}
                  className="dt-row-in relative"
                  style={{ animationDelay: `${Math.min(i, 14) * 0.03}s` }}
                >
                  {active && (
                    <span
                      className="absolute inset-y-0 left-0 z-10 w-[3px] bg-[var(--accent)]"
                      aria-hidden
                    />
                  )}

                  {/* Desktop grid row */}
                  <div
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "hidden items-center gap-3 border-b border-[var(--border)] px-5 transition-colors last:border-b-0 md:grid",
                      rowPadY,
                      onRowClick && "cursor-pointer",
                      "hover:bg-[var(--surface-muted)]/60",
                    )}
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {visibleColumns.map((col) => (
                      <div
                        key={col.key}
                        className={cn(
                          "min-w-0 text-sm text-foreground/90",
                          col.hideOnMobile && "hidden lg:block",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                        )}
                      >
                        {col.render(row)}
                      </div>
                    ))}
                  </div>

                  {/* Mobile card row */}
                  <div
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "block border-b border-[var(--border)] px-4 py-3.5 transition-colors last:border-b-0 md:hidden",
                      onRowClick && "cursor-pointer active:bg-[var(--surface-muted)]",
                    )}
                  >
                    {mobileCard ? (
                      mobileCard(row)
                    ) : (
                      <div className="flex flex-col gap-2">
                        {visibleColumns
                          .filter((c) => c.key !== "actions" && c.label)
                          .map((col) => (
                            <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                              <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                                {col.label}
                              </span>
                              <div className="text-right">{col.render(row)}</div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Pagination footer ──────────────────────────────────── */}
          <div className="flex flex-col items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)]/40 px-4 py-2.5 text-[12.5px] sm:flex-row sm:px-5">
            <p className="text-[var(--muted)]">
              {sorted.length} {sorted.length === 1 ? "fila" : "filas"}
            </p>

            <div className="flex items-center gap-3 sm:gap-4">
              <label className="hidden items-center gap-2 text-[var(--muted)] sm:flex">
                Por página:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12.5px] font-medium text-foreground"
                >
                  {pageSizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-[var(--muted)]">
                  <span className="font-semibold text-foreground">{currentPage}</span>
                  <span className="mx-1">/</span>
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="grid h-9 w-9 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="grid h-9 w-9 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7"
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
