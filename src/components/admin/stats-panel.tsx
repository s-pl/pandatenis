"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Stat = {
  label: string;
  /** Primary numeric/text value */
  value: ReactNode;
  /** Optional secondary text rendered next to the value (e.g. "alumnos", "ventas") */
  unit?: string;
  tone?: "neutral" | "primary" | "info" | "success" | "warning" | "danger" | "violet";
  icon?: ReactNode;
};

/**
 * Compact stats grid — Badgie's Finanzas summary panel. Four columns of
 * uppercase tiny label + bold value (+ small inline unit).
 */
export function StatsPanel({
  stats,
  columns = 4,
  className,
}: {
  stats: Stat[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:gap-x-6 sm:gap-y-4 sm:p-5",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "grid-cols-2 md:grid-cols-3",
        columns === 4 && "grid-cols-2 md:grid-cols-4",
        className,
      )}
    >
      {stats.map((s, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-1">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
            {s.icon && <span className="opacity-70">{s.icon}</span>}
            {s.label}
          </p>
          <p className="flex flex-wrap items-baseline gap-1.5">
            <span
              className={cn(
                "text-[1.05rem] font-bold leading-tight",
                s.tone === "primary" && "text-[var(--primary)]",
                s.tone === "info" && "text-[var(--info)]",
                s.tone === "success" && "text-[var(--success)]",
                s.tone === "warning" && "text-[var(--warning)]",
                s.tone === "danger" && "text-[var(--danger)]",
                s.tone === "violet" && "text-[#7c3aed]",
              )}
            >
              {s.value}
            </span>
            {s.unit && (
              <span className="text-[11.5px] font-medium text-[var(--muted)]">{s.unit}</span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
