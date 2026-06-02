"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { recordAdminActivity } from "@/lib/admin/activity";
import { normalizeWhatsappNumber } from "@/lib/format";
import {
  buildTemplateComponents,
  isRetryableWhatsappError,
  isWhatsappConfigured,
  jitterDelay,
  sendViaProvider,
  whatsappErrorMessage,
} from "@/lib/whatsapp";

const PaymentSchema = z.object({
  studentId: z.string().uuid(),
  concept: z.string().trim().min(1, "Describe el concepto"),
  amount: z.coerce.number().min(0, "El importe no puede ser negativo"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["pagado", "pendiente", "atrasado"]),
  method: z.enum(["efectivo", "transferencia", "bizum"]).optional().nullable(),
  campusCourseId: z.string().uuid().optional().nullable(),
});

const ReminderSchema = z.object({
  paymentId: z.string().uuid(),
});

export type PaymentInput = z.output<typeof PaymentSchema>;
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

function nextAttemptAt(attemptCount: number) {
  const delays = [30, 90, 180, 300, 600, 1200, 1800];
  const delaySeconds = delays[Math.min(Math.max(attemptCount - 1, 0), delays.length - 1)];
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

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
        paid_at: data.status === "pagado" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) throw error;
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
  options: { notifyWhatsapp?: boolean } = { notifyWhatsapp: true },
): Promise<ActionResult<{ whatsappQueued: boolean }>> {
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

    let whatsappQueued = false;
    if (options.notifyWhatsapp !== false) {
      whatsappQueued = await queueReceiptWhatsapp(paymentId);
    }

    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    revalidatePath("/admin/whatsapp");
    revalidatePath("/admin/campus", "layout");
    return { ok: true, data: { whatsappQueued } };
  } catch (error) {
    return fail(error);
  }
}

export async function sendPaymentReminderAction(
  input: z.input<typeof ReminderSchema>,
): Promise<ActionResult<{ status: "sent" | "queued" }>> {
  try {
    const data = ReminderSchema.parse(input);
    if (!isWhatsappConfigured()) return { ok: false, error: "Meta WhatsApp no configurado" };
    const { supabase, profile } = await requireAdmin();
    const [paymentRes, templateRes] = await Promise.all([
      supabase
        .from("payments")
        .select(
          "id, concept, amount, student_id, students(first_name, last_name, guardians(full_name, phone))",
        )
        .eq("id", data.paymentId)
        .maybeSingle(),
      supabase
        .from("message_templates")
        .select("id, meta_template_name, body, language, components_schema")
        .eq("category", "recibo")
        .eq("meta_status", "approved")
        .not("meta_template_name", "is", null)
        .limit(1)
        .maybeSingle(),
    ]);
    if (!paymentRes.data) return { ok: false, error: "Recibo no encontrado" };
    if (!templateRes.data) return { ok: false, error: "No hay plantilla de recibo aprobada en Meta" };

    const student = Array.isArray(paymentRes.data.students)
      ? paymentRes.data.students[0]
      : paymentRes.data.students;
    const guardian = Array.isArray(student?.guardians) ? student?.guardians[0] : student?.guardians;
    const phone = guardian?.phone ? normalizeWhatsappNumber(guardian.phone) : "";
    if (!student || !guardian || !phone) return { ok: false, error: "El alumno no tiene tutor con WhatsApp válido" };

    const variables: Record<string, string> = {
      "1": guardian.full_name.split(" ")[0] ?? guardian.full_name,
      "2": paymentRes.data.concept,
      "3": String(paymentRes.data.amount ?? ""),
    };
    const body = renderTemplate(templateRes.data.body, variables);
    const components = buildTemplateComponents(
      variables,
      templateRes.data.components_schema as { body?: { variables?: string[] } } | null,
    );
    const { data: row, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        recipient_name: guardian.full_name,
        recipient_phone: phone,
        template_id: templateRes.data.id,
        template_name: templateRes.data.meta_template_name || "recibo",
        template_language: templateRes.data.language ?? "es",
        template_variables: variables,
        status: "queued",
        related_type: "recibo",
        related_id: data.paymentId,
        body_text: body,
        payload: {
          ...variables,
          body,
          payment_reminder: true,
          concept: paymentRes.data.concept,
          student_name: `${student.first_name} ${student.last_name}`,
        },
      })
      .select("id")
      .single();
    if (insertError || !row) throw insertError ?? new Error("No se pudo registrar el recordatorio");

    try {
      const result = await sendViaProvider({
        to: phone,
        template: {
          name: templateRes.data.meta_template_name,
          language: templateRes.data.language ?? "es",
          components,
        },
        delayMs: jitterDelay(),
      });
      await supabase
        .from("whatsapp_messages")
        .update({ status: "sent", provider_message_id: result.id, sent_at: new Date().toISOString() })
        .eq("id", row.id);
      await recordAdminActivity(supabase, {
        eventType: "payment_reminder_sent",
        entityType: "payment",
        entityId: data.paymentId,
        summary: `Recordatorio enviado a ${guardian.full_name}`,
        actorId: profile.id,
        metadata: { whatsappMessageId: row.id },
      });
      revalidatePath("/admin/payments");
      revalidatePath("/admin/whatsapp");
      return { ok: true, data: { status: "sent" } };
    } catch (error) {
      const retryable = isRetryableWhatsappError(error);
      const errorMessage = whatsappErrorMessage(error);
      const nowIso = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({
          status: retryable ? "queued" : "failed",
          error_message: retryable ? `${errorMessage}. Se reintentará automáticamente.` : errorMessage,
          attempt_count: 1,
          last_attempt_at: nowIso,
          next_attempt_at: retryable ? nextAttemptAt(1) : null,
        })
        .eq("id", row.id);
      if (!retryable) return { ok: false, error: errorMessage };
      await recordAdminActivity(supabase, {
        eventType: "payment_reminder_queued",
        entityType: "payment",
        entityId: data.paymentId,
        summary: `Recordatorio en cola para ${guardian.full_name}`,
        actorId: profile.id,
        metadata: { whatsappMessageId: row.id },
      });
      revalidatePath("/admin/payments");
      revalidatePath("/admin/whatsapp");
      return { ok: true, data: { status: "queued" } };
    }
  } catch (error) {
    return fail(error);
  }
}

