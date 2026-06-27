import { NextResponse, type NextRequest } from "next/server";
import { appBaseUrl } from "@/lib/base-url";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendAndLog } from "@/lib/sms/send-and-log";
import { fieldDate } from "@/lib/sms/fields";
import { renderSmsTemplate } from "@/lib/sms/personalization";
import {
  getSmsSettings,
  inQuietHours,
  isPhoneBlocked,
  SMS_DEFAULT_TEMPLATES,
  type SmsSettings,
} from "@/lib/sms/settings";
import { monthLabel, normalizeLocale, paymentReminderSms } from "@/lib/sms/templates";
import { sendPushToAllStaff } from "@/lib/admin/actions/push";
import {
  coverDaysByBalance,
  DEFAULT_CAMPUS_PRICES,
  entryExpected,
  type CampusPrices,
} from "@/lib/admin/campus-finance";

export const dynamic = "force-dynamic";

/**
 * Cron diario de SMS automáticos (08:00, ver vercel.json). Hace tres cosas,
 * todas configurables desde /admin/sms:
 *
 *   1. Recordatorio de recibos de escuela pendientes (solo los días del mes
 *      elegidos, p. ej. 20 y 28).
 *   2. Recordatorio de pagos de campus pendientes (amarillos del cuadrante),
 *      unos días antes de que empiece su semana. Máximo uno por semana.
 *   3. Seguimiento de leads sin convertir (un único SMS por lead).
 */

type PendingPaymentRow = {
  id: string;
  due_date: string | null;
  amount: number | null;
  concept: string | null;
  student_id: string | null;
  status: string;
  students: {
    first_name: string | null;
    last_name: string | null;
    level: string | null;
    birth_date: string | null;
    comm_locale: string | null;
    guardians: { full_name: string | null; phone: string | null; email: string | null }[] | null;
  } | null;
};

type CampusRegistrationRel = {
  id: string;
  status: string | null;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  child_name: string | null;
  child_last_name: string | null;
  child_birth_date: string | null;
  comm_locale: string | null;
};

type CampusCourseRel = { title: string | null; dates_label: string | null };

type CampusEntryRow = {
  registration_id: string;
  attendance_date: string;
  campus_course_id: string;
  registrations: CampusRegistrationRel | CampusRegistrationRel[] | null;
  campus_courses: CampusCourseRel | CampusCourseRel[] | null;
};

type LeadSourceRel = { name: string | null };

type LeadRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  child_age: number | null;
  created_at: string | null;
  comm_locale: string | null;
  lead_sources: LeadSourceRel | LeadSourceRel[] | null;
};

/** Supabase devuelve las relaciones a-uno como objeto o array según el esquema. */
function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type SectionStats = { total: number; sent: number; skipped: number; failed: number };

function emptyStats(): SectionStats {
  return { total: 0, sent: 0, skipped: 0, failed: 0 };
}

function track(stats: SectionStats, status: "sent" | "skipped" | "failed") {
  stats[status] += 1;
}

/** Fecha actual en la zona horaria de España. */
function madridToday(): { iso: string; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const iso = `${get("year")}-${get("month")}-${get("day")}`;
  return { iso, day: Number(get("day")) };
}

