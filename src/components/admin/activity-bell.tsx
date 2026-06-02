"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { getRecentActivity, type ActivityItem } from "@/lib/admin/actions/activity";
import { relativeTime } from "@/lib/format";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

const SEEN_KEY = "pt-activity-seen";

/**
 * Campana de actividad: muestra los últimos eventos del panel
 * (`admin_activity_log`) con marca de no leídos y actualización en tiempo real.
 * Solo se monta para administradores.
 */
export function ActivityBell() {
  const t = useTranslations("admin.activity");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [seen, setSeen] = useState<string>(() => {
    try {
      return localStorage.getItem(SEEN_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const next = await getRecentActivity();
      setItems(next);
    } catch {
      /* ignore */
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial + realtime (sistema externo)
    void load();
    const supabase = createClient();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("admin-activity-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_activity_log" },
        () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => void load(), 500);
        },
      )
      .subscribe();
    return () => {
      if (debounce) clearTimeout(debounce);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const unread = items.filter((i) => !seen || i.createdAt > seen).length;

  function markSeen() {
    const latest = items[0]?.createdAt ?? new Date().toISOString();
    setSeen(latest);
    try {
      localStorage.setItem(SEEN_KEY, latest);
    } catch {
      /* ignore */
    }
  }

  return (
    <DropdownMenu
      align="end"
      triggerLabel={t("title")}
      triggerClassName="relative grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground"
      menuClassName="w-[320px] max-w-[88vw]"
      trigger={
        <span onClick={markSeen} className="grid h-full w-full place-items-center">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
      }
    >
      <div className="border-b border-[var(--border)] px-3 py-2">
        <p className="text-[12px] font-bold text-foreground">{t("title")}</p>
      </div>
      <div className="max-h-[60vh] overflow-y-auto py-1">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-[var(--muted)]">{t("empty")}</p>
        ) : (
          items.map((item) => {
            const isNew = !seen || item.createdAt > seen;
            return (
              <div
                key={item.id}
                className="flex items-start gap-2.5 px-3 py-2 text-[13px]"
              >
                <span
                  className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                    isNew ? "bg-[var(--primary)]" : "bg-transparent"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="leading-snug text-foreground">{item.summary}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">{relativeTime(item.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </DropdownMenu>
  );
}
