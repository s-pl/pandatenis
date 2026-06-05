import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { appBaseUrl } from "@/lib/base-url";
import { sendAndLog } from "./send-and-log";
import { normalizeLocale, paymentConfirmSms } from "./templates";

type PaymentNotificationRow = {
  id: string;
  due_date: string | null;
  paid_at: string | null;
  student_id: string | null;
  students: {
    comm_locale: string | null;
    guardians: { phone: string | null }[] | null;
  } | null;
  receipts: { public_token: string | null }[] | null;
};

/**
 * Envía el SMS de confirmación de pago al tutor, en su idioma, con enlace al
 * recibo público. Best-effort: nunca lanza — devuelve el resultado para que el
 * llamante pueda avisar, pero un fallo de SMS jamás revierte el cobro.
 */
export async function sendPaymentConfirmation(
  supabase: SupabaseClient,
  paymentId: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, due_date, paid_at, student_id, students(comm_locale, guardians(phone)), receipts(public_token)",
      )
      .eq("id", paymentId)
      .maybeSingle<PaymentNotificationRow>();

    if (error || !data) return { ok: false, reason: "Pago no encontrado" };

    const phone = data.students?.guardians?.[0]?.phone ?? null;
    if (!phone) return { ok: false, reason: "El alumno no tiene teléfono de contacto" };

    const token = data.receipts?.[0]?.public_token ?? null;
    if (!token) return { ok: false, reason: "El recibo aún no se ha generado" };

    const locale = normalizeLocale(data.students?.comm_locale);
    const monthIso = data.due_date ?? data.paid_at ?? new Date().toISOString();
    const base = await appBaseUrl();
    const link = `${base}/${locale}/r/${token}`;
    const body = paymentConfirmSms(new Date(monthIso), link, locale);

    const result = await sendAndLog(supabase, {
      to: phone,
      body,
      locale,
      kind: "payment_confirm",
      studentId: data.student_id,
      paymentId: data.id,
    });

    if (result.status === "failed") return { ok: false, reason: result.error };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Error inesperado" };
  }
}
