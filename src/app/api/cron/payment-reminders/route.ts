import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendAndLog } from "@/lib/sms/send-and-log";
import { normalizeLocale, paymentReminderSms } from "@/lib/sms/templates";

export const dynamic = "force-dynamic";

// Días del mes en los que se reenvía el recordatorio de recibo pendiente.
const REMINDER_DAYS = [20, 28];

type PendingPaymentRow = {
  id: string;
  due_date: string | null;
  student_id: string | null;
  status: string;
  students: {
    comm_locale: string | null;
    guardians: { phone: string | null }[] | null;
  } | null;
};

/** Día, mes y año actuales en la zona horaria de España. */
function madridToday(): { day: number; year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { day: get("day"), year: get("year"), month: get("month") };
}

export async function GET(request: NextRequest) {
  // Autorización: cabecera Bearer (Vercel Cron) o ?secret= para pruebas.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const { day, year, month } = madridToday();
  const force = request.nextUrl.searchParams.get("force") === "1";

  if (!force && !REMINDER_DAYS.includes(day)) {
    return NextResponse.json({ ok: true, skipped: true, reason: `Día ${day} no es de recordatorio` });
  }

  // Etiqueta del ciclo para idempotencia: ej. "2026-06-20".
  const reminderKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Recibos pendientes/atrasados del mes en curso.
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, due_date, student_id, status, students(comm_locale, guardians(phone))")
    .in("status", ["pendiente", "atrasado"])
    .gte("due_date", monthStart)
    .lte("due_date", monthEnd)
    .returns<PendingPaymentRow[]>();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const payment of data ?? []) {
    const phone = payment.students?.guardians?.[0]?.phone ?? null;
    if (!phone) {
      skipped += 1;
      continue;
    }
    const locale = normalizeLocale(payment.students?.comm_locale);
    const monthIso = payment.due_date ?? `${monthStart}`;
    const body = paymentReminderSms(new Date(`${monthIso}T00:00:00`), locale);

    const result = await sendAndLog(supabase, {
      to: phone,
      body,
      locale,
      kind: "payment_reminder",
      studentId: payment.student_id,
      paymentId: payment.id,
      reminderKey,
    });

    if (result.status === "sent" || result.status === "skipped") sent += result.status === "sent" ? 1 : 0;
    if (result.status === "skipped") skipped += 1;
    if (result.status === "failed") failed += 1;
  }

  return NextResponse.json({ ok: true, cycle: reminderKey, total: data?.length ?? 0, sent, skipped, failed });
}
