"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { wrap: string; icon: ReactNode }> = {
  info: {
    wrap: "border-[var(--info)]/25 bg-[var(--info-soft)] text-[var(--info)]",
    icon: <Info className="h-4 w-4" />,
  },
  success: {
    wrap: "border-[var(--success)]/25 bg-[var(--success-soft)] text-[var(--success)]",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  warning: {
    wrap: "border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  danger: {
    wrap: "border-[var(--danger)]/25 bg-[var(--danger-soft)] text-[var(--danger)]",
    icon: <XCircle className="h-4 w-4" />,
  },
};

/**
 * Aviso inline descartable. Para mensajes contextuales dentro de una página
 * (no usa toast). Reutiliza los tonos del sistema.
 */
export function Alert({
  tone = "info",
  title,
  children,
  dismissible = false,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  dismissible?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const t = TONES[tone];
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-[13px]",
        t.wrap,
        className,
      )}
    >
      <span className="mt-0.5 flex-shrink-0">{t.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold leading-snug">{title}</p>}
        {children && <div className={cn("leading-snug", title && "mt-0.5 opacity-90")}>{children}</div>}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Descartar"
          className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full transition-colors hover:bg-black/5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
