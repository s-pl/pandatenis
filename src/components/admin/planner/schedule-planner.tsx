"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  UserMinus,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  applyBulkAssignmentsAction,
  assignStudentToGroupAction,
  suggestScheduleAction,
} from "@/lib/admin/actions/scheduler";

type Weekday = "L" | "M" | "X" | "J" | "V" | "S" | "D";
type TimeBlock = "tarde-temprano" | "tarde-media" | "tarde-tardia" | "sabado-manana";

type Group = {
  id: string;
  name: string;
  level: "Rojo" | "Naranja" | "Verde" | "Amarillo";
  capacity: number;
  weekdays: Weekday[];
  startTime: string;
  endTime: string;
  location: string;
};

type Student = {
  id: string;
  fullName: string;
  age: number;
  level: "Rojo" | "Naranja" | "Verde" | "Amarillo";
  groupId: string | null;
  preferredDays: Weekday[];
  preferredTimeBlocks: TimeBlock[];
};

const WEEKDAYS: Array<{ key: Weekday; label: string }> = [
  { key: "L", label: "Lunes" },
  { key: "M", label: "Martes" },
  { key: "X", label: "Miércoles" },
  { key: "J", label: "Jueves" },
  { key: "V", label: "Viernes" },
  { key: "S", label: "Sábado" },
];

const LEVEL_COLOR: Record<Group["level"], string> = {
  Rojo: "#e63d55",
  Naranja: "#ea7a1a",
  Verde: "#1f9b58",
  Amarillo: "#c09010",
};

