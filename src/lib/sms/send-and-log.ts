import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms, type SmsResult } from "./client";
import type { CommLocale } from "./templates";

export type SmsKind =
  | "promo"
  | "payment_confirm"
  | "payment_reminder"
  | "campaign"
  | "welcome";

export type SendAndLogInput = {
  to: string;
  body: string;
  locale: CommLocale;
  kind: SmsKind;
  studentId?: string | null;
  paymentId?: string | null;
  promotionId?: string | null;
  /** Etiqueta de ciclo para recordatorios (idempotencia). Ej.: "2026-05-20". */
  reminderKey?: string | null;
  /** URL a la que Twilio notificará el estado de entrega final. */
  statusCallbackUrl?: string | null;
};

export type SendAndLogResult = SmsResult & { logId?: string };

/**
 * Envía un SMS y deja constancia en `sms_messages`. El log se crea siempre
 * (aunque el envío se omita o falle) para trazabilidad e idempotencia.
 *
 * Para recordatorios, el índice único (payment_id, reminder_key) evita el doble
 * envío: si ya existe el log de ese ciclo, no se vuelve a enviar.
 */
export async function sendAndLog(
  supabase: SupabaseClient,
  input: SendAndLogInput,
): Promise<SendAndLogResult> {
  const { data: logRow, error: insertError } = await supabase
    .from("sms_messages")
    .insert({
      to_phone: input.to,
      body: input.body,
      locale: input.locale,
      kind: input.kind,
      status: "queued",
      student_id: input.studentId ?? null,
      payment_id: input.paymentId ?? null,
      promotion_id: input.promotionId ?? null,
      reminder_key: input.reminderKey ?? null,
    })
    .select("id")
    .single();

  // Conflicto con el índice único de recordatorios → ya se envió este ciclo.
  if (insertError) {
    if (insertError.code === "23505") {
      return { status: "skipped", reason: "Ya enviado (duplicado)" };
    }
    return { status: "failed", error: insertError.message };
  }

  const result = await sendSms(input.to, input.body, {
    statusCallback: input.statusCallbackUrl ?? undefined,
  });

  const update =
    result.status === "sent"
      ? { status: "sent", provider_sid: result.sid, sent_at: new Date().toISOString() }
      : result.status === "skipped"
        ? { status: "skipped", error: result.reason }
        : { status: "failed", error: result.error };

  await supabase.from("sms_messages").update(update).eq("id", logRow.id);

  return { ...result, logId: logRow.id };
}
