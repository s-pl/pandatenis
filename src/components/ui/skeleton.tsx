import { cn } from "@/lib/utils";

/** Bloque base con shimmer. El resto de variantes se componen sobre este. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gradient-to-r from-[var(--surface-muted)] via-[var(--border)] to-[var(--surface-muted)] bg-[length:200%_100%]",
        className,
      )}
      style={{ animation: "skeleton 1.4s ease-in-out infinite" }}
    />
  );
}

/** Varias líneas de texto de ancho decreciente. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5 rounded-md"
          // última línea más corta
        />
      ))}
    </div>
  );
}

/** Rejilla de tarjetas KPI (como el dashboard / cabeceras de sección). */
export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5"
        >
          <Skeleton className="h-3 w-2/3 rounded-md" />
          <Skeleton className="h-7 w-1/2 rounded-md" />
          <Skeleton className="hidden h-3 w-3/4 rounded-md sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Tarjeta genérica con cabecera + cuerpo. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5",
        className,
      )}
    >
      <Skeleton className="h-4 w-1/3 rounded-md" />
      <SkeletonText lines={3} />
    </div>
  );
}

/** Lista/tabla: cabecera + N filas. */
export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 px-5 py-3">
        <Skeleton className="h-3 w-40 rounded-md" />
      </div>
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-1/3 rounded-md" />
              <Skeleton className="h-3 w-1/4 rounded-md" />
            </div>
            <Skeleton className="h-6 w-16 flex-shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Marco de gráfica. */
export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5",
        className,
      )}
    >
      <Skeleton className="mb-4 h-3 w-32 rounded-md" />
      <Skeleton className="h-44 w-full rounded-lg" />
    </div>
  );
}

/** Cabecera de página (PageShell) mientras carga. */
export function SkeletonPageHeader() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-56 rounded-lg" />
      <Skeleton className="h-4 w-80 max-w-full rounded-md" />
    </div>
  );
}
