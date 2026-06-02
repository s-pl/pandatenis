import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {/* Accent bar — same pattern as page title, respects brand colors */}
        <span
          className="mt-0.5 block w-[3px] self-stretch rounded-full bg-[var(--accent)]"
          aria-hidden
        />
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold text-foreground sm:text-[15px]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--muted)]">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3 sm:px-5 sm:py-4",
        className,
      )}
      {...props}
    />
  );
}
