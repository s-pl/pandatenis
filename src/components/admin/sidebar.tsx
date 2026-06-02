"use client";

import Image from "next/image";
import { ChevronDown, LogOut, Star, Trophy, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/format";
import { useWhatsappNotifications } from "@/components/admin/whatsapp/notifications-provider";
import { navGroupsForRole } from "@/lib/admin/nav";
import type { AdminRole } from "@/lib/admin/roles";

export function AdminSidebar({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string;
  role: AdminRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const { unreadTotal, notificationPermission, requestPermission } = useWhatsappNotifications();
  const t = useTranslations("admin.sidebar");
  const navGroups = navGroupsForRole(role);

  async function handleSignOut() {
    startSignOut(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(t("signOutErrorTitle"), { description: error.message });
        return;
      }
      toast.success(t("signOutSuccess"));
      router.replace("/login");
      router.refresh();
    });
  }

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed left-2.5 z-50 grid h-11 w-11 place-items-center rounded-lg bg-[var(--surface)] text-foreground active:bg-[var(--surface-muted)] lg:hidden"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
        aria-label={t("openMenu")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-[rgba(15,30,22,0.4)] backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-[var(--border)]">
              <Image src="/panda/logo.png" alt="Panda Tenis" fill sizes="32px" className="object-contain" />
            </div>
            <span className="text-[15px] font-bold tracking-tight">Panda Tenis</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground lg:hidden"
            aria-label={t("closeMenu")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-shrink-0 border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/70">
            <Star className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />
            <span>{t("favorites")}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {navGroups.map((group) => {
            const groupLabel = t(`groups.${group.groupKey}`);
            const collapsed = collapsedGroups.has(group.groupKey);
            return (
              <div key={group.groupKey} className="mb-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.groupKey)}
                  className="flex w-full items-center justify-between gap-2 px-4 pb-1 pt-2 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: group.dot }}
                    />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">
                      {groupLabel}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-[var(--muted)] transition-transform",
                      collapsed && "-rotate-90",
                    )}
                  />
                </button>

                {!collapsed && (
                  <ul>
                    {group.items.map((item) => {
                      const path = item.href.split("?")[0];
                      const active =
                        path === "/admin"
                          ? pathname === "/admin"
                          : (pathname?.startsWith(path) ?? false);
                      const itemLabel = t(`items.${item.itemKey}`);
                      return (
                        <li key={`${group.groupKey}-${item.href}`}>
                          <Link
                            href={item.href as never}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "relative flex items-center gap-3 px-4 py-2 text-[13.5px] font-medium transition-colors",
                              active
                                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                                : "text-foreground/75 hover:bg-[var(--surface-muted)]/60 hover:text-foreground",
                            )}
                          >
                            {active && (
                              <span className="absolute inset-y-0 left-0 w-[3px] rounded-r-sm bg-[var(--primary)]" />
                            )}
                            <span className={cn("flex-shrink-0", active ? "text-[var(--primary)]" : "text-foreground/60")}>
                              <item.Icon className="h-[18px] w-[18px]" />
                            </span>
                            <span className="flex-1 truncate">{itemLabel}</span>
                            {item.badgeKey === "whatsapp-unread" && unreadTotal > 0 && (
                              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
                                {unreadTotal > 99 ? "99+" : unreadTotal}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          {role === "admin" && notificationPermission === "default" && (
            <div className="mx-3 mt-2">
              <button
                type="button"
                onClick={requestPermission}
                className="w-full rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2 text-left text-[11.5px] leading-snug text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <strong className="block text-[12px] text-foreground">{t("enableNotifTitle")}</strong>
                {t("enableNotifText")}
              </button>
            </div>
          )}
        </nav>

        <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[12px] font-bold text-white">
              {initials(fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold leading-tight">{fullName}</p>
              <p className="truncate text-[11px] text-[var(--muted)]">{email}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              aria-label={t("signOut")}
              title={t("signOut")}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function AdminTrophy() {
  return <Trophy className="h-4 w-4" />;
}
