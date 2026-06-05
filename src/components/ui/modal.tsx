"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";

type Tone = "neutral" | "primary" | "danger" | "warning" | "success";

const TONE_RING: Record<Tone, string> = {
  neutral: "var(--border)",
  primary: "var(--primary)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  success: "var(--success)",
};
const TONE_ICON_BG: Record<Tone, string> = {
  neutral: "var(--surface-muted)",
  primary: "var(--primary-soft)",
  danger: "var(--danger-soft)",
  warning: "var(--warning-soft)",
  success: "var(--success-soft)",
};
const TONE_ICON_FG: Record<Tone, string> = {
  neutral: "var(--muted)",
  primary: "var(--primary)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  success: "var(--success)",
};

/**
 * Modal mobile-first:
 *  - En móvil aparece como bottom-sheet con drag handle y se puede deslizar
 *    hacia abajo para cerrar.
 *  - En desktop es una tarjeta centrada con tope de altura.
 *  - Header sticky con borde sutil que aparece al hacer scroll.
 *  - Soporte opcional de icono + tono cromático para identificar el contexto.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  tone = "neutral",
  children,
  size = "md",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  footer?: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  const [scrolled, setScrolled] = useState(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (!node) return;
    const onScroll = () => setScrolled(node.scrollTop > 4);
    onScroll();
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      node.removeEventListener("scroll", onScroll);
      setScrolled(false);
    };
  }, [open]);

  const widths: Record<string, string> = {
    sm: "sm:max-w-md",
    md: "sm:max-w-xl",
    lg: "sm:max-w-3xl",
    xl: "sm:max-w-5xl",
    full: "sm:max-w-[min(96vw,1400px)]",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,30,22,0.55)] backdrop-blur-md sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <motion.div
            initial={
              reducedMotion ? { opacity: 0 } : { opacity: 0, y: 80, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reducedMotion ? { opacity: 0 } : { opacity: 0, y: 60, scale: 0.98 }
            }
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            drag={reducedMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 130 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              "relative flex h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[var(--surface)] shadow-[0_24px_64px_-16px_rgba(15,30,22,0.45)]",
              "sm:h-auto sm:max-h-[88vh] sm:rounded-2xl",
              "ring-1",
              widths[size],
            )}
            style={{
              // Borde de color cuando el tono es no-neutral, sutil siempre.
              ["--modal-ring" as string]: TONE_RING[tone],
              boxShadow:
                tone === "neutral"
                  ? undefined
                  : `0 0 0 1px ${TONE_RING[tone]}30, 0 24px 64px -16px rgba(15,30,22,0.45)`,
            }}
            onClick={(e) => e.stopPropagation()}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
          >
            {/* Drag handle (mobile only) — grande para invitar a deslizar */}
            <div className="flex flex-shrink-0 justify-center pt-2.5 pb-1 sm:hidden">
              <span
                className="h-1.5 w-12 rounded-full bg-[var(--border-strong)]"
                aria-hidden
              />
            </div>

            {(title || description || icon) && (
              <header
                className={cn(
                  "relative flex flex-shrink-0 items-start gap-3 bg-[var(--surface)] px-4 py-3 transition-shadow sm:px-6 sm:py-4",
                  scrolled
                    ? "shadow-[0_4px_12px_-8px_rgba(17,24,39,0.25)]"
                    : "",
                )}
              >
                {icon && (
                  <span
                    aria-hidden
                    className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl"
                    style={{
                      background: TONE_ICON_BG[tone],
                      color: TONE_ICON_FG[tone],
                    }}
                  >
                    {icon}
                  </span>
                )}
                <div className="min-w-0 flex-1 pt-0.5">
                  {title && (
                    <h2 id={titleId} className="text-[17px] font-bold leading-tight text-[var(--foreground)] sm:text-[18px]">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descId} className="mt-1 text-[13px] leading-snug text-[var(--muted)]">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] active:scale-95"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
            )}

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5"
              style={{
                paddingBottom: footer
                  ? undefined
                  : "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              }}
            >
              {children}
            </div>

            {footer && (
              <footer
                className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-3.5"
                style={{
                  paddingBottom:
                    "calc(env(safe-area-inset-bottom, 0px) + 12px)",
                }}
              >
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
