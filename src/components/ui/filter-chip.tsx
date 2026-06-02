"use client";

import { Plus, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  label: string;
  value?: ReactNode;
  active?: boolean;
  onClear?: () => void;
}

/**
 * Outlined dashed chip button — Badgie's signature filter pattern.
 * When `value` is provided, shows the active filter with a clear (×) action.
 */
export function FilterChip({
  label,
  value,
  active,
  onClear,
  className,
  ...props
}: FilterChipProps) {
  const isActive = active ?? !!value;
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-all",
        isActive
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-foreground"
          : "border-dashed border-[var(--border-strong)] bg-[var(--surface)] text-foreground/75 hover:border-[var(--accent)] hover:text-foreground",
        className,
      )}
      {...props}
    >
      {!isActive && <Plus className="h-3.5 w-3.5" />}
      <span>{label}</span>
      {isActive && value && (
        <>
          <span className="mx-0.5 h-3 w-[1px] bg-[var(--border-strong)]" />
          <span className="font-semibold">{value}</span>
        </>
      )}
      {isActive && onClear && (
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="ml-0.5 grid h-4 w-4 cursor-pointer place-items-center rounded-full hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
        >
          <X className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
