"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";

/**
 * Panel lateral deslizante (desde la derecha). Alternativa al Modal para flujos
 * de “lista + detalle”: deja la lista visible al fondo. En móvil ocupa casi todo
 * el ancho. Cierra con Esc, click en el backdrop o el botón.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  widthClass = "sm:max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}) {
  const reduced = useReducedMotion();
  const dialogRef = useFocusTrap<HTMLElement>(open);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-[rgba(15,30,22,0.5)] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.aside
            initial={reduced ? { opacity: 0 } : { x: "100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            className={cn(
              "flex h-full w-full max-w-[92vw] flex-col bg-[var(--surface)] shadow-[var(--shadow-lg)]",
              widthClass,
            )}
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            {(title || description) && (
              <header className="flex flex-shrink-0 items-start gap-3 border-b border-[var(--border)] px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 id={titleId} className="text-[16px] font-bold leading-tight text-foreground">{title}</h2>
                  )}
                  {description && (
                    <p id={descId} className="mt-0.5 text-[12.5px] leading-snug text-[var(--muted)]">{description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>

            {footer && (
              <footer
                className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)]/70 px-4 py-3 sm:px-5"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
              >
                {footer}
              </footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
