import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { PaymentsManager } from "@/components/admin/payments/payments-manager";
import { requireAdmin } from "@/lib/dal";
import { formatMoney } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("payments") };
}
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.payments");

  const [paymentsRes, studentsRes, receiptsRes, remindersRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, student_id, concept, amount, due_date, paid_at, status, method")
      .order("due_date", { ascending: false })
      .limit(4000),
    supabase
      .from("students")
      .select("id, first_name, last_name, guardians(phone, full_name)")
      .order("first_name")
      .limit(2000),
    supabase
      .from("receipts")
      .select("id, payment_id, receipt_number, generated_at")
      .order("generated_at", { ascending: false }),
    supabase
      .from("whatsapp_messages")
      .select("id, related_id, status, created_at, sent_at, error_message")
      .eq("related_type", "recibo")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const students = (studentsRes.data ?? []).map((row) => {
    const guardian = Array.isArray(row.guardians) ? row.guardians[0] : row.guardians;
    return {
      id: row.id,
      fullName: `${row.first_name} ${row.last_name}`,
      guardianName: guardian?.full_name ?? null,
      guardianPhone: guardian?.phone ?? null,
    };
  });
  // Índice por id para evitar un find O(n) por cada pago (N+1).
  const studentById = new Map(students.map((s) => [s.id, s]));

  const receiptByPayment = new Map(
    (receiptsRes.data ?? []).map((row) => [row.payment_id, { id: row.id, receiptNumber: row.receipt_number, generatedAt: row.generated_at }]),
  );
  const remindersByPayment = new Map<string, { status: string; at: string; error: string | null }>();
  for (const row of remindersRes.data ?? []) {
    if (!row.related_id || remindersByPayment.has(row.related_id)) continue;
    remindersByPayment.set(row.related_id, {
      status: row.status,
      at: row.sent_at ?? row.created_at,
      error: row.error_message ?? null,
    });
  }

  const payments = (paymentsRes.data ?? []).map((row) => {
    const student = studentById.get(row.student_id);
    const receipt = receiptByPayment.get(row.id);
    const reminder = remindersByPayment.get(row.id);
    return {
      id: row.id,
      studentId: row.student_id,
      studentName: student?.fullName ?? "—",
      guardianName: student?.guardianName ?? null,
      guardianPhone: student?.guardianPhone ?? null,
      concept: row.concept,
      amount: Number(row.amount),
      dueDate: row.due_date,
      paidAt: row.paid_at,
      status: row.status as "pagado" | "pendiente" | "atrasado",
      method: row.method as "efectivo" | "transferencia" | "bizum" | null,
      receiptNumber: receipt?.receiptNumber ?? null,
      lastReminderAt: reminder?.at ?? null,
      lastReminderStatus: reminder?.status ?? null,
      lastReminderError: reminder?.error ?? null,
    };
  });

  const totals = {
    paid: payments.filter((p) => p.status === "pagado").reduce((acc, p) => acc + p.amount, 0),
    pending: payments.filter((p) => p.status === "pendiente").reduce((acc, p) => acc + p.amount, 0),
    overdue: payments.filter((p) => p.status === "atrasado").reduce((acc, p) => acc + p.amount, 0),
  };

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <>
          <Badge tone="success" iconLeft={<Receipt className="h-3 w-3" />}>
            Cobrado · {formatMoney(totals.paid)}
          </Badge>
          <Badge tone="warning">Pendiente · {formatMoney(totals.pending)}</Badge>
          {totals.overdue > 0 && <Badge tone="danger">Atrasado · {formatMoney(totals.overdue)}</Badge>}
        </>
      }
    >
      <PaymentsManager payments={payments} students={students} />
    </PageShell>
  );
}