function isoMonthBounds(todayIso: string): { start: string; next: string } {
  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7));
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start, next };
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekStartIso(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function spanishDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function pickTemplate(custom: string, fallback: string): string {
  return custom.trim() || fallback;
}

/* ───────────── 1. Recordatorio de recibos de escuela ───────────── */

async function runSchoolReminders(
  supabase: ReturnType<typeof createServiceRoleClient>,
  settings: SmsSettings,
  todayIso: string,
  statusCallbackUrl: string,
): Promise<SectionStats & { skippedReason?: string }> {
  const stats = emptyStats();
  const day = Number(todayIso.slice(8, 10));
  if (!settings.paymentReminderEnabled) return { ...stats, skippedReason: "desactivado" };
  if (!settings.paymentReminderDays.includes(day)) {
    return { ...stats, skippedReason: `día ${day} no está en [${settings.paymentReminderDays.join(",")}]` };
  }

  const { start, next } = isoMonthBounds(todayIso);
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, due_date, amount, concept, student_id, status, students(first_name, last_name, level, birth_date, comm_locale, guardians(full_name, phone, email))",
    )
    .in("status", ["pendiente", "atrasado"])
    .gte("due_date", start)
    .lt("due_date", next)
    .returns<PendingPaymentRow[]>();
  if (error) throw new Error(`escuela: ${error.message}`);

  for (const payment of data ?? []) {
    stats.total += 1;
    const guardian = payment.students?.guardians?.[0] ?? null;
    const phone = guardian?.phone ?? null;
    if (!phone || isPhoneBlocked(settings, phone)) {
      track(stats, "skipped");
      continue;
    }
    const locale = normalizeLocale(payment.students?.comm_locale);
    const monthIso = payment.due_date ?? start;
    const month = monthLabel(new Date(`${monthIso}T00:00:00`), locale);
    const amountLabel =
      typeof payment.amount === "number"
        ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(payment.amount)
        : "";
    const custom = locale === "en" ? settings.paymentReminderMsgEn : settings.paymentReminderMsgEs;
    const body = custom.trim()
      ? renderSmsTemplate(custom, {
          name: payment.students?.first_name ?? "",
          locale,
          source: "student",
          month,
          amount: amountLabel,
          fields: {
            "{alumno.nombre}": payment.students?.first_name ?? "",
            "{alumno.apellidos}": payment.students?.last_name ?? "",
            "{alumno.nivel}": payment.students?.level ?? "",
            "{alumno.fecha_nacimiento}": fieldDate(payment.students?.birth_date),
            "{tutor.nombre}": guardian?.full_name ?? "",
            "{tutor.telefono}": guardian?.phone ?? "",
            "{tutor.email}": guardian?.email ?? "",
            "{recibo.importe}": amountLabel,
            "{recibo.mes}": month,
            "{recibo.concepto}": payment.concept ?? "",
            "{recibo.enlace}": "",
          },
        })
      : paymentReminderSms(new Date(`${monthIso}T00:00:00`), locale);

    const result = await sendAndLog(supabase, {
      to: phone,
      body,
      locale,
      kind: "payment_reminder",
      studentId: payment.student_id,
      paymentId: payment.id,
      reminderKey: todayIso,
      statusCallbackUrl,
    });
    track(stats, result.status);
  }
  return stats;
}

/* ───────────── 2. Recordatorio de pagos de campus ───────────── */

