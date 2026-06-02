"use client";

import { CheckCircle2, Download, Plus, Search, Sparkles, Trash2, Undo2 } from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatsPanel } from "@/components/admin/stats-panel";
import {
  createLessonAction,
  deleteLessonAction,
  toggleLessonPaid,
  type LessonInput,
} from "@/lib/admin/actions/private-lessons";
import { formatMoney, formatShortDate } from "@/lib/format";

type Lesson = {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string | null;
  teacherName: string;
  date: string;
  price: number;
  status: "pagado" | "pendiente" | "atrasado";
};

type Student = { id: string; fullName: string };
type Teacher = { id: string; fullName: string };

const statusTone: Record<Lesson["status"], "success" | "warning" | "danger"> = {
  pagado: "success",
  pendiente: "warning",
  atrasado: "danger",
};

const statusLabel: Record<Lesson["status"], string> = {
  pagado: "Cobrado",
  pendiente: "Pendiente",
  atrasado: "Atrasado",
};

export function PrivateLessonsManager({
  lessons,
  students,
  teachers,
}: {
  lessons: Lesson[];
  students: Student[];
  teachers: Teacher[];
}) {
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | Lesson["status"]>("all");
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<Lesson | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lessons.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return (
        l.studentName.toLowerCase().includes(q) ||
        l.teacherName.toLowerCase().includes(q)
      );
    });
  }, [lessons, filter, query]);

  const totals = useMemo(() => {
    const paid = lessons.filter((l) => l.status === "pagado");
    const pending = lessons.filter((l) => l.status !== "pagado");
    return {
      total: lessons.length,
      paid: paid.reduce((acc, l) => acc + l.price, 0),
      pendingAmount: pending.reduce((acc, l) => acc + l.price, 0),
      pendingCount: pending.length,
    };
  }, [lessons]);

  function togglePaid(lesson: Lesson) {
    setPendingId(lesson.id);
    startTransition(async () => {
      const result = await toggleLessonPaid(
        lesson.id,
        lesson.status === "pagado" ? "pendiente" : "pagado",
      );
      setPendingId(null);
      if (result.ok)
        toast.success(
          lesson.status === "pagado" ? "Marcada como pendiente" : "Marcada como cobrada",
        );
      else toast.error("No se ha podido actualizar", { description: result.error });
    });
  }

  function handleDelete(lesson: Lesson) {
    setDeleting(lesson);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setPendingId(target.id);
    startTransition(async () => {
      const result = await deleteLessonAction(target.id);
      setPendingId(null);
      if (result.ok) toast.success("Clase eliminada");
      else toast.error("No se ha podido eliminar", { description: result.error });
    });
  }

  function exportCsv() {
    const rows = [
      ["Alumno", "Entrenador", "Fecha", "Precio", "Estado"],
      ...filtered.map((l) => [
        l.studentName,
        l.teacherName,
        l.date,
        l.price.toFixed(2),
        statusLabel[l.status],
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clases-particulares-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: Column<Lesson>[] = [
    {
      key: "student",
      label: "Alumno · Entrenador",
      width: "minmax(200px, 2fr)",
      sortAccessor: (l) => l.studentName,
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{l.studentName}</p>
          <p className="truncate text-[11.5px] text-[var(--muted)]">{l.teacherName}</p>
        </div>
      ),
    },
    {
      key: "date",
      label: "Fecha",
      width: "110px",
      sortAccessor: (l) => l.date,
      render: (l) => (
        <span className="text-[12.5px] text-[var(--muted)]">{formatShortDate(l.date)}</span>
      ),
    },
    {
      key: "price",
      label: "Precio",
      width: "100px",
      align: "right",
      sortAccessor: (l) => l.price,
      render: (l) => <span className="font-bold">{formatMoney(l.price, true)}</span>,
    },
    {
      key: "status",
      label: "Estado",
      width: "120px",
      sortAccessor: (l) => l.status,
      render: (l) => <Badge tone={statusTone[l.status]}>{statusLabel[l.status]}</Badge>,
    },
    {
      key: "actions",
      label: "",
      width: "auto",
      align: "right",
      render: (l) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant={l.status === "pagado" ? "ghost" : "accent"}
            loading={pendingId === l.id}
            onClick={(e) => {
              e.stopPropagation();
              togglePaid(l);
            }}
            iconLeft={
              l.status === "pagado" ? (
                <Undo2 className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )
            }
          >
            {l.status === "pagado" ? "Revertir" : "Cobrar"}
          </Button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(l);
            }}
            disabled={pendingId === l.id}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-40"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <StatsPanel
        columns={3}
        stats={[
          { label: "Clases registradas", value: totals.total },
          {
            label: "Cobrado",
            value: formatMoney(totals.paid),
            tone: "success",
          },
          {
            label: "Pendiente",
            value: formatMoney(totals.pendingAmount),
            unit: `${totals.pendingCount} ${totals.pendingCount === 1 ? "clase" : "clases"}`,
            tone: "warning",
          },
        ]}
      />

      {/* Filter row */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              className="h-10"
              placeholder="Buscar alumno o entrenador…"
              iconLeft={<Search className="h-3.5 w-3.5" />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            variant="accent"
            size="sm"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() => setCreating(true)}
            className="h-10"
          >
            <span className="hidden sm:inline">Nueva clase</span>
          </Button>
        </div>
        <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
          <FilterChip
            label="Estado"
            value={filter === "all" ? undefined : statusLabel[filter]}
            onClick={() => {
              const order = ["all", "pendiente", "atrasado", "pagado"] as const;
              const idx = order.indexOf(filter);
              setFilter(order[(idx + 1) % order.length] as typeof filter);
            }}
            onClear={() => setFilter("all")}
          />
          <div className="flex-1" />
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Download className="h-3.5 w-3.5" />}
            onClick={exportCsv}
            className="hidden sm:inline-flex"
          >
            Exportar
          </Button>
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(l) => l.id}
        defaultSort={{ key: "date", direction: "desc" }}
        defaultPageSize={25}
        isActiveRow={(l) => l.status === "atrasado"}
        emptyState={
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title={lessons.length === 0 ? "Sin clases registradas" : "Sin resultados"}
            description={
              lessons.length === 0
                ? "Da de alta la primera clase particular para empezar."
                : "Cambia el filtro o ajusta la búsqueda."
            }
            action={
              lessons.length === 0 && (
                <Button
                  variant="accent"
                  iconLeft={<Plus className="h-4 w-4" />}
                  onClick={() => setCreating(true)}
                >
                  Nueva clase
                </Button>
              )
            }
          />
        }
        mobileCard={(l) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{l.studentName}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">
                  {formatShortDate(l.date)} · {l.teacherName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-bold">{formatMoney(l.price, true)}</p>
                <Badge tone={statusTone[l.status]}>{statusLabel[l.status]}</Badge>
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant={l.status === "pagado" ? "ghost" : "accent"}
                loading={pendingId === l.id}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePaid(l);
                }}
                iconLeft={
                  l.status === "pagado" ? (
                    <Undo2 className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )
                }
              >
                {l.status === "pagado" ? "Revertir" : "Cobrar"}
              </Button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(l);
                }}
                disabled={pendingId === l.id}
                className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted)] active:bg-[var(--danger-soft)]"
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Borrar clase particular?"
        description={
          deleting
            ? `Vas a borrar la clase de ${deleting.studentName}. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Sí, borrar"
      />

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva clase particular" size="md">
        <LessonForm
          students={students}
          teachers={teachers}
          onCancel={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      </Modal>
    </>
  );
}

function LessonForm({
  students,
  teachers,
  onCancel,
  onSaved,
}: {
  students: Student[];
  teachers: Teacher[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<LessonInput>({
    studentId: students[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    price: 30,
    paymentStatus: "pendiente",
    professorId: teachers[0]?.id ?? null,
  });
  const [pending, startTransition] = useTransition();

  function set<K extends keyof LessonInput>(key: K, value: LessonInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createLessonAction(values);
      if (result.ok) {
        toast.success("Clase particular registrada");
        onSaved();
      } else {
        toast.error("No se ha podido guardar", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Alumno" required>
        <Select value={values.studentId} onChange={(e) => set("studentId", e.target.value)}>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.fullName}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha" required>
          <Input type="date" value={values.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Precio (€)" required>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={values.price}
            onChange={(e) => set("price", Number(e.target.value))}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Entrenador">
          <Select
            value={values.professorId ?? ""}
            onChange={(e) => set("professorId", e.target.value || null)}
          >
            <option value="">Sin asignar</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estado de pago">
          <Select
            value={values.paymentStatus}
            onChange={(e) => set("paymentStatus", e.target.value as LessonInput["paymentStatus"])}
          >
            <option value="pendiente">Pendiente</option>
            <option value="atrasado">Atrasado</option>
            <option value="pagado">Cobrado al instante</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" loading={pending} iconLeft={<Sparkles className="h-4 w-4" />}>
          Crear clase
        </Button>
      </div>
    </form>
  );
}
