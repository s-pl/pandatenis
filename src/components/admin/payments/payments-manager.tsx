"use client";

import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  PieChart,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { FormEvent, useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { StatsPanel } from "@/components/admin/stats-panel";
import {
  createPaymentAction,
  deletePaymentAction,
  markPaymentPaid,
  type PaymentInput,
} from "@/lib/admin/actions/payments";
import { formatMoney, formatShortDate } from "@/lib/format";
import { VAT_OPTIONS, vatChoiceFor, vatChoiceToFields, type VatChoice } from "@/lib/invoice";
import { Link } from "@/i18n/navigation";

type Payment = {
  id: string;
  studentId: string;
  studentName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  concept: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: "pagado" | "pendiente" | "atrasado";
  method: "efectivo" | "transferencia" | "bizum" | null;
  receiptNumber: string | null;
};

type Student = {
  id: string;
  fullName: string;
  guardianName: string | null;
  guardianPhone: string | null;
};

const statusTone: Record<Payment["status"], "success" | "warning" | "danger"> = {
  pagado: "success",
  pendiente: "warning",
  atrasado: "danger",
};
const statusLabel: Record<Payment["status"], string> = {
  pagado: "Cobrado",
  pendiente: "Pendiente",
  atrasado: "Atrasado",
};
const methodLabel: Record<NonNullable<Payment["method"]>, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  bizum: "Bizum",
};

const TAB_ITEMS: TabItem[] = [
  { value: "resumen", label: "Resumen", icon: <PieChart className="h-4 w-4" /> },
  { value: "facturas", label: "Facturas", icon: <FileText className="h-4 w-4" /> },
  { value: "deudas", label: "Deudas", icon: <AlertCircle className="h-4 w-4" /> },
];

