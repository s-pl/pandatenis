import {
  CalendarDays,
  CreditCard,
  GraduationCap,
  Images,
  LayoutDashboard,
  MapPinned,
  Medal,
  Megaphone,
  MessageSquare,
  PhoneCall,
  QrCode,
  ScrollText,
  Settings,
  Sparkles,
  Sun,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AdminRole } from "@/lib/admin/roles";

/**
 * Fuente única de navegación del admin. La consume el sidebar y la paleta de
 * comandos (Cmd+K). Las etiquetas viven en i18n bajo `admin.sidebar.items.*` y
 * los grupos bajo `admin.sidebar.groups.*`. El icono se guarda como componente
 * `LucideIcon` para poder renderizarlo en ambos sitios.
 */
export type AdminNavItem = {
  href: string;
  itemKey: string;
  Icon: LucideIcon;
  roles?: AdminRole[];
};

export type AdminNavGroup = {
  groupKey: string;
  dot: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    groupKey: "dashboard",
    dot: "#9ca3af",
    items: [
      { href: "/admin", itemKey: "dashboard", Icon: LayoutDashboard },
      { href: "/admin/calendar", itemKey: "calendar", Icon: CalendarDays },
    ],
  },
  {
    groupKey: "community",
    dot: "#a855f7",
    items: [
      { href: "/admin/students", itemKey: "students", Icon: Users },
      { href: "/admin/leads", itemKey: "leads", Icon: PhoneCall },
      { href: "/admin/sms", itemKey: "sms", Icon: MessageSquare },
      { href: "/admin/attendance", itemKey: "attendance", Icon: GraduationCap, roles: ["admin", "profesor"] },
      { href: "/admin/registrations", itemKey: "registrations", Icon: UserPlus, roles: ["profesor"] },
    ],
  },
  {
    groupKey: "school",
    dot: "#22c55e",
    items: [
      { href: "/admin/groups", itemKey: "groups", Icon: MapPinned },
      { href: "/admin/planner", itemKey: "planner", Icon: CalendarDays },
      { href: "/admin/private-lessons", itemKey: "privateLessons", Icon: Sparkles },
      { href: "/admin/medals", itemKey: "medals", Icon: Medal },
      { href: "/admin/reports", itemKey: "reports", Icon: ScrollText },
      { href: "/admin/gallery", itemKey: "gallery", Icon: Images },
    ],
  },
  {
    groupKey: "camps",
    dot: "#f97316",
    items: [
      { href: "/admin/campus", itemKey: "campusBoard", Icon: Sun },
      { href: "/admin/qr", itemKey: "qr", Icon: QrCode },
      { href: "/admin/promotions", itemKey: "promotions", Icon: Megaphone },
      { href: "/admin/registrations?type=campus", itemKey: "registrations", Icon: UserPlus },
    ],
  },
  {
    groupKey: "finance",
    dot: "#3b82f6",
    items: [
      { href: "/admin/payments", itemKey: "payments", Icon: CreditCard },
      { href: "/admin/registrations", itemKey: "registrations", Icon: UserPlus },
    ],
  },
  {
    groupKey: "control",
    dot: "#6b7280",
    items: [{ href: "/admin/settings", itemKey: "settings", Icon: Settings }],
  },
];

/** Filtra los grupos/items visibles para un rol (los items sin `roles` son admin). */
export function navGroupsForRole(role: AdminRole): AdminNavGroup[] {
  return ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => (item.roles ?? ["admin"]).includes(role)),
  })).filter((group) => group.items.length > 0);
}

/** Lista plana y sin hrefs duplicados, para la paleta de comandos. */
export function flatNavForRole(role: AdminRole): AdminNavItem[] {
  const seen = new Set<string>();
  const out: AdminNavItem[] = [];
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (!(item.roles ?? ["admin"]).includes(role)) continue;
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      out.push(item);
    }
  }
  return out;
}
