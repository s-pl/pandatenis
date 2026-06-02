import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------
   Friendly form fields — match the sunny system.
   Heavier border, warm cream surface, sun-coloured focus ring.
   ------------------------------------------------------------ */

const fieldBase =
  "w-full rounded-2xl border-2 border-[var(--forest)]/15 bg-[var(--cream-soft)] px-4 text-[15px] font-medium text-[var(--forest)] outline-none transition-colors placeholder:text-[var(--forest-mute)] placeholder:font-normal hover:border-[var(--forest)]/40 focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--sun-soft)] disabled:opacity-60 disabled:cursor-not-allowed";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, iconLeft, iconRight, ...props }, ref) => {
    if (iconLeft || iconRight) {
      return (
        <div className="relative">
          {iconLeft && (
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[var(--forest-mute)]">
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            className={cn(fieldBase, "h-12", iconLeft && "pl-11", iconRight && "pr-11", className)}
            {...props}
          />
          {iconRight && (
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[var(--forest-mute)]">
              {iconRight}
            </span>
          )}
        </div>
      );
    }
    return <input ref={ref} className={cn(fieldBase, "h-12", className)} {...props} />;
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "min-h-[112px] py-3 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(fieldBase, "h-12 appearance-none pr-11", className)}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[var(--forest-mute)]">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  ),
);
Select.displayName = "Select";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      {label && (
        <span className="text-[13px] font-extrabold text-[var(--forest)]">
          {label}
          {required && <span className="ml-1 text-[var(--coral)]">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--coral-deep)]">
          <span aria-hidden>⚠️</span>
          {error}
        </span>
      ) : hint ? (
        <span className="text-[12px] text-[var(--forest-mute)]">{hint}</span>
      ) : null}
    </label>
  );
}