export function PaymentsManager({
  payments,
  students,
  campusCourseId,
}: {
  payments: Payment[];
  students: Student[];
  /** Si se pasa, los recibos creados desde aquí quedan vinculados a este campus. */
  campusCourseId?: string;
}) {
  const [tab, setTab] = useState<string>("facturas");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Payment["status"]>("all");
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const [, startTransition] = useTransition();
  const [, startPay] = useTransition();

  // Cobro optimista: la fila pasa a "pagado" al instante; cuando el server
  // revalida /admin/payments, la prop real sustituye al estado optimista.
  const [optimisticPayments, markPaidOptimistic] = useOptimistic(
    payments,
    (state: Payment[], patch: { id: string; method: Payment["method"] }) =>
      state.map((p) =>
        p.id === patch.id ? { ...p, status: "pagado" as const, method: patch.method } : p,
      ),
  );

  function confirmPaid(payment: Payment, method: NonNullable<Payment["method"]>) {
    setConfirming(null);
    startPay(async () => {
      markPaidOptimistic({ id: payment.id, method });
      const result = await markPaymentPaid(payment.id, method);
      if (result.ok) {
        if (result.data?.smsWarning) {
          toast.warning("Recibo cobrado · SMS no enviado", {
            description: result.data.smsWarning,
          });
        } else {
          toast.success("Recibo cobrado", { description: "Recibo numerado · SMS enviado." });
        }
      } else {
        toast.error("No se ha podido cobrar", { description: result.error });
      }
    });
  }

  // Aggregates for stats panel
  const totals = useMemo(() => {
    const paid = optimisticPayments.filter((p) => p.status === "pagado");
    const pending = optimisticPayments.filter((p) => p.status === "pendiente");
    const overdue = optimisticPayments.filter((p) => p.status === "atrasado");
    return {
      total: optimisticPayments.reduce((acc, p) => acc + p.amount, 0),
      paid: paid.reduce((acc, p) => acc + p.amount, 0),
      pending: pending.reduce((acc, p) => acc + p.amount, 0),
      overdue: overdue.reduce((acc, p) => acc + p.amount, 0),
      paidCount: paid.length,
      pendingCount: pending.length,
      overdueCount: overdue.length,
      receiptsCount: optimisticPayments.filter((p) => p.receiptNumber).length,
    };
  }, [optimisticPayments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return optimisticPayments.filter((payment) => {
      if (tab === "deudas" && payment.status === "pagado") return false;
      if (status !== "all" && payment.status !== status) return false;
      if (!q) return true;
      return (
        payment.studentName.toLowerCase().includes(q) ||
        payment.concept.toLowerCase().includes(q) ||
        (payment.receiptNumber?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [optimisticPayments, status, query, tab]);

  function handleDelete(payment: Payment) {
    setDeleting(payment);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const result = await deletePaymentAction(target.id);
      if (result.ok) toast.success("Recibo eliminado");
      else toast.error("No se ha podido eliminar", { description: result.error });
    });
  }

  function exportCsv() {
    const rows = [
      ["Recibo", "Alumno", "Concepto", "Importe", "Vence", "Estado", "Método", "Cobrado"],
      ...filtered.map((p) => [
        p.receiptNumber ?? "",
        p.studentName,
        p.concept,
        p.amount.toFixed(2),
        p.dueDate,
        statusLabel[p.status],
        p.method ? methodLabel[p.method] : "",
        p.paidAt ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recibos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Table columns (used in Facturas & Deudas tabs) ───
  const columns: Column<Payment>[] = [
    {
      key: "student",
      label: "Alumno · Concepto",
      width: "minmax(220px, 2fr)",
      sortAccessor: (p) => p.studentName,
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{p.studentName}</p>
          <p className="truncate text-[11.5px] text-[var(--muted)]">{p.concept}</p>
        </div>
      ),
    },
    {
      key: "due",
      label: "Vence",
      width: "110px",
      hideOnMobile: true,
      sortAccessor: (p) => p.dueDate,
      render: (p) => (
        <span className="text-[12.5px] text-[var(--muted)]">{formatShortDate(p.dueDate)}</span>
      ),
    },
    {
      key: "amount",
      label: "Importe",
      width: "110px",
      align: "right",
      sortAccessor: (p) => p.amount,
      render: (p) => <span className="font-bold">{formatMoney(p.amount, true)}</span>,
    },
    {
      key: "status",
      label: "Estado",
      width: "150px",
      sortAccessor: (p) => p.status,
      render: (p) => (
        <div>
          <Badge tone={statusTone[p.status]}>{statusLabel[p.status]}</Badge>
          {p.status === "pagado" && p.method && (
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">{methodLabel[p.method]}</p>
          )}
        </div>
      ),
    },
    {
      key: "receipt",
      label: "Seguimiento",
      width: "150px",
      hideOnMobile: true,
      render: (p) => (
        <div className="text-[11.5px]">
          {p.receiptNumber ? (
            <span className="inline-block rounded-md bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[11px]">
              {p.receiptNumber}
            </span>
          ) : (
            <span className="text-[var(--muted)]">Sin recibo</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      width: "auto",
      align: "right",
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          {p.status !== "pagado" && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(p);
              }}
              iconLeft={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Cobrar
            </Button>
          )}
          <Link
            href={`/factura/${p.id}`}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            aria-label="Ver factura"
            title={p.receiptNumber ? "Ver factura" : "Vista previa (proforma)"}
          >
            <FileText className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(p);
            }}
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
            aria-label="Eliminar recibo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {/* ── RESUMEN ──────────────────────────────── */}
      {tab === "resumen" && (
        <>
          <StatsPanel
            stats={[
              {
                label: "Total facturado",
                value: formatMoney(totals.total),
                icon: <Wallet className="h-3 w-3" />,
              },
              {
                label: "Cobrado",
                value: formatMoney(totals.paid),
                unit: `${totals.paidCount} ${totals.paidCount === 1 ? "recibo" : "recibos"}`,
                tone: "success",
              },
              {
                label: "Pendiente",
                value: formatMoney(totals.pending),
                unit: `${totals.pendingCount} ${totals.pendingCount === 1 ? "recibo" : "recibos"}`,
                tone: "warning",
              },
              {
                label: "Atrasado",
                value: formatMoney(totals.overdue),
                unit: `${totals.overdueCount} ${totals.overdueCount === 1 ? "recibo" : "recibos"}`,
                tone: "danger",
              },
            ]}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Tasa de cobro
              </p>
              <p className="mt-2 text-[2rem] font-bold leading-none">
                {totals.total === 0 ? "—" : `${Math.round((totals.paid / totals.total) * 100)}%`}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-full bg-[var(--success)]"
                  style={{
                    width: `${totals.total === 0 ? 0 : (totals.paid / totals.total) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[12px] text-[var(--muted)]">
                {formatMoney(totals.paid)} cobrados de {formatMoney(totals.total)} facturados
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Recibos generados
              </p>
              <p className="mt-2 text-[2rem] font-bold leading-none">{totals.receiptsCount}</p>
              <p className="mt-3 text-[12px] text-[var(--muted)]">
                Cada cobro confirmado genera un número de recibo oficial automáticamente.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── FACTURAS / DEUDAS ─────────────────────── */}
      {(tab === "facturas" || tab === "deudas") && (
        <>
          {/* Filter row — mobile-first */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  className="h-10"
                  placeholder="Buscar alumno, concepto o recibo…"
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
                <span className="hidden sm:inline">Nuevo recibo</span>
              </Button>
            </div>
            <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
              <FilterChip
                label="Estado"
                value={status === "all" ? undefined : statusLabel[status]}
                onClick={() => {
                  const order = ["all", "pendiente", "atrasado", "pagado"] as const;
                  const idx = order.indexOf(status);
                  setStatus(order[(idx + 1) % order.length] as typeof status);
                }}
                onClear={() => setStatus("all")}
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
            rowKey={(p) => p.id}
            defaultSort={{ key: "due", direction: "desc" }}
            defaultPageSize={25}
            enableColumnToggle
            isActiveRow={(p) => p.status === "atrasado"}
            mobileCard={(p) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{p.studentName}</p>
                    <p className="truncate text-[11.5px] text-[var(--muted)]">{p.concept}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold">{formatMoney(p.amount, true)}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                      vence {formatShortDate(p.dueDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone[p.status]}>{statusLabel[p.status]}</Badge>
                    {p.receiptNumber && (
                      <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[10.5px]">
                        {p.receiptNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.status !== "pagado" && (
                      <Button
                        size="sm"
                        variant="accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirming(p);
                        }}
                        iconLeft={<CheckCircle2 className="h-3.5 w-3.5" />}
                      >
                        Cobrar
                      </Button>
                    )}
                    <Link
                      href={`/factura/${p.id}`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted)] active:bg-[var(--surface-muted)]"
                      aria-label="Ver factura"
                    >
                      <FileText className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p);
                      }}
                      className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted)] active:bg-[var(--danger-soft)]"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            emptyState={
              <EmptyState
                icon={<Receipt className="h-5 w-5" />}
                title={
                  payments.length === 0
                    ? "Aún no hay recibos"
                    : "Sin resultados con esos filtros"
                }
                description={
                  payments.length === 0
                    ? "Crea el primer recibo eligiendo un alumno, un concepto y un importe."
                    : "Cambia el estado o ajusta la búsqueda."
                }
                action={
                  payments.length === 0 && (
                    <Button
                      variant="accent"
                      iconLeft={<Plus className="h-4 w-4" />}
                      onClick={() => setCreating(true)}
                    >
                      Nuevo recibo
                    </Button>
                  )
                }
              />
            }
          />
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Borrar recibo?"
        description={
          deleting
            ? `Vas a borrar el recibo de ${deleting.studentName} por ${deleting.concept} (${formatMoney(deleting.amount, true)}). Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Sí, borrar"
      />

      {/* Modals */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Crear recibo"
        description="Asigna un importe a un alumno, fija la fecha de vencimiento y elige el estado inicial."
        size="md"
      >
        <PaymentForm
          students={students}
          campusCourseId={campusCourseId}
          onCancel={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      </Modal>

      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={confirming ? `Cobrar recibo` : ""}
        description={
          confirming
            ? `${confirming.studentName} · ${confirming.concept} · ${formatMoney(confirming.amount, true)}`
            : undefined
        }
        size="sm"
      >
        {confirming && (
          <ConfirmPaymentForm
            payment={confirming}
            onCancel={() => setConfirming(null)}
            onConfirm={(method) => confirmPaid(confirming, method)}
          />
        )}
      </Modal>
    </>
  );
}

// ─── Forms (unchanged behavior) ─────────────────────────
function PaymentForm({
  students,
  campusCourseId,
  onCancel,
  onSaved,
}: {
  students: Student[];
  campusCourseId?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<PaymentInput>({
    studentId: students[0]?.id ?? "",
    concept: campusCourseId ? "Cuota campus" : "Cuota mensual",
    amount: 80,
    dueDate: new Date().toISOString().slice(0, 10),
    status: "pendiente",
    method: null,
    campusCourseId: campusCourseId ?? null,
    vatExempt: true,
    vatRate: 0,
  });
  const [pending, startTransition] = useTransition();

  function set<K extends keyof PaymentInput>(key: K, value: PaymentInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createPaymentAction(values);
      if (result.ok) {
        toast.success("Recibo creado");
        onSaved();
      } else {
        toast.error("No se ha podido crear", { description: result.error });
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
      <Field label="Concepto" required>
        <Input value={values.concept} onChange={(e) => set("concept", e.target.value)} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Importe (€)" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={values.amount}
            onChange={(e) => set("amount", Number(e.target.value))}
          />
        </Field>
        <Field label="Fecha de vencimiento" required>
          <Input
            type="date"
            value={values.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="IVA"
        hint="El importe ya incluye el IVA. Por defecto, exento (Art. 20 LIVA) para una entidad sin ánimo de lucro."
      >
        <Select
          value={vatChoiceFor(values.vatExempt ?? true, values.vatRate ?? 0)}
          onChange={(e) => {
            const fields = vatChoiceToFields(e.target.value as VatChoice);
            setValues((prev) => ({ ...prev, vatExempt: fields.vatExempt, vatRate: fields.vatRate }));
          }}
        >
          {VAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Estado inicial">
        <Select value={values.status} onChange={(e) => set("status", e.target.value as PaymentInput["status"])}>
          <option value="pendiente">Pendiente</option>
          <option value="atrasado">Atrasado</option>
          <option value="pagado">Pagado al instante</option>
        </Select>
      </Field>
      {values.status === "pagado" && (
        <Field label="Método de pago" required>
          <Select
            value={values.method ?? "efectivo"}
            onChange={(e) => set("method", e.target.value as PaymentInput["method"])}
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="bizum">Bizum</option>
          </Select>
        </Field>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending} iconLeft={<CreditCard className="h-4 w-4" />}>
          Crear recibo
        </Button>
      </div>
    </form>
  );
}

function ConfirmPaymentForm({
  onCancel,
  onConfirm,
}: {
  payment: Payment;
  onCancel: () => void;
  onConfirm: (method: "efectivo" | "transferencia" | "bizum") => void;
}) {
  const [method, setMethod] = useState<"efectivo" | "transferencia" | "bizum">("transferencia");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm(method);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="¿Cómo se ha pagado?" required>
        <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="bizum">Bizum</option>
        </Select>
      </Field>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" iconLeft={<CheckCircle2 className="h-4 w-4" />}>
          Confirmar cobro
        </Button>
      </div>
    </form>
  );
}
