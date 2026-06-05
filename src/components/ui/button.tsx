import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "accent";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

/**
 * Friendly bouncy button. Used across the wizard, login and admin.
 *
 *  - 2px forest border + flat drop shadow → matches the sunny system.
 *  - Hover lifts -2px, active resets.
 *  - Disabled keeps the border but mutes everything.
 *  - `focus-visible` halo from globals applies automatically.
 */

const base =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--forest)] font-extrabold tracking-tight transition-transform duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-[0_2px_0_var(--forest)] disabled:translate-y-0 disabled:hover:scale-100 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96]";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--grass)] text-white shadow-[0_4px_0_var(--forest)] hover:shadow-[0_6px_0_var(--forest)] active:shadow-[0_2px_0_var(--forest)]",
  accent:
    "bg-[var(--sun)] text-[var(--forest)] shadow-[0_4px_0_var(--forest)] hover:shadow-[0_6px_0_var(--forest)] active:shadow-[0_2px_0_var(--forest)]",
  secondary:
    "bg-[var(--cream-soft)] text-[var(--forest)] shadow-[0_4px_0_var(--forest)] hover:shadow-[0_6px_0_var(--forest)] active:shadow-[0_2px_0_var(--forest)]",
  ghost:
    "bg-transparent border-[var(--forest)] text-[var(--forest)] shadow-none hover:bg-[var(--cream-deep)] hover:translate-y-0",
  outline:
    "bg-transparent text-[var(--grass-deep)] border-[var(--grass)] shadow-[0_4px_0_var(--grass)] hover:bg-[var(--grass-soft)] hover:shadow-[0_6px_0_var(--grass)]",
  danger:
    "bg-[var(--danger)] text-white shadow-[0_4px_0_var(--forest)] hover:shadow-[0_6px_0_var(--forest)]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[12.5px]",
  md: "h-11 px-5 text-[13.5px]",
  lg: "h-12 px-6 text-[14.5px]",
  icon: "h-10 w-10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      iconLeft,
      iconRight,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && <Spinner />}
        {!loading && iconLeft}
        {children}
        {!loading && iconRight}
      </button>
    );
  },
);
Button.displayName = "Button";

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden
    />
  );
}