export function SchedulePlanner({
  groups,
  students,
}: {
  groups: Group[];
  students: Student[];
}) {
  const [suggestions, setSuggestions] = useState<Map<string, string>>(new Map());
  const [suggesting, startSuggesting] = useTransition();
  const [applying, startApplying] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);

  const groupsById = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );

  const enrolledByGroup = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const g of groups) map.set(g.id, []);
    for (const s of students) {
      if (s.groupId && map.has(s.groupId)) {
        map.get(s.groupId)!.push(s);
      }
    }
    return map;
  }, [groups, students]);

  const pendingStudents = useMemo(
    () => students.filter((s) => !s.groupId),
    [students],
  );

  // Grupos agrupados por día para la rejilla
  const groupsByDay = useMemo(() => {
    const map = new Map<Weekday, Group[]>();
    for (const day of WEEKDAYS) map.set(day.key, []);
    for (const g of groups) {
      for (const d of g.weekdays) {
        map.get(d)?.push(g);
      }
    }
    // Ordenar por hora
    for (const [, list] of map) {
      list.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    }
    return map;
  }, [groups]);

  async function handleAutoAssign() {
    startSuggesting(async () => {
      const result = await suggestScheduleAction();
      if (!result.ok) {
        toast.error("No se pudo calcular", { description: result.error });
        return;
      }
      const map = new Map<string, string>();
      let matched = 0;
      for (const sug of result.data ?? []) {
        if (sug.groupId) {
          map.set(sug.studentId, sug.groupId);
          matched += 1;
        }
      }
      setSuggestions(map);
      toast.success("Sugerencias listas", {
        description: `${matched}/${result.data?.length ?? 0} alumnos con grupo recomendado. Revísalo y aplica.`,
      });
    });
  }

  async function handleApplySuggestions() {
    const entries = Array.from(suggestions.entries());
    if (entries.length === 0) {
      toast.warning("No hay sugerencias que aplicar");
      return;
    }
    startApplying(async () => {
      const result = await applyBulkAssignmentsAction({
        assignments: entries.map(([studentId, groupId]) => ({ studentId, groupId })),
      });
      if (!result.ok) {
        toast.error("Error al aplicar", { description: result.error });
        return;
      }
      toast.success(`${result.data?.applied ?? 0} alumnos asignados`);
      setSuggestions(new Map());
    });
  }

  async function assign(studentId: string, groupId: string | null) {
    setMovingId(studentId);
    const result = await assignStudentToGroupAction({ studentId, groupId });
    setMovingId(null);
    if (!result.ok) {
      toast.error("No se pudo asignar", { description: result.error });
      return;
    }
    toast.success(groupId ? "Alumno asignado" : "Alumno liberado");
    setSuggestions((prev) => {
      const next = new Map(prev);
      next.delete(studentId);
      return next;
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* ─────────────────────── Rejilla semanal ─────────────────────── */}
      <Card>
        <CardHeader
          title="Rejilla semanal"
          description="Cada celda es un grupo programado en su día y hora. El cupo se calcula con los alumnos activos asignados."
        />
        <CardBody className="space-y-4">
          {WEEKDAYS.map((day) => {
            const dayGroups = groupsByDay.get(day.key) ?? [];
            return (
              <section key={day.key}>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  {day.label}
                  <span className="text-[var(--muted)]/60">· {dayGroups.length}</span>
                </h4>
                {dayGroups.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/40 px-3 py-2 text-xs text-[var(--muted)]">
                    Sin grupos programados.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {dayGroups.map((g) => {
                      const enrolled = enrolledByGroup.get(g.id) ?? [];
                      const free = g.capacity - enrolled.length;
                      return (
                        <li
                          key={`${day.key}-${g.id}`}
                          className="rounded-xl border bg-white p-3 shadow-[var(--shadow-sm)]"
                          style={{ borderColor: LEVEL_COLOR[g.level] + "44" }}
                        >
                          <header className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">{g.name}</p>
                              <p className="text-[11px] text-[var(--muted)]">
                                {g.startTime || "—"} – {g.endTime || "—"}
                                {g.location ? ` · ${g.location}` : ""}
                              </p>
                            </div>
                            <span
                              className="grid h-7 w-7 place-items-center rounded-lg text-[10px] font-black text-white"
                              style={{ background: LEVEL_COLOR[g.level] }}
                              title={`Nivel ${g.level}`}
                            >
                              {g.level[0]}
                            </span>
                          </header>

                          <div className="mt-2 flex items-center justify-between text-[11px]">
                            <span className="text-[var(--muted)]">
                              {enrolled.length}/{g.capacity} ·{" "}
                              <span
                                className={
                                  free === 0
                                    ? "font-bold text-[var(--danger)]"
                                    : free <= 1
                                      ? "font-bold text-[var(--warning)]"
                                      : "font-bold text-[var(--success)]"
                                }
                              >
                                {free === 0 ? "Completo" : `${free} libre${free === 1 ? "" : "s"}`}
                              </span>
                            </span>
                          </div>

                          {enrolled.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {enrolled.map((s) => (
                                <li
                                  key={s.id}
                                  className="flex items-center justify-between gap-2 rounded-md bg-[var(--surface-muted)]/60 px-2 py-1 text-[12px]"
                                >
                                  <span className="truncate">
                                    {s.fullName}{" "}
                                    <span className="text-[var(--muted)]">· {s.age}a</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => assign(s.id, null)}
                                    disabled={movingId === s.id}
                                    className="grid h-6 w-6 place-items-center rounded text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                                    title="Quitar del grupo"
                                  >
                                    <UserMinus className="h-3.5 w-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </CardBody>
      </Card>

      {/* ─────────────────────── Panel pendientes ─────────────────────── */}
      <Card className="lg:sticky lg:top-20 lg:self-start">
        <CardHeader
          title="Alumnos sin asignar"
          description={`${pendingStudents.length} alumnos esperando grupo.`}
          actions={
            <div className="flex flex-col gap-1.5">
              <Button
                size="sm"
                iconLeft={<Sparkles className="h-3.5 w-3.5" />}
                onClick={handleAutoAssign}
                loading={suggesting}
                disabled={pendingStudents.length === 0}
              >
                Auto-asignar
              </Button>
              {suggestions.size > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft={<CheckCircle2 className="h-3.5 w-3.5" />}
                  onClick={handleApplySuggestions}
                  loading={applying}
                >
                  Aplicar {suggestions.size}
                </Button>
              )}
            </div>
          }
        />
        <CardBody>
          {pendingStudents.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Todo asignado"
              description="No hay alumnos pendientes de colocar en un grupo."
            />
          ) : (
            <ul className="space-y-2">
              {pendingStudents.map((s) => {
                const suggestedId = suggestions.get(s.id);
                const suggested = suggestedId ? groupsById.get(suggestedId) : null;
                const isMoving = movingId === s.id;
                return (
                  <li
                    key={s.id}
                    className="rounded-xl border border-[var(--border)] bg-white p-3 text-sm shadow-[var(--shadow-sm)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{s.fullName}</p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {s.age} años · nivel{" "}
                          <span style={{ color: LEVEL_COLOR[s.level] }} className="font-bold">
                            {s.level}
                          </span>
                        </p>
                      </div>
                      <Badge tone="warning">Sin grupo</Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                      {s.preferredDays.length > 0 ? (
                        s.preferredDays.map((d) => (
                          <span
                            key={d}
                            className="rounded bg-[var(--primary-soft)] px-1.5 py-0.5 font-bold text-[var(--primary)]"
                          >
                            {d}
                          </span>
                        ))
                      ) : (
                        <span className="text-[var(--muted)] italic">Sin días preferidos</span>
                      )}
                      {s.preferredTimeBlocks.map((b) => (
                        <span
                          key={b}
                          className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-semibold text-[var(--accent-foreground)]"
                        >
                          {b.replace("-", " ")}
                        </span>
                      ))}
                    </div>

                    {/* Sugerencia + selector manual */}
                    <div className="mt-3 space-y-2">
                      {suggested && (
                        <button
                          type="button"
                          onClick={() => assign(s.id, suggested.id)}
                          disabled={isMoving}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--success)] bg-[var(--success-soft)] px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--success)] hover:brightness-95"
                        >
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3" />
                            Sugerencia: {suggested.name}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <select
                        defaultValue=""
                        disabled={isMoving}
                        onChange={(e) => {
                          if (e.target.value) assign(s.id, e.target.value);
                        }}
                        className="w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="">Asignar a grupo…</option>
                        {groups
                          .filter((g) => g.level === s.level)
                          .map((g) => {
                            const enrolled = enrolledByGroup.get(g.id)?.length ?? 0;
                            const free = g.capacity - enrolled;
                            return (
                              <option key={g.id} value={g.id} disabled={free <= 0}>
                                {g.name} · {g.startTime || "?"} · {free <= 0 ? "completo" : `${free} libre`}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {pendingStudents.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-[var(--muted)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              Las sugerencias se calculan según preferencias, nivel y plazas libres. Tú decides si las aplicas o las cambias.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

