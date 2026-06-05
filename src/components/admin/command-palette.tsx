"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CornerDownLeft,
  CreditCard,
  GraduationCap,
  PhoneCall,
  Search,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "@/i18n/navigation";
import { flatNavForRole } from "@/lib/admin/nav";
import { globalSearch, type GlobalSearchResult, type SearchResultType } from "@/lib/admin/actions/search";
import type { AdminRole } from "@/lib/admin/roles";
import { cn } from "@/lib/utils";

type PaletteItem = {
  key: string;
  label: string;
  sublabel?: string;
  Icon: LucideIcon;
  run: () => void;
};

type Section = { id: string; heading: string; items: PaletteItem[] };

const RESULT_ICON: Record<SearchResultType, LucideIcon> = {
  student: User,
  guardian: Users,
  lead: PhoneCall,
  payment: CreditCard,
};

const CommandPaletteContext = createContext<{ open: () => void } | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette debe usarse dentro de <CommandPaletteProvider>");
  return ctx;
}

export function CommandPaletteProvider({
  role,
  children,
}: {
  role: AdminRole;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);

  // ⌘/Ctrl+K abre/cierra la paleta desde cualquier parte del admin.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open: openPalette }}>
      {children}
      <AnimatePresence>
        {open && <CommandPalette key="cmdk" role={role} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </CommandPaletteContext.Provider>
  );
}

function CommandPalette({ role, onClose }: { role: AdminRole; onClose: () => void }) {
  const reduced = useReducedMotion();
  const router = useRouter();
  const tNav = useTranslations("admin.sidebar");
  const tCmd = useTranslations("admin.command");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [, startSearch] = useTransition();
  const [active, setActive] = useState(0);

  // Solo efectos de DOM al montar (autofocus + bloquear scroll). Sin setState.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 40);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(id);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      document.body.style.overflow = "";
    };
  }, []);

  // Búsqueda con debounce desde el onChange (no en un effect).
  function handleQueryChange(value: string) {
    setQuery(value);
    setActive(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        setResults(await globalSearch(q));
      });
    }, 220);
  }

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href as never);
    },
    [onClose, router],
  );

  const navItems = useMemo<PaletteItem[]>(
    () =>
      flatNavForRole(role).map((item) => ({
        key: `nav:${item.href}`,
        label: tNav(`items.${item.itemKey}`),
        Icon: item.Icon,
        run: () => go(item.href),
      })),
    [role, tNav, go],
  );

  const quickActions = useMemo<PaletteItem[]>(
    () => [
      { key: "q:student", label: tCmd("quick.newStudent"), Icon: UserPlus, run: () => go("/admin/students") },
      { key: "q:payment", label: tCmd("quick.recordPayment"), Icon: CreditCard, run: () => go("/admin/payments") },
      { key: "q:attendance", label: tCmd("quick.takeAttendance"), Icon: GraduationCap, run: () => go("/admin/attendance") },
    ],
    [tCmd, go],
  );

  const q = query.trim().toLowerCase();
  const filteredNav = q ? navItems.filter((i) => i.label.toLowerCase().includes(q)) : navItems;
  const filteredQuick = q ? quickActions.filter((i) => i.label.toLowerCase().includes(q)) : quickActions;
  const resultItems = useMemo<PaletteItem[]>(
    () =>
      results.map((r) => ({
        key: `res:${r.type}:${r.id}`,
        label: r.label,
        sublabel: r.sublabel,
        Icon: RESULT_ICON[r.type],
        run: () => go(r.href),
      })),
    [results, go],
  );

  const sections: Section[] = [];
  if (resultItems.length) sections.push({ id: "results", heading: tCmd("sections.results"), items: resultItems });
  if (filteredNav.length) sections.push({ id: "goto", heading: tCmd("sections.goto"), items: filteredNav });
  if (filteredQuick.length) sections.push({ id: "quick", heading: tCmd("sections.quick"), items: filteredQuick });

  const flat = sections.flatMap((s) => s.items);
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : 0;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[activeIndex]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  let runningIndex = -1;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[rgba(15,30,22,0.5)] px-3 pt-[12vh] backdrop-blur-md sm:px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={tCmd("title")}
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
          <Search className="h-[18px] w-[18px] flex-shrink-0 text-[var(--muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={tCmd("placeholder")}
            className="w-full bg-transparent py-4 text-[15px] text-foreground outline-none placeholder:text-[var(--muted)]"
            aria-label={tCmd("placeholder")}
          />
          <kbd className="hidden flex-shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted)] sm:block">
            Esc
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain py-2">
          {flat.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">{tCmd("empty")}</p>
          ) : (
            sections.map((section) => (
              <div key={section.id} className="mb-1">
                <p className="px-4 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {section.heading}
                </p>
                {section.items.map((item) => {
                  runningIndex += 1;
                  const isActive = runningIndex === activeIndex;
                  const idx = runningIndex;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.run}
                      onMouseMove={() => setActive(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left text-[13.5px] transition-colors",
                        isActive ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-muted)]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg",
                          isActive ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-muted)] text-[var(--muted)]",
                        )}
                      >
                        <item.Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{item.label}</span>
                        {item.sublabel && (
                          <span className="block truncate text-[11.5px] text-[var(--muted)]">{item.sublabel}</span>
                        )}
                      </span>
                      {isActive && <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
