"use client";

import { Wallet, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal summary banner — Badgie's signature dashboard widget.
 * On mobile the items wrap onto multiple rows.
 */
export function DashboardSummary({
  period,
  items,
  className,
}: {
  period: string;
  items: Array<{
    label: string;
    value: string;
    tone?: "neutral" | "success" | "warning" | "danger" | "primary";
  }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 pl-4 pr-3 shadow-[var(--shadow-sm)] sm:pl-5 sm:pr-4",
        className,
      )}
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-xl bg-[var(--accent)]"
        aria-hidden
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-[var(--surface-muted)] text-[var(--muted)]">
          <Wallet className="h-3.5 w-3.5" />
        </span>

        <span className="text-[13px] font-bold text-foreground">{period}</span>

        <ChevronRight className="h-3 w-3 flex-shrink-0 text-[var(--border-strong)]" />

        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          {items.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="hidden text-[var(--border-strong)] sm:inline">·</span>}
              <span className="text-[var(--muted)]">{item.label}</span>
              <span
                className={cn(
                  "font-bold",
                  item.tone === "success" && "text-[var(--success)]",
                  item.tone === "warning" && "text-[var(--warning)]",
                  item.tone === "danger" && "text-[var(--danger)]",
                  item.tone === "primary" && "text-[var(--primary)]",
                )}
              >
                {item.value}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
