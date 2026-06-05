"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatChip = {
  label: string;
  value: ReactNode;
  /** Color of the value text */
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "info";
};

/**
 * Badgie's signature dashboard row card: yellow left border, title with icon,
 * inline stats on the right, expandable body. Each section on Badgie's main
 * dashboard uses this exact pattern.
 */
export function ExpandableSection({
  title,
  icon,
  stats,
  rightAccessory,
  defaultExpanded = false,
  highlight = false,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  stats?: StatChip[];
  /** Extra controls on the right (e.g. quick-action icons) */
  rightAccessory?: ReactNode;
  defaultExpanded?: boolean;
  /** Soft yellow background to highlight a section */
  highlight?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const expandable = Boolean(children);

  return (
    <section
      className={cn(
        "relative rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]",
        highlight && "bg-[var(--accent-soft)]/40",
        className,
      )}
    >
      {/* Yellow left accent bar */}
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-xl bg-[var(--accent)]"
        aria-hidden
      />

      {/* Header — mobile-first: title row on top, stats below; on sm+ they sit inline */}
      <button
        type="button"
        onClick={() => expandable && setExpanded((v) => !v)}
        disabled={!expandable}
        aria-expanded={expandable ? expanded : undefined}
        className={cn(
          "flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:gap-3 sm:px-5 sm:py-3.5",
          expandable && "cursor-pointer hover:bg-[var(--surface-muted)]/40 active:bg-[var(--surface-muted)]",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:justify-start">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
            {icon && <span className="text-foreground/70">{icon}</span>}
            {expandable && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 flex-shrink-0 text-[var(--muted)] transition-transform",
                  expanded ? "rotate-180" : "-rotate-90",
                )}
              />
            )}
          </div>

          {rightAccessory && (
            <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 sm:hidden">
              {rightAccessory}
            </div>
          )}
        </div>

        {/* Stats — wrap onto new line on mobile */}
        {stats && stats.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
            {stats.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[var(--border-strong)]">·</span>}
                <span className="text-[var(--muted)]">{s.label}</span>
                <span
                  className={cn(
                    "font-bold",
                    s.tone === "primary" && "text-[var(--primary)]",
                    s.tone === "success" && "text-[var(--success)]",
                    s.tone === "warning" && "text-[var(--warning)]",
                    s.tone === "danger" && "text-[var(--danger)]",
                    s.tone === "info" && "text-[var(--info)]",
                  )}
                >
                  {s.value}
                </span>
              </span>
            ))}
          </div>
        )}

        {rightAccessory && (
          <div onClick={(e) => e.stopPropagation()} className="hidden items-center gap-1 sm:flex">
            {rightAccessory}
          </div>
        )}
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {expandable && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * Inline simple row inside an action list — Badgie's "Crear Info Badge",
 * "Enviar Insignia", etc. style.
 */
export function ActionRow({
  icon,
  label,
  href,
  onClick,
  highlight = false,
}: {
  icon?: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const className = cn(
    "flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13.5px] font-medium text-foreground/85 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 hover:text-foreground",
    highlight && "border-[var(--accent)] bg-[var(--accent-soft)]/50",
  );
  const content = (
    <>
      {icon && <span className="text-foreground/60">{icon}</span>}
      <span className="flex-1">{label}</span>
    </>
  );
  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
