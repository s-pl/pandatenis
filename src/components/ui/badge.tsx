import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--surface-muted)] text-foreground border-[var(--border)]",
  primary: "bg-[var(--primary-soft)] text-[var(--primary)] border-[#cfe3c2]",
  success: "bg-[var(--success-soft)] text-[var(--success)] border-[#c6e6c0]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-[#f1d9a8]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)] border-[#f1c5c5]",
  info: "bg-[var(--info-soft)] text-[var(--info)] border-[#cfdcef]",
  accent: "bg-[#fef0d2] text-[var(--accent-foreground)] border-[#f1d495]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  iconLeft?: ReactNode;
}

export function Badge({ className, tone = "neutral", iconLeft, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {iconLeft}
      {children}
    </span>
  );
}
