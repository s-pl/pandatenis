"use client";

import {
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  UserPlus,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { springBouncy } from "@/components/ui/motion";
import type { AdminRole } from "@/lib/admin/roles";

const ITEMS = [
  { href: "/admin", labelKey: "panel", icon: LayoutDashboard, match: (p: string) => p === "/admin" },
  { href: "/admin/students", labelKey: "students", icon: Users, match: (p: string) => p.startsWith("/admin/students") },
  { href: "/admin/payments", labelKey: "payments", icon: CreditCard, match: (p: string) => p.startsWith("/admin/payments") },
] as const satisfies Array<{
  href: string;
  labelKey: "panel" | "students" | "payments";
  icon: typeof LayoutDashboard;
  match: (p: string) => boolean;
}>;

const PROFESSOR_ITEMS = [
  {
    href: "/admin/attendance",
    labelKey: "attendance",
    icon: GraduationCap,
    match: (p: string) => p.startsWith("/admin/attendance"),
  },
  {
    href: "/admin/registrations",
    labelKey: "registrations",
    icon: UserPlus,
    match: (p: string) => p.startsWith("/admin/registrations"),
  },
] as const satisfies Array<{
  href: string;
  labelKey: "attendance" | "registrations";
  icon: typeof LayoutDashboard;
  match: (p: string) => boolean;
}>;

export function MobileNav({ role }: { role: AdminRole }) {
  const pathname = usePathname() ?? "";
  const t = useTranslations("admin.mobileNav");
  const reduce = useReducedMotion();
  const items = role === "admin" ? ITEMS : PROFESSOR_ITEMS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 grid border-t border-[var(--border)] bg-[var(--surface)] lg:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href as never}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-semibold transition-colors active:scale-90",
              active ? "text-foreground" : "text-[var(--muted)] active:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="mobilenav-active"
                className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-[var(--accent)]"
                transition={springBouncy}
              />
            )}
            <motion.span
              className="relative"
              animate={reduce ? undefined : { scale: active ? 1.14 : 1, y: active ? -1 : 0 }}
              transition={springBouncy}
            >
              <Icon className={cn("h-5 w-5", active && "text-foreground")} />
            </motion.span>
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
