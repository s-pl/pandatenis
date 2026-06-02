"use client";

import { Link } from "@/i18n/navigation";
import { CheckCircle2, Plus, Printer, ScrollText, Search, Send } from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  createTermReportAction,
  markReportSent,
  type ReportInput,
} from "@/lib/admin/actions/reports";
import { formatShortDate } from "@/lib/format";

type Report = {
  id: string;
  studentId: string;
  studentName: string;
  term: string;
  coachComment: string;
  sentAt: string | null;
  createdAt: string;
};

type Student = { id: string; fullName: string };

export function ReportsManager({
  reports,
  students,
}: {
  reports: Report[];
  students: Student[];
}) {
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "sent" | "pending">("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (status === "sent" && !r.sentAt) return false;
      if (status === "pending" && r.sentAt) return false;
      if (!q) return true;
      return r.studentName.toLowerCase().includes(q) || r.term.toLowerCase().includes(q);
    });
  }, [reports, query, status]);

  function handleSend(report: Report) {
    setPendingId(report.id);
    startTransition(async () => {
      const result = await markReportSent(report.id);
      setPendingId(null);
      if (result.ok) toast.success("Informe marcado como enviado");
      else toast.error("No se ha podido actualizar", { description: result.error });
    });
  }

  const columns: Column<Report>[] = [
    {
      key: "student",
      label: "Alumno · Trimestre",
      width: "minmax(220px, 2fr)",
      sortAccessor: (r) => r.studentName,
      render: (r) => (
        <div className="min-w-0">
          <Link
            href={`/admin/students/${r.studentId}`}
            onClick={(e) => e.stopPropagation()}
            className="truncate text-[13.5px] font-semibold hover:text-[var(--primary)]"
          >
            {r.studentName}
          </Link>
          <p className="truncate text-[11.5px] text-[var(--muted)]">{r.term}</p>
        </div>
      ),
    },
    {
      key: "created",
      label: "Creado",
      width: "110px",
      hideOnMobile: true,
      sortAccessor: (r) => r.createdAt,
      render: (r) => (
        <span className="text-[12.5px] text-[var(--muted)]">{formatShortDate(r.createdAt)}</span>
      ),
    },
    {
      key: "status",
      label: "Estado",
      width: "120px",
      sortAccessor: (r) => (r.sentAt ? 1 : 0),
      render: (r) =>
        r.sentAt ? (
          <Badge tone="success" iconLeft={<CheckCircle2 className="h-3 w-3" />}>
            Enviado
          </Badge>
        ) : (
          <Badge tone="warning">Pendiente</Badge>
        ),
    },
    {
      key: "actions",
      label: "",
      width: "auto",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.print();
            }}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-foreground"
            aria-label="Imprimir"
            title="Imprimir"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          {!r.sentAt && (
            <Button
              size="sm"
              variant="accent"
              loading={pendingId === r.id}
              iconLeft={<Send className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                handleSend(r);
              }}
            >
              Enviado
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              className="h-10"
              placeholder="Buscar alumno o trimestre…"
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
            <span className="hidden sm:inline">Crear informe</span>
          </Button>
        </div>
        <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
          <FilterChip
            label="Estado"
            value={status === "sent" ? "Enviados" : status === "pending" ? "Pendientes" : undefined}
            onClick={() => {
              const order = ["all", "pending", "sent"] as const;
              const idx = order.indexOf(status);
              setStatus(order[(idx + 1) % order.length] as typeof status);
            }}
            onClear={() => setStatus("all")}
          />
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        defaultSort={{ key: "created", direction: "desc" }}
        defaultPageSize={25}
        isActiveRow={(r) => !r.sentAt}
        emptyState={
          <EmptyState
            icon={<ScrollText className="h-5 w-5" />}
            title={reports.length === 0 ? "Aún no hay informes" : "Sin resultados"}
            description={
              reports.length === 0
                ? "Crea el primer informe desde aquí o desde la ficha de un alumno."
                : "Cambia el filtro o ajusta la búsqueda."
            }
            action={
              reports.length === 0 && (
                <Button
                  variant="accent"
                  iconLeft={<Plus className="h-4 w-4" />}
                  onClick={() => setCreating(true)}
                >
                  Crear informe
                </Button>
              )
            }
          />
        }
        mobileCard={(r) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/students/${r.studentId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate text-[14px] font-semibold hover:text-[var(--primary)]"
                >
                  {r.studentName}
                </Link>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">
                  {r.term} · {formatShortDate(r.createdAt)}
                </p>
              </div>
              {r.sentAt ? (
                <Badge tone="success" iconLeft={<CheckCircle2 className="h-3 w-3" />}>
                  Enviado
                </Badge>
              ) : (
                <Badge tone="warning">Pendiente</Badge>
              )}
            </div>
            {r.coachComment && (
              <p className="line-clamp-2 rounded-lg bg-[var(--surface-muted)] p-2 text-[12px] text-[var(--muted)]">
                🪶 {r.coachComment}
              </p>
            )}
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.print();
                }}
                className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted)] active:bg-[var(--surface-muted)]"
                aria-label="Imprimir"
              >
                <Printer className="h-4 w-4" />
              </button>
              {!r.sentAt && (
                <Button
                  size="sm"
                  variant="accent"
                  loading={pendingId === r.id}
                  iconLeft={<Send className="h-3.5 w-3.5" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSend(r);
                  }}
                >
                  Marcar enviado
                </Button>
              )}
            </div>
          </div>
        )}
      />

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo informe trimestral"
        size="md"
      >
        <ReportForm
          students={students}
          onCancel={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      </Modal>
    </>
  );
}

function ReportForm({
  students,
  onCancel,
  onSaved,
}: {
  students: Student[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<ReportInput>({
    studentId: students[0]?.id ?? "",
    term: suggestTerm(),
    coachComment: "",
  });
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createTermReportAction(values);
      if (result.ok) {
        toast.success("Informe creado");
        onSaved();
      } else {
        toast.error("No se ha podido crear", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Alumno" required>
        <Select
          value={values.studentId}
          onChange={(e) => setValues((prev) => ({ ...prev, studentId: e.target.value }))}
        >
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.fullName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Trimestre" required>
        <Input
          value={values.term}
          onChange={(e) => setValues((prev) => ({ ...prev, term: e.target.value }))}
          placeholder="1.er trimestre 2025/26"
        />
      </Field>
      <Field label="Comentario del entrenador">
        <Textarea
          rows={4}
          value={values.coachComment}
          onChange={(e) => setValues((prev) => ({ ...prev, coachComment: e.target.value }))}
          placeholder="Fortalezas, áreas a mejorar, plan para el próximo trimestre."
        />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" loading={pending}>
          Crear informe
        </Button>
      </div>
    </form>
  );
}

function suggestTerm() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month >= 0 && month <= 3) return `2.º trimestre ${year - 1}/${String(year).slice(2)}`;
  if (month >= 4 && month <= 7) return `3.er trimestre ${year - 1}/${String(year).slice(2)}`;
  return `1.er trimestre ${year}/${String(year + 1).slice(2)}`;
}
