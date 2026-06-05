"use client";

import { Link } from "@/i18n/navigation";
import { useTransition, type ReactNode } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarCheck,
  CreditCard,
  UserRoundCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableSection } from "@/components/admin/expandable-section";
import {
  dismissActionCenterItem,
  snoozeActionCenterItem,
} from "@/lib/admin/actions/action-center";
import { relativeTime } from "@/lib/format";
import type { ActionCenterItem } from "@/lib/types";

const priorityTone: Record<ActionCenterItem["priority"], "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

const priorityLabel: Record<ActionCenterItem["priority"], string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const typeIcon: Record<ActionCenterItem["type"], ReactNode> = {
  payment_overdue: <CreditCard className="h-4 w-4" />,
  lead_followup: <UserRoundCheck className="h-4 w-4" />,
  registration_pending: <BellRing className="h-4 w-4" />,
  class_attendance: <CalendarCheck className="h-4 w-4" />,
};

export function ActionCenter({ items }: { items: ActionCenterItem[] }) {
  const [pending, startTransition] = useTransition();
  const highCount = items.filter((item) => item.priority === "high").length;

  function snooze(item: ActionCenterItem) {
    startTransition(async () => {
      const result = await snoozeActionCenterItem({ taskKey: item.key, hours: 24 });
      if (result.ok) toast.success("Tarea pospuesta 24 h");
      else toast.error("No se pudo posponer", { description: result.error });
    });
  }

  function dismiss(item: ActionCenterItem) {
    startTransition(async () => {
      const result = await dismissActionCenterItem(item.key);
      if (result.ok) toast.success("Tarea ocultada");
      else toast.error("No se pudo ocultar", { description: result.error });
    });
  }

  return (
    <ExpandableSection
      title="Qué requiere atención hoy"
      icon={<BellRing className="h-4 w-4" />}
      defaultExpanded
      highlight={items.length > 0}
      stats={[
        { label: "acciones", value: items.length, tone: items.length > 0 ? "warning" : "success" },
        ...(highCount > 0 ? [{ label: "alta prioridad", value: highCount, tone: "danger" as const }] : []),
      ]}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<BellRing className="h-5 w-5" />}
          title="Nada urgente pendiente"
          description="Pagos, contactos y asistencia están tranquilos por ahora."
        />
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:flex-row sm:items-center"
            >
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)]">
                {typeIcon[item.type] ?? <AlertTriangle className="h-4 w-4" />}
              </span>
              <Link href={item.href} className="min-w-0 flex-1 hover:text-[var(--primary)]">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                  {item.detail}
                  {item.dueAt ? ` · ${relativeTime(item.dueAt)}` : ""}
                </p>
              </Link>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Badge tone={priorityTone[item.priority]}>{priorityLabel[item.priority]}</Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => snooze(item)}
                >
                  24 h
                </Button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => dismiss(item)}
                  className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-foreground disabled:opacity-50"
                  aria-label="Ocultar tarea"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ExpandableSection>
  );
}
