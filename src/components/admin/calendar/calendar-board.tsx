"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  Megaphone,
  PartyPopper,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { FormEvent, useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  type EventInput,
} from "@/lib/admin/actions/calendar";
import { formatLongDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Event = {
  id: string;
  title: string;
  type: "campamento" | "torneo" | "clase_especial" | "reunion" | "otro";
  startsAt: string;
  endsAt: string;
  description: string;
  color: string;
};

const TYPE_META: Record<Event["type"], { label: string; color: string; icon: ReactNode }> = {
  campamento: { label: "Campamento", color: "#1f6f43", icon: <PartyPopper className="h-3 w-3" /> },
  torneo: { label: "Torneo", color: "#d65151", icon: <Flag className="h-3 w-3" /> },
  clase_especial: { label: "Clase especial", color: "#2a6cb5", icon: <Users className="h-3 w-3" /> },
  reunion: { label: "Reunión", color: "#7a5cf5", icon: <Megaphone className="h-3 w-3" /> },
  otro: { label: "Otro", color: "#5b6b5d", icon: <CalendarDays className="h-3 w-3" /> },
};

const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
const dayMonthFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function CalendarBoard({ events }: { events: Event[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [creating, setCreating] = useState<{ date?: string } | null>(null);
  const [viewing, setViewing] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState<Event | null>(null);
  const [pending, startTransition] = useTransition();

  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const event of events) {
      const day = event.startsAt.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(event);
      map.set(day, list);
    }
    return map;
  }, [events]);

  // Días del mes actual que tienen eventos — para la lista mobile
  const monthDaysWithEvents = useMemo(() => {
    const result: Array<{ date: Date; iso: string; events: Event[] }> = [];
    for (const { date } of days) {
      if (date.getMonth() !== cursor.getMonth()) continue;
      const iso = date.toISOString().slice(0, 10);
      const dayEvents = eventsByDay.get(iso);
      if (dayEvents && dayEvents.length > 0) {
        result.push({ date, iso, events: dayEvents });
      }
    }
    return result;
  }, [days, cursor, eventsByDay]);

  const monthLabel = monthFormatter.format(cursor);

  function deleteEvent(event: Event) {
    setDeleting(event);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setViewing(null);
    startTransition(async () => {
      const result = await deleteCalendarEvent(target.id);
      if (result.ok) {
        toast.success("Evento eliminado");
      } else {
        toast.error("No se ha podido eliminar", { description: result.error });
      }
    });
  }

  return (
    <>
      {/* ── Header / controls ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="grid h-10 w-10 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
            className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12.5px] font-semibold hover:bg-[var(--surface-muted)]"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="grid h-10 w-10 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="ml-2 truncate text-[15px] font-bold capitalize">{monthLabel}</p>
        </div>

        <Button
          variant="accent"
          size="sm"
          iconLeft={<Plus className="h-4 w-4" />}
          onClick={() => setCreating({})}
          className="h-10"
        >
          Nuevo evento
        </Button>
      </div>

      {/* ── Mobile: list view ────────────────────────────── */}
      <div className="block lg:hidden">
        {monthDaysWithEvents.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title={`Sin eventos en ${monthLabel}`}
            description="Pulsa Nuevo evento para añadir uno."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {monthDaysWithEvents.map(({ date, iso, events }) => {
              const isToday = sameDay(date, new Date());
              return (
                <li
                  key={iso}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
                >
                  <header
                    className={cn(
                      "flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5",
                      isToday && "bg-[var(--accent-soft)]",
                    )}
                  >
                    <p className="text-[12.5px] font-bold capitalize">
                      {dayMonthFormatter.format(date)}
                    </p>
                    {isToday && (
                      <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-foreground)]">
                        Hoy
                      </span>
                    )}
                  </header>
                  <ul className="divide-y divide-[var(--border)]">
                    {events.map((event) => {
                      const meta = TYPE_META[event.type];
                      return (
                        <li key={event.id}>
                          <button
                            type="button"
                            onClick={() => setViewing(event)}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-[var(--surface-muted)]"
                          >
                            <span
                              className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg text-white"
                              style={{ background: event.color }}
                            >
                              {meta.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13.5px] font-semibold">
                                {event.title}
                              </p>
                              <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                                {formatTime(event.startsAt)} – {formatTime(event.endsAt)} · {meta.label}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Desktop: grid + sidebar ────────────────────────── */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardBody>
            <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const isoDay = day.date.toISOString().slice(0, 10);
                const dayEvents = eventsByDay.get(isoDay) ?? [];
                const isToday = sameDay(day.date, new Date());
                const isOtherMonth = day.date.getMonth() !== cursor.getMonth();
                return (
                  <button
                    key={isoDay}
                    type="button"
                    onClick={() => setCreating({ date: isoDay })}
                    className={cn(
                      "group flex min-h-[96px] flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                      isOtherMonth
                        ? "border-transparent bg-transparent text-[var(--muted)]"
                        : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40",
                      isToday && "border-[var(--accent)] bg-[var(--accent-soft)]/60",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[12px] font-bold",
                        isToday && "text-foreground",
                      )}
                    >
                      {day.date.getDate()}
                    </span>
                    <div className="flex flex-col gap-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewing(event);
                          }}
                          role="button"
                          className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ background: event.color }}
                        >
                          {event.title}
                        </span>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-[var(--muted)]">
                          + {dayEvents.length - 3} más
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px]">
              {(Object.entries(TYPE_META) as [Event["type"], typeof TYPE_META[Event["type"]]][]).map(
                ([key, meta]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-1"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                ),
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Próximos eventos" description="Lo que viene en las próximas semanas." />
          <CardBody>
            <UpcomingEventsList
              events={events
                .filter((event) => new Date(event.startsAt) >= new Date())
                .slice(0, 5)}
              onSelect={setViewing}
            />
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Borrar evento?"
        description={
          deleting
            ? `Vas a borrar "${deleting.title}". Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Sí, borrar"
      />

      {/* Modals */}
      <Modal
        open={!!creating}
        onClose={() => setCreating(null)}
        title="Nuevo evento"
        description="Programa un torneo, campamento, clase especial o reunión."
        size="md"
      >
        <EventForm
          initialDate={creating?.date}
          onCancel={() => setCreating(null)}
          onSaved={() => setCreating(null)}
        />
      </Modal>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title}
        description={viewing ? formatLongDate(viewing.startsAt) : undefined}
        size="md"
        footer={
          viewing ? (
            <>
              <Button
                variant="ghost"
                onClick={() => deleteEvent(viewing)}
                loading={pending}
                iconLeft={<Trash2 className="h-4 w-4" />}
              >
                Eliminar
              </Button>
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Cerrar
              </Button>
            </>
          ) : null
        }
      >
        {viewing && (
          <div className="flex flex-col gap-3">
            <Badge tone="neutral" className="self-start">
              {TYPE_META[viewing.type].label}
            </Badge>
            <p className="text-[13.5px] text-[var(--muted)]">
              De las {formatTime(viewing.startsAt)} a las {formatTime(viewing.endsAt)}
            </p>
            {viewing.description && (
              <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-[13.5px]">
                {viewing.description}
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function UpcomingEventsList({
  events,
  onSelect,
}: {
  events: Event[];
  onSelect: (event: Event) => void;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-5 w-5" />}
        title="Sin eventos próximos"
        description="Programa el próximo torneo o campamento."
      />
    );
  }
  return (
    <ul className="space-y-2">
      <AnimatePresence>
        {events.map((event) => {
          const meta = TYPE_META[event.type];
          return (
            <motion.li
              key={event.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <button
                type="button"
                onClick={() => onSelect(event)}
                className="flex w-full items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left hover:bg-[var(--surface-muted)]"
              >
                <span
                  className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg text-white"
                  style={{ background: event.color }}
                >
                  {meta.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold">{event.title}</p>
                  <p className="text-[11.5px] text-[var(--muted)]">
                    {formatLongDate(event.startsAt)} · {formatTime(event.startsAt)}
                  </p>
                  <Badge tone="neutral" className="mt-1">
                    {meta.label}
                  </Badge>
                </div>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

function EventForm({
  initialDate,
  onCancel,
  onSaved,
}: {
  initialDate?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const baseDate = initialDate ?? new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<Event["type"]>("torneo");
  const [values, setValues] = useState<EventInput>({
    title: "",
    type: "torneo",
    startsAt: `${baseDate}T17:00`,
    endsAt: `${baseDate}T19:00`,
    description: "",
    color: TYPE_META["torneo"].color,
  });
  const [pending, startTransition] = useTransition();

  function set<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function chooseType(next: Event["type"]) {
    setType(next);
    set("type", next);
    set("color", TYPE_META[next].color);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createCalendarEvent({
        ...values,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: new Date(values.endsAt).toISOString(),
      });
      if (result.ok) {
        toast.success("Evento creado");
        onSaved();
      } else {
        toast.error("No se ha podido guardar", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Tipo de evento" required>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.entries(TYPE_META) as [Event["type"], typeof TYPE_META[Event["type"]]][]).map(
            ([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => chooseType(key)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-[11.5px] font-semibold transition-colors",
                  type === key
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                )}
              >
                <span
                  className="grid h-7 w-7 place-items-center rounded-full text-white"
                  style={{ background: meta.color }}
                >
                  {meta.icon}
                </span>
                {meta.label}
              </button>
            ),
          )}
        </div>
      </Field>
      <Field label="Título" required>
        <Input
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Torneo de Navidad"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Empieza" required>
          <Input
            type="datetime-local"
            value={values.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
          />
        </Field>
        <Field label="Termina" required>
          <Input
            type="datetime-local"
            value={values.endsAt}
            onChange={(e) => set("endsAt", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Color">
        <Select value={values.color} onChange={(e) => set("color", e.target.value)}>
          {(Object.entries(TYPE_META) as [Event["type"], typeof TYPE_META[Event["type"]]][]).map(
            ([key, meta]) => (
              <option key={key} value={meta.color}>
                {meta.label} · {meta.color}
              </option>
            ),
          )}
        </Select>
      </Field>
      <Field label="Descripción">
        <Textarea
          rows={3}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Detalles, ubicación, edades…"
        />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" loading={pending}>
          Crear evento
        </Button>
      </div>
    </form>
  );
}

function buildMonthGrid(cursor: Date): Array<{ date: Date }> {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // Monday-first
  const start = new Date(year, month, 1 - firstWeekday);
  const cells: Array<{ date: Date }> = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({ date });
  }
  return cells;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
