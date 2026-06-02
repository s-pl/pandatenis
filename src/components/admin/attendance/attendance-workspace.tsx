"use client";

import { CalendarClock, ChevronLeft } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { upsertAttendance } from "@/lib/admin/actions/attendance";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Session = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  groupId: string;
  groupName: string;
  level: string;
};

type Student = { id: string; fullName: string; groupId: string | null; active: boolean };
type Record = {
  id: string;
  classId: string;
  studentId: string;
  status: "asistio" | "no_asistio" | "aviso_ausencia";
  note: string;
};

const STATUS_OPTIONS: Array<{
  value: Record["status"];
  label: string;
  className: string;
}> = [
  {
    value: "asistio",
    label: "Asistió",
    className:
      "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]",
  },
  {
    value: "aviso_ausencia",
    label: "Avisó",
    className:
      "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]",
  },
  {
    value: "no_asistio",
    label: "Faltó",
    className:
      "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]",
  },
];

export function AttendanceWorkspace({
  sessions,
  students,
  attendance,
}: {
  sessions: Session[];
  students: Student[];
  attendance: Record[];
}) {
  const [activeId, setActiveId] = useState<string | null>(sessions[0]?.id ?? null);
  const [, startTransition] = useTransition();

  const recordsByClass = useMemo(() => {
    const map = new Map<string, Map<string, Record>>();
    for (const record of attendance) {
      if (!map.has(record.classId)) map.set(record.classId, new Map());
      map.get(record.classId)!.set(record.studentId, record);
    }
    return map;
  }, [attendance]);

  const activeSession = sessions.find((session) => session.id === activeId) ?? null;
  const groupStudents = useMemo(
    () =>
      activeSession
        ? students.filter((s) => s.active && s.groupId === activeSession.groupId)
        : [],
    [activeSession, students],
  );
  const records = activeId
    ? (recordsByClass.get(activeId) ?? new Map<string, Record>())
    : new Map<string, Record>();

  function handleChange(studentId: string, status: Record["status"]) {
    if (!activeId) return;
    startTransition(async () => {
      const result = await upsertAttendance({ classId: activeId, studentId, status, note: "" });
      if (result.ok) toast.success("Asistencia actualizada");
      else toast.error("No se ha podido guardar", { description: result.error });
    });
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="h-5 w-5" />}
        title="Sin clases programadas"
        description="Crea clases desde la sección de Grupos o Calendario."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* ── Sessions list — siempre visible en desktop, ocultable en móvil cuando hay una activa ── */}
      <aside
        className={cn(
          "rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]",
          activeSession && "hidden lg:block",
        )}
      >
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Clases
          </p>
        </div>
        <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto p-2 lg:max-h-[600px]">
          {sessions.map((session) => {
            const active = session.id === activeId;
            const sessionRecords = recordsByClass.get(session.id);
            const groupSize = students.filter(
              (s) => s.active && s.groupId === session.groupId,
            ).length;
            const marked = sessionRecords?.size ?? 0;
            return (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(session.id)}
                  className={cn(
                    "relative w-full rounded-lg p-3 text-left transition-colors",
                    active
                      ? "bg-[var(--surface-muted)]"
                      : "hover:bg-[var(--surface-muted)]/60",
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-[var(--accent)]" />
                  )}
                  <p className="text-[13.5px] font-semibold">{session.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                    {formatLongDate(session.date)} · {session.startTime}–{session.endTime}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[var(--muted)]">{session.groupName}</span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 font-semibold",
                        marked === 0
                          ? "bg-[var(--surface-muted)] text-[var(--muted)]"
                          : marked === groupSize
                            ? "bg-[var(--success-soft)] text-[var(--success)]"
                            : "bg-[var(--warning-soft)] text-[var(--warning)]",
                      )}
                    >
                      {marked}/{groupSize}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Active session panel ── */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
        {activeSession ? (
          <>
            <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
              {/* Back button — solo en móvil */}
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] lg:hidden"
                aria-label="Volver a la lista"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold">{activeSession.title}</p>
                <p className="truncate text-[11.5px] text-[var(--muted)]">
                  {formatLongDate(activeSession.date)} · {activeSession.startTime}–{activeSession.endTime}
                </p>
              </div>
              <Badge tone="primary">{activeSession.groupName}</Badge>
            </header>

            {groupStudents.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<CalendarClock className="h-5 w-5" />}
                  title="Este grupo no tiene alumnos activos"
                  description="Asigna alumnos al grupo desde la ficha del alumno."
                />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {groupStudents.map((student) => {
                  const record = records.get(student.id);
                  return (
                    <li
                      key={student.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                      <p className="text-[13.5px] font-medium">{student.fullName}</p>
                      <div className="flex gap-1.5">
                        {STATUS_OPTIONS.map((option) => {
                          const active = record?.status === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => handleChange(student.id, option.value)}
                              className={cn(
                                "flex-1 rounded-md border px-3 py-2 text-[12px] font-bold transition-colors sm:flex-none sm:py-1.5",
                                active
                                  ? option.className
                                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] active:bg-[var(--surface-muted)]",
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <div className="hidden p-8 lg:block">
            <EmptyState
              icon={<CalendarClock className="h-5 w-5" />}
              title="Selecciona una clase"
              description="A la izquierda tienes las clases programadas. Pincha para registrar."
            />
          </div>
        )}
      </section>
    </div>
  );
}
