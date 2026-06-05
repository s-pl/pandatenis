"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Stagger, StaggerItem } from "@/components/ui/motion";

export function PageShell({
  title,
  description,
  actions,
  meta,
  media,
  children,
  variant = "plain",
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  /** Visual element rendered before the title (e.g. avatar, large icon) */
  media?: ReactNode;
  children: ReactNode;
  /**
   * `plain` (default): white background, title with yellow left accent bar.
   *
   * `tinted`: title and description inside a light-yellow tinted card (Badgie's
   * "Gestión de Profesores" style).
   */
  variant?: "plain" | "tinted";
  className?: string;
}) {
  const hasMedia = Boolean(media);
  return (
    <Stagger className={cn("flex flex-col gap-4", className)} stagger={0.08}>
      <StaggerItem
        className={cn(
          "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between",
          variant === "tinted" &&
            "rounded-xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/60 p-4 sm:p-5",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-start gap-4",
            variant === "plain" && !hasMedia && "border-l-[4px] border-[var(--accent)] pl-4",
          )}
        >
          {media && <div className="flex-shrink-0">{media}</div>}
          <div className="min-w-0">
            <h1 className="text-[1.35rem] font-bold leading-tight tracking-tight text-foreground sm:text-[1.5rem]">
              {title}
            </h1>
            {description && (
              <p className="mt-1 max-w-2xl text-[12.5px] leading-snug text-[var(--muted)] sm:text-[13.5px]">
                {description}
              </p>
            )}
            {meta && <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">{meta}</div>}
          </div>
        </div>

        {actions && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </StaggerItem>

      <StaggerItem className="flex flex-col gap-4">{children}</StaggerItem>
    </Stagger>
  );
}