async function runCampusReminders(
  supabase: ReturnType<typeof createServiceRoleClient>,
  settings: SmsSettings,
  todayIso: string,
  statusCallbackUrl: string,
): Promise<SectionStats & { skippedReason?: string }> {
  const stats = emptyStats();
  if (!settings.campusReminderEnabled) return { ...stats, skippedReason: "desactivado" };

  // Plazas próximas (hoy..horizonte) vinculadas a una inscripción confirmada.
  const horizon = addDaysIso(todayIso, settings.campusReminderDaysBefore);
  const { data: entries, error } = await supabase
    .from("campus_roster_entries")
    .select(
      "registration_id, attendance_date, campus_course_id, registrations(id, status, phone, full_name, email, child_name, child_last_name, child_birth_date, comm_locale), campus_courses(title, dates_label)",
    )
    .not("registration_id", "is", null)
    .gte("attendance_date", todayIso)
    .lte("attendance_date", horizon)
    .returns<CampusEntryRow[]>();
  if (error) throw new Error(`campus: ${error.message}`);

  // Una inscripción candidata por cada alumno con días próximos confirmados.
  const byRegistration = new Map<string, CampusEntryRow>();
  for (const entry of entries ?? []) {
    const registration = one(entry.registrations);
    if (!registration) continue;
    if (registration.status !== "confirmada" && registration.status !== "convertida") continue;
    const current = byRegistration.get(entry.registration_id);
    if (!current || entry.attendance_date < current.attendance_date) {
      byRegistration.set(entry.registration_id, entry);
    }
  }
  if (byRegistration.size === 0) return stats;

  // Para saber si DEBE algo, necesitamos su saldo (hucha): todos sus días con su
  // importe esperado contra lo que ha pagado en el ledger.
  const registrationIds = [...byRegistration.keys()];
  const [allDaysRes, collectionsRes] = await Promise.all([
    supabase
      .from("campus_roster_entries")
      .select("id, registration_id, attendance_date, half_day, morning_club, lunch_club, campus_course_id")
      .in("registration_id", registrationIds),
    supabase
      .from("campus_collections")
      .select("registration_id, amount")
      .in("registration_id", registrationIds),
  ]);
  if (allDaysRes.error) throw new Error(`campus saldo: ${allDaysRes.error.message}`);
  if (collectionsRes.error) throw new Error(`campus cobros: ${collectionsRes.error.message}`);

  const courseIds = [
    ...new Set((allDaysRes.data ?? []).map((d) => d.campus_course_id as string)),
  ];
  const priceByCourse = new Map<string, CampusPrices>();
  if (courseIds.length > 0) {
    const { data: courses } = await supabase
      .from("campus_courses")
      .select("id, price_campus_day, price_morning_day, price_lunch_day, price_half_day")
      .in("id", courseIds);
    for (const c of courses ?? []) {
      priceByCourse.set(c.id as string, {
        campusDay: Number(c.price_campus_day ?? DEFAULT_CAMPUS_PRICES.campusDay),
        morningDay: Number(c.price_morning_day ?? DEFAULT_CAMPUS_PRICES.morningDay),
        lunchDay: Number(c.price_lunch_day ?? DEFAULT_CAMPUS_PRICES.lunchDay),
        halfDay: Number(c.price_half_day ?? DEFAULT_CAMPUS_PRICES.halfDay),
      });
    }
  }

  type CampusDay = { id: string; attendanceDate: string; expected: number };
  const daysByRegistration = new Map<string, CampusDay[]>();
  for (const d of allDaysRes.data ?? []) {
    const prices = priceByCourse.get(d.campus_course_id as string) ?? DEFAULT_CAMPUS_PRICES;
    const day: CampusDay = {
      id: d.id as string,
      attendanceDate: d.attendance_date as string,
      expected: entryExpected(
        {
          halfDay: Boolean(d.half_day),
          morningClub: Boolean(d.morning_club),
          lunchClub: Boolean(d.lunch_club),
        },
        prices,
      ),
    };
    const list = daysByRegistration.get(d.registration_id as string) ?? [];
    list.push(day);
    daysByRegistration.set(d.registration_id as string, list);
  }

  const paidByRegistration = new Map<string, number>();
  for (const c of collectionsRes.data ?? []) {
    const regId = c.registration_id as string;
    paidByRegistration.set(regId, (paidByRegistration.get(regId) ?? 0) + Number(c.amount));
  }

  for (const [registrationId, entry] of byRegistration) {
    const days = daysByRegistration.get(registrationId) ?? [];
    const coverage = coverDaysByBalance(days, paidByRegistration.get(registrationId) ?? 0);
    // Si su saldo cubre todo lo que debe, no se le recuerda nada.
    if (coverage.pending <= 0) continue;
    // Primer día próximo que el saldo aún no cubre (para el texto del SMS).
    const firstUncovered = days
      .filter(
        (d) =>
          !coverage.paidIds.has(d.id) && d.attendanceDate >= todayIso && d.attendanceDate <= horizon,
      )
      .sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate))[0];
    if (!firstUncovered) continue;

    stats.total += 1;
    const registration = one(entry.registrations)!;
    const course = one(entry.campus_courses);
    const phone = registration.phone?.trim() ?? null;
    if (!phone || isPhoneBlocked(settings, phone)) {
      track(stats, "skipped");
      continue;
    }
    const locale = normalizeLocale(registration.comm_locale);
    const template = pickTemplate(
      locale === "en" ? settings.campusReminderMsgEn : settings.campusReminderMsgEs,
      locale === "en" ? SMS_DEFAULT_TEMPLATES.campusReminderEn : SMS_DEFAULT_TEMPLATES.campusReminderEs,
    );
    const body = renderSmsTemplate(template, {
      name: registration.child_name ?? "",
      locale,
      source: "student",
      campus: course?.title ?? "",
      date: spanishDate(firstUncovered.attendanceDate),
      fields: {
        "{alumno.nombre}": registration.child_name ?? "",
        "{alumno.apellidos}": registration.child_last_name ?? "",
        "{alumno.fecha_nacimiento}": fieldDate(registration.child_birth_date),
        "{tutor.nombre}": registration.full_name ?? "",
        "{tutor.telefono}": registration.phone ?? "",
        "{tutor.email}": registration.email ?? "",
        "{campus.nombre}": course?.title ?? "",
        "{campus.fechas}": course?.dates_label ?? "",
        "{campus.primer_dia}": spanishDate(firstUncovered.attendanceDate),
      },
    });

    // Máximo un recordatorio por inscripción y semana (índice único en BD).
    const result = await sendAndLog(supabase, {
      to: phone,
      body,
      locale,
      kind: "payment_reminder",
      registrationId,
      reminderKey: `campus-${weekStartIso(firstUncovered.attendanceDate)}`,
      statusCallbackUrl,
    });
    track(stats, result.status);
  }
  return stats;
}

