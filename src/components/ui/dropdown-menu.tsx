"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Menú desplegable accesible y a medida (sin dependencias). Se ancla al trigger,
 * cierra al hacer click fuera o con Esc, y anima con framer-motion como el resto
 * del sistema. Úsalo para el menú de perfil, la campana de actividad o el
 * selector de columnas de las tablas.
 */

const MenuContext = createContext<{ close: () => void } | null>(null);

export function DropdownMenu({
  trigger,
  triggerClassName,
  triggerLabel,
  align = "end",
  menuClassName,
  children,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  align?: "start" | "end";
  menuClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        className={triggerClassName}
      >
        {trigger}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className={cn(
              "absolute z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-lg)]",
              align === "end" ? "right-0" : "left-0",
              menuClassName,
            )}
          >
            <MenuContext.Provider value={{ close: () => setOpen(false) }}>
              {children}
            </MenuContext.Provider>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownItem({
  children,
  icon,
  onSelect,
  href,
  tone = "neutral",
  closeOnSelect = true,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  href?: string;
  tone?: "neutral" | "danger";
  closeOnSelect?: boolean;
}) {
  const ctx = useContext(MenuContext);
  const className = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors",
    tone === "danger"
      ? "text-[var(--danger)] hover:bg-[var(--danger-soft)]"
      : "text-foreground hover:bg-[var(--surface-muted)]",
  );
  const content = (
    <>
      {icon && <span className="grid h-4 w-4 flex-shrink-0 place-items-center text-[var(--muted)]">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
    </>
  );
  function handle() {
    onSelect?.();
    if (closeOnSelect) ctx?.close();
  }
  if (href) {
    return (
      <a href={href} role="menuitem" className={className} onClick={handle}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" role="menuitem" className={className} onClick={handle}>
      {content}
    </button>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
      {children}
    </p>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-[var(--border)]" />;
}
