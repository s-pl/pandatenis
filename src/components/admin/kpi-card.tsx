"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const toneStyles: Record<
  string,
  { bar: string; icon: string; delta: string }
> = {
  primary: {
    bar: "bg-[var(--primary)]",
    icon: "text-[var(--primary)]",
    delta: "text-[var(--primary)]",
  },
  accent: {
    bar: "bg-[var(--accent)]",
    icon: "text-[var(--accent-foreground)]",
    delta: "text-[var(--orange)]",
  },
  info: {
    bar: "bg-[var(--info)]",
    icon: "text-[var(--info)]",
    delta: "text-[var(--info)]",
  },
  success: {
    bar: "bg-[var(--success)]",
    icon: "text-[var(--success)]",
    delta: "text-[var(--success)]",
  },
  warning: {
    bar: "bg-[var(--warning)]",
    icon: "text-[var(--warning)]",
    delta: "text-[var(--warning)]",
  },
};

export function KpiCard({
  label,
  value,
  hint,
  icon,
  delta,
  tone = "primary",
  index = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  delta?: { value: string; positive?: boolean };
  tone?: "primary" | "accent" | "info" | "success" | "warning";
  index?: number;
}) {
  const styles = toneStyles[tone] ?? toneStyles.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.04 * index }}
      className="relative flex flex-col gap-2.5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] sm:gap-3 sm:p-5"
    >
      {/* Accent bar at top */}
      <span className={cn("absolute left-0 top-0 h-[3px] w-full", styles.bar)} aria-hidden />

      <div className="flex items-start justify-between gap-2 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {label}
        </p>
        {icon && (
          <span className={cn("opacity-50", styles.icon)}>{icon}</span>
        )}
      </div>

      <p className="text-[2rem] font-bold leading-none tracking-tight text-foreground">
        {value}
      </p>

      {hint && (
        <p className="hidden text-[11px] text-[var(--muted)] sm:block">{hint}</p>
      )}

      {delta && (
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "font-semibold",
              delta.positive ? "text-[var(--success)]" : "text-[var(--danger)]",
            )}
          >
            {delta.positive ? "↑" : "↓"} {delta.value}
          </span>
          <span className="hidden text-[var(--muted)] sm:inline">vs. mes anterior</span>
        </div>
      )}
    </motion.div>
  );
}