/* ───────────── 3. Seguimiento de leads sin convertir ───────────── */

async function runLeadFollowups(
  supabase: ReturnType<typeof createServiceRoleClient>,
  settings: SmsSettings,
  statusCallbackUrl: string,
): Promise<SectionStats & { skippedReason?: string }> {
  const stats = emptyStats();
  if (!settings.leadFollowupEnabled) return { ...stats, skippedReason: "desactivado" };

  const cutoff = new Date(Date.now() - settings.leadFollowupDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, full_name, phone, child_age, created_at, comm_locale, lead_sources(name)")
    .in("status", ["nuevo", "contactado", "interesado"])
    .is("followup_sms_sent_at", null)
    .lte("created_at", cutoff)
    .order("created_at")
    .limit(50)
    .returns<LeadRow[]>();
  if (error) throw new Error(`leads: ${error.message}`);

  for (const lead of leads ?? []) {
    stats.total += 1;
    const phone = lead.phone?.trim() ?? null;
    if (!phone || isPhoneBlocked(settings, phone)) {
      track(stats, "skipped");
      continue;
    }
    const locale = normalizeLocale(lead.comm_locale);
    const template = pickTemplate(
      locale === "en" ? settings.leadFollowupMsgEn : settings.leadFollowupMsgEs,
      locale === "en" ? SMS_DEFAULT_TEMPLATES.leadFollowupEn : SMS_DEFAULT_TEMPLATES.leadFollowupEs,
    );
    const body = renderSmsTemplate(template, {
      name: lead.full_name ?? "",
      locale,
      source: "lead",
      fields: {
        "{lead.nombre}": lead.full_name ?? "",
        "{lead.telefono}": lead.phone ?? "",
        "{lead.edad_nino}": lead.child_age === null ? "" : String(lead.child_age),
        "{lead.origen}": one(lead.lead_sources)?.name ?? "",
        "{lead.fecha}": lead.created_at ? spanishDate(lead.created_at.slice(0, 10)) : "",
      },
    });

    const result = await sendAndLog(supabase, {
      to: phone,
      body,
      locale,
      kind: "lead_followup",
      leadId: lead.id,
      statusCallbackUrl,
    });
    track(stats, result.status);

    // Solo se marca si realmente salió: si Twilio no está configurado o el
    // envío falla, se reintentará en el siguiente ciclo.
    if (result.status === "sent") {
      await supabase
        .from("leads")
        .update({ followup_sms_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
    }
  }
  return stats;
}

export async function GET(request: NextRequest) {
  // Autorización: cabecera Bearer (Vercel Cron) o ?secret= para pruebas.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const settings = await getSmsSettings(supabase);

  if (!settings.enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "SMS desactivados globalmente" });
  }
  const force = request.nextUrl.searchParams.get("force") === "1";
  if (!force && inQuietHours(settings)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Horario silencioso" });
  }

  const { iso: todayIso } = madridToday();
  const statusCallbackUrl = `${await appBaseUrl()}/api/sms/status`;

  try {
    const [school, campus, leads] = [
      await runSchoolReminders(supabase, settings, todayIso, statusCallbackUrl),
      await runCampusReminders(supabase, settings, todayIso, statusCallbackUrl),
      await runLeadFollowups(supabase, settings, statusCallbackUrl),
    ];

    // Aviso push al equipo con el resumen del día (solo si se envió algo).
    const totalSent = school.sent + campus.sent + leads.sent;
    if (totalSent > 0) {
      const parts = [
        school.sent > 0 ? `${school.sent} recibos` : null,
        campus.sent > 0 ? `${campus.sent} campus` : null,
        leads.sent > 0 ? `${leads.sent} leads` : null,
      ].filter(Boolean);
      await sendPushToAllStaff(
        "📲 Recordatorios enviados",
        `Hoy se han enviado ${totalSent} SMS automáticos (${parts.join(" · ")}).`,
        { type: "reminders", date: todayIso },
      );
    }

    return NextResponse.json({ ok: true, date: todayIso, school, campus, leads });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
