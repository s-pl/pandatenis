"use client";

import { useRef, useLayoutEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem = {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
};

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  // Recalculate yellow progress-bar position
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLElement>(`[data-tab="${value}"]`);
    if (!activeBtn) return;
    const rect = activeBtn.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    setIndicator({ left: rect.left - cRect.left, width: rect.width });
  }, [value, items]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={containerRef}
        role="tablist"
        className="no-scrollbar flex items-center gap-1 overflow-x-auto pb-2"
      >
        {items.map((item, idx) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              data-tab={item.value}
              onClick={() => onChange(item.value)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const dir = e.key === "ArrowRight" ? 1 : -1;
                const next = (idx + dir + items.length) % items.length;
                onChange(items[next].value);
                const container = containerRef.current;
                container
                  ?.querySelector<HTMLElement>(`[data-tab="${items[next].value}"]`)
                  ?.focus();
              }}
              className={cn(
                "inline-flex h-9 flex-shrink-0 items-center gap-2 rounded-lg px-3.5 text-[13.5px] font-semibold transition-all",
                active
                  ? "bg-foreground text-[var(--surface)] shadow-[var(--shadow-sm)]"
                  : "text-foreground/65 hover:bg-[var(--surface-muted)] hover:text-foreground",
              )}
            >
              {item.icon && <span className={cn(active ? "" : "opacity-70")}>{item.icon}</span>}
              <span>{item.label}</span>
              {typeof item.count === "number" && (
                <span
                  className={cn(
                    "ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    active ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--surface-muted)] text-[var(--muted)]",
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Yellow / gray progress bar — Badgie signature */}
      <div className="relative h-[3px] w-full rounded-full bg-[var(--surface-muted)]">
        {indicator && (
          <span
            className="absolute top-0 h-[3px] rounded-full bg-[var(--accent)] transition-all duration-300"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}
      </div>
    </div>
  );
}
