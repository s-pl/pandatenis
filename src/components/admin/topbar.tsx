"use client";

import { ChevronRight, LogOut, Moon, Search, Settings, Sun } from "lucide-react";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTheme } from "@/components/theme-provider";
import { useCommandPalette } from "@/components/admin/command-palette";
import { ActivityBell } from "@/components/admin/activity-bell";
import {
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
} from "@/components/ui/dropdown-menu";
import type { AdminRole } from "@/lib/admin/roles";

const ROUTE_MAP: Array<{ pattern: RegExp; crumbs: string[] }> = [
  { pattern: /^\/admin$/, crumbs: ["dashboard"] },
  { pattern: /^\/admin\/students\/[^/]+/, crumbs: ["students", "studentDetail"] },
  { pattern: /^\/admin\/students/, crumbs: ["students"] },
  { pattern: /^\/admin\/attendance/, crumbs: ["attendance"] },
  { pattern: /^\/admin\/reports/, crumbs: ["reports"] },
  { pattern: /^\/admin\/private-lessons/, crumbs: ["privateLessons"] },
  { pattern: /^\/admin\/medals/, crumbs: ["medals"] },
  { pattern: /^\/admin\/gallery/, crumbs: ["gallery"] },
  { pattern: /^\/admin\/payments/, crumbs: ["payments"] },
  { pattern: /^\/admin\/registrations/, crumbs: ["registrations"] },
  { pattern: /^\/admin\/leads/, crumbs: ["leads"] },
  { pattern: /^\/admin\/whatsapp\/chats\/[^/]+/, crumbs: ["whatsapp", "chat"] },
  { pattern: /^\/admin\/whatsapp\/chats/, crumbs: ["whatsapp", "chats"] },
  { pattern: /^\/admin\/whatsapp\/conexion/, crumbs: ["whatsapp", "connection"] },
  { pattern: /^\/admin\/whatsapp/, crumbs: ["whatsapp"] },
  { pattern: /^\/admin\/groups/, crumbs: ["groups"] },
  { pattern: /^\/admin\/calendar/, crumbs: ["calendar"] },
  { pattern: /^\/admin\/settings/, crumbs: ["settings"] },
];

export function AdminTopbar({
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
  const t = useTranslations("admin.breadcrumbs");
  const tTop = useTranslations("admin.topbar");
  const tSide = useTranslations("admin.sidebar");
  const { theme, toggle } = useTheme();
  const { open: openPalette } = useCommandPalette();
  const [signingOut, startSignOut] = useTransition();

  const crumbKeys = (() => {
    for (const { pattern, crumbs } of ROUTE_MAP) {
      if (pattern.test(pathname)) return crumbs;
    }
    return ["dashboard"];
  })();

  const crumbs = crumbKeys.map((k) => t(k));
  const mobileLabel = crumbs[crumbs.length - 1];

  function handleSignOut() {
    startSignOut(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(tSide("signOutErrorTitle"), { description: error.message });
        return;
      }
      toast.success(tSide("signOutSuccess"));
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <header
      className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] pl-[60px] pr-3 lg:left-60 lg:pl-6 lg:pr-6"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <h2 className="truncate text-[15px] font-bold text-foreground lg:hidden">{mobileLabel}</h2>

      <nav className="hidden items-center gap-1.5 text-[13.5px] lg:flex">
        <Link
          href="/admin"
          className="font-medium text-[var(--muted)] transition-colors hover:text-foreground"
        >
          {t("dashboard")}
        </Link>
        {crumbKeys[0] !== "dashboard" &&
          crumbs.map((crumb, i, arr) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--border-strong)]" />
              <span
                className={cn(
                  i === arr.length - 1 ? "font-semibold text-foreground" : "text-[var(--muted)]",
                )}
              >
                {crumb}
              </span>
            </span>
          ))}
      </nav>

      <div className="flex items-center gap-1">
        {/* Buscar (⌘K) — visible también en móvil */}
        <button
          type="button"
          onClick={openPalette}
          className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 text-[var(--muted)] transition-colors hover:text-foreground"
          aria-label={tTop("search")}
        >
          <Search className="h-4 w-4" />
          <span className="hidden text-[12.5px] font-medium lg:inline">{tTop("search")}</span>
          <kbd className="hidden rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[10px] font-bold lg:inline">
            ⌘K
          </kbd>
        </button>

        {role === "admin" && <ActivityBell />}

        <div className="hidden items-center gap-1 lg:flex">
          <LanguageSwitcher variant="iconOnly" />
          <button
            type="button"
            onClick={toggle}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground"
            aria-label={tTop("theme")}
            title={tTop("theme")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <DropdownMenu
            align="end"
            triggerLabel={tTop("profile")}
            triggerClassName="ml-1 grid h-8 w-8 place-items-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-white transition-transform hover:scale-105"
            trigger={initials(fullName)}
          >
            <div className="px-2.5 pb-2 pt-1.5">
              <p className="truncate text-[13px] font-semibold text-foreground">{fullName}</p>
              <p className="truncate text-[11.5px] text-[var(--muted)]">{email}</p>
            </div>
            <DropdownSeparator />
            <DropdownItem
              icon={theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              onSelect={toggle}
              closeOnSelect={false}
            >
              {theme === "dark" ? tTop("lightMode") : tTop("darkMode")}
            </DropdownItem>
            <DropdownItem
              icon={<Settings className="h-4 w-4" />}
              onSelect={() => router.push("/admin/settings")}
            >
              {t("settings")}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              icon={<LogOut className="h-4 w-4" />}
              tone="danger"
              onSelect={handleSignOut}
            >
              {signingOut ? tSide("signOut") + "…" : tSide("signOut")}
            </DropdownItem>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
