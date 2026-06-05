"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { recordAdminActivity } from "@/lib/admin/activity";
import { sendPaymentConfirmation } from "@/lib/sms/notifications";

const PaymentSchema = z.object({
  studentId: z.string().uuid(),
  concept: z.string().trim().min(1, "Describe el concepto"),
  amount: z.coerce.number().min(0, "El importe no puede ser negativo"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["pagado", "pendiente", "atrasado"]),
  method: z.enum(["efectivo", "transferencia", "bizum"]).optional().nullable(),
  campusCourseId: z.string().uuid().optional().nullable(),
  vatExempt: z.boolean().optional().default(true),
  vatRate: z.coerce.number().min(0).max(21).optional().default(0),
});

export type PaymentInput = z.output<typeof PaymentSchema>;
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: "Revisa los datos del recibo",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
}

export async function createPaymentAction(input: PaymentInput): Promise<ActionResult<{ id: string }>> {
  try {
    const data = PaymentSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { data: row, error } = await supabase
      .from("payments")
      .insert({
        student_id: data.studentId,
        concept: data.concept,
        amount: data.amount,
        due_date: data.dueDate,
        status: data.status,
        method: data.method ?? null,
        campus_course_id: data.campusCourseId ?? null,
        vat_exempt: data.vatExempt,
        vat_rate: data.vatExempt ? 0 : data.vatRate,
        paid_at: data.status === "pagado" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) throw error;

    // Si el recibo nace ya cobrado, confirma por SMS (best-effort).
    if (data.status === "pagado") {
      await sendPaymentConfirmation(supabase, row.id);
    }

    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    revalidatePath("/admin/campus", "layout");
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function markPaymentPaid(
  paymentId: string,
  method: "efectivo" | "transferencia" | "bizum",
): Promise<ActionResult<{ smsWarning?: string }>> {
  try {
    const { supabase, profile } = await requireAdmin();
    const { error } = await supabase
      .from("payments")
      .update({ status: "pagado", method, paid_at: new Date().toISOString() })
      .eq("id", paymentId);
    if (error) throw error;
    await recordAdminActivity(supabase, {
      eventType: "payment_paid",
      entityType: "payment",
      entityId: paymentId,
      summary: "Recibo marcado como cobrado",
      actorId: profile.id,
      metadata: { method },
    });

    // SMS de confirmación al tutor (best-effort: no revierte el cobro).
    const sms = await sendPaymentConfirmation(supabase, paymentId);

    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    revalidatePath("/admin/campus", "layout");
    return { ok: true, data: { smsWarning: sms.ok ? undefined : sms.reason } };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePaymentAction(paymentId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("payments").delete().eq("id", paymentId);
    if (error) throw error;
    revalidatePath("/admin/payments");
    revalidatePath("/admin/campus", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