async function queueReceiptWhatsapp(paymentId: string): Promise<boolean> {
  if (!isWhatsappConfigured()) return false;
  try {
    const { supabase } = await requireAdmin();
    const [paymentRes, templateRes] = await Promise.all([
      supabase
        .from("payments")
        .select(
          "id, concept, amount, student_id, students(first_name, last_name, guardians(full_name, phone))",
        )
        .eq("id", paymentId)
        .maybeSingle(),
      supabase
        .from("message_templates")
        .select("id, meta_template_name, body, language, components_schema")
        .eq("category", "recibo")
        .eq("meta_status", "approved")
        .not("meta_template_name", "is", null)
        .limit(1)
        .maybeSingle(),
    ]);

    if (!templateRes.data || !paymentRes.data) return false;
    const payment = paymentRes.data;
    const student = Array.isArray(payment.students) ? payment.students[0] : payment.students;
    if (!student) return false;
    const guardian = Array.isArray(student.guardians) ? student.guardians[0] : student.guardians;
    if (!guardian) return false;

    const phone = normalizeWhatsappNumber(guardian.phone);
    if (!phone) return false;

    const { data: receipt } = await supabase
      .from("receipts")
      .select("receipt_number")
      .eq("payment_id", paymentId)
      .maybeSingle();

    const variables: Record<string, string> = {
      "1": guardian.full_name.split(" ")[0] ?? guardian.full_name,
      "2": receipt?.receipt_number ?? "",
      "3": String(payment.amount ?? ""),
    };

    const body = renderTemplate(templateRes.data.body, variables);
    const components = buildTemplateComponents(
      variables,
      templateRes.data.components_schema as { body?: { variables?: string[] } } | null,
    );

    const { data: row, error } = await supabase
      .from("whatsapp_messages")
      .insert({
        recipient_name: guardian.full_name,
        recipient_phone: phone,
        template_id: templateRes.data.id,
        template_name: templateRes.data.meta_template_name || "recibo",
        status: "queued",
        related_type: "recibo",
        related_id: paymentId,
        body_text: body,
        payload: {
          ...variables,
          body,
          concept: payment.concept,
          student_name: `${student.first_name} ${student.last_name}`,
        },
      })
      .select("id")
      .single();
    if (error || !row) return false;

    try {
      const result = await sendViaProvider({
        to: phone,
        template: {
          name: templateRes.data.meta_template_name,
          language: templateRes.data.language ?? "es",
          components,
        },
        delayMs: jitterDelay(),
      });
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "sent",
          provider_message_id: result.id,
          sent_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return true;
    } catch (error) {
      const retryable = isRetryableWhatsappError(error);
      const errorMessage = whatsappErrorMessage(error);
      const nowIso = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({
          status: retryable ? "queued" : "failed",
          error_message: retryable
            ? `${errorMessage}. Se reintentará automáticamente.`
            : errorMessage,
          attempt_count: 1,
          last_attempt_at: nowIso,
          next_attempt_at: retryable ? nextAttemptAt(1) : null,
        })
        .eq("id", row.id);
      return retryable;
    }
  } catch {
    return false;
  }
}

function renderTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{(\d+|[a-zA-Z_]\w*)\}\}/g, (_, key) => variables[String(key)] ?? `{{${key}}}`);
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
