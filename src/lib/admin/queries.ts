import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionCenterItem } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export type DashboardSummary = {
  activeStudents: number;
  newStudentsThisMonth: number;
  studentGoal: number;
  attendanceRate: number;
  monthRevenue: number;
  prevMonthRevenue: number;
  privateLessonsThisMonth: number;
  privateLessonsRevenue: number;
  pendingPaymentsAmount: number;
  pendingPaymentsCount: number;
  upcomingClassesCount: number;
  newLeadsThisWeek: number;
  recentReceipts: Array<{
    id: string;
    receiptNumber: string;
    generatedAt: string;
    amount: number;
    studentName: string;
  }>;
  upcomingClasses: Array<{
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    groupName: string;
  }>;
  duePayments: Array<{
    id: string;
    concept: string;
    amount: number;
    dueDate: string;
    status: "pendiente" | "atrasado";
    studentName: string;
    guardianPhone: string | null;
  }>;
};

export type RevenueSeriesPoint = { month: string; ingresos: number; particulares: number };
export type LevelDistributionPoint = { level: string; count: number; color: string };
export type AttendanceSeriesPoint = { week: string; asistencia: number };
export type LeadSourcePoint = { source: string; count: number };

export type CampusLeadMetrics = {
  totalLeads: number;
  totalInscripciones: number;
  conversionRate: number;
  bySource: Array<{ source: string; leads: number; inscripciones: number; rate: number }>;
  byMonth: Array<{ month: string; leads: number }>;
};

const LEVEL_COLORS: Record<string, string> = {
  Rojo: "#d65151",
  Naranja: "#ef8a3a",
  Verde: "#1f6f43",
  Amarillo: "#f4b73f",
};

const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "short" });

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function fetchDashboardSummary(supabase: SupabaseClient): Promise<DashboardSummary> {
  const now = new Date();
  const startMonth = startOfMonth(now);
  const startPrevMonth = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const startNextMonth = startOfMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const startAttendanceWindow = new Date(now);
  startAttendanceWindow.setDate(startAttendanceWindow.getDate() - 30);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const endUpcoming = new Date(now);
  endUpcoming.setDate(endUpcoming.getDate() + 14);

  const [
    studentsRes,
    newStudentsRes,
    goalRes,
    paymentsMonthRes,
    paymentsPrevRes,
    privateLessonsMonthRes,
    pendingRes,
    leadsRes,
    classesRes,
    attendanceRes,
    receiptsRes,
    duePaymentsRes,
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("active", true),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .gte("start_date", isoDate(startMonth)),
    supabase.from("school_settings").select("student_goal").maybeSingle(),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "pagado")
      .gte("paid_at", startMonth.toISOString())
      .lt("paid_at", startNextMonth.toISOString()),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "pagado")
      .gte("paid_at", startPrevMonth.toISOString())
      .lt("paid_at", startMonth.toISOString()),
    supabase
      .from("private_lessons")
      .select("price")
      .gte("date", isoDate(startMonth))
      .lt("date", isoDate(startNextMonth)),
    supabase.from("payments").select("amount, status").in("status", ["pendiente", "atrasado"]),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfWeek.toISOString()),
    supabase
      .from("classes")
      .select("id, date, start_time, end_time, title, groups(name)")
      .gte("date", isoDate(now))
      .lte("date", isoDate(endUpcoming))
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(6),
    supabase
      .from("attendance_records")
      .select("status, classes!inner(date)")
      .gte("classes.date", isoDate(startAttendanceWindow)),
    supabase
      .from("receipts")
      .select("id, receipt_number, generated_at, payments(amount, students(first_name, last_name))")
      .order("generated_at", { ascending: false })
      .limit(5),
    supabase
      .from("payments")
      .select(
        "id, concept, amount, due_date, status, students(first_name, last_name, guardians(phone))",
      )
      .in("status", ["pendiente", "atrasado"])
      .order("due_date", { ascending: true })
      .limit(8),
  ]);

  const monthRevenue = sumAmounts(paymentsMonthRes.data);
  const prevMonthRevenue = sumAmounts(paymentsPrevRes.data);
  const pendingPaymentsAmount = sumAmounts(pendingRes.data);
  const pendingPaymentsCount = pendingRes.data?.length ?? 0;

  const attendanceRows = (attendanceRes.data ?? []) as Array<{ status: string }>;
  const totalAttendance = attendanceRows.length;
  const presentAttendance = attendanceRows.filter((row) => row.status === "asistio").length;
  const attendanceRate = totalAttendance === 0 ? 0 : Math.round((presentAttendance / totalAttendance) * 100);

  const privateLessons = privateLessonsMonthRes.data ?? [];
  const privateLessonsRevenue = privateLessons.reduce((acc, row) => acc + Number(row.price ?? 0), 0);

  return {
    activeStudents: studentsRes.count ?? 0,
    newStudentsThisMonth: newStudentsRes.count ?? 0,
    studentGoal: goalRes.data?.student_goal ?? 120,
    attendanceRate,
    monthRevenue,
    prevMonthRevenue,
    privateLessonsThisMonth: privateLessons.length,
    privateLessonsRevenue,
    pendingPaymentsAmount,
    pendingPaymentsCount,
    upcomingClassesCount: classesRes.data?.length ?? 0,
    newLeadsThisWeek: leadsRes.count ?? 0,
    upcomingClasses:
      classesRes.data?.map((row) => {
        const groupName = Array.isArray(row.groups)
          ? row.groups[0]?.name ?? ""
          : (row.groups as { name?: string } | null)?.name ?? "";
        return {
          id: row.id,
          title: row.title,
          date: row.date,
          startTime: typeof row.start_time === "string" ? row.start_time.slice(0, 5) : row.start_time,
          endTime: typeof row.end_time === "string" ? row.end_time.slice(0, 5) : row.end_time,
          groupName,
        };
      }) ?? [],
    recentReceipts:
      receiptsRes.data?.map((row) => {
        const rawPayment = Array.isArray(row.payments) ? row.payments[0] : row.payments;
        const payment = rawPayment as unknown as
          | { amount: number; students: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null }
          | null;
        const rawStudent = payment?.students;
        const student = Array.isArray(rawStudent) ? rawStudent[0] : rawStudent;
        return {
          id: row.id,
          receiptNumber: row.receipt_number,
          generatedAt: row.generated_at,
          amount: Number(payment?.amount ?? 0),
          studentName: student ? `${student.first_name} ${student.last_name}` : "—",
        };
      }) ?? [],
    duePayments:
      duePaymentsRes.data?.map((row) => {
        const rawStudent = Array.isArray(row.students) ? row.students[0] : row.students;
        const student = rawStudent as unknown as
          | {
              first_name: string;
              last_name: string;
              guardians: Array<{ phone: string }> | { phone: string } | null;
            }
          | null;
        const guardian = Array.isArray(student?.guardians)
          ? student?.guardians[0]
          : (student?.guardians as { phone: string } | null);
        return {
          id: row.id,
          concept: row.concept,
          amount: Number(row.amount),
          dueDate: row.due_date,
          status: row.status as "pendiente" | "atrasado",
          studentName: student ? `${student.first_name} ${student.last_name}` : "—",
          guardianPhone: guardian?.phone ?? null,
        };
      }) ?? [],
  };
}

export async function fetchRevenueSeries(
  supabase: SupabaseClient,
  monthsBack = 6,
): Promise<RevenueSeriesPoint[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

  const [paymentsRes, lessonsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, paid_at")
      .eq("status", "pagado")
      .gte("paid_at", start.toISOString()),
    supabase
      .from("private_lessons")
      .select("price, date")
      .eq("payment_status", "pagado")
      .gte("date", isoDate(start)),
  ]);

  const buckets: RevenueSeriesPoint[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const ref = new Date(start.getFullYear(), start.getMonth() + i, 1);
    buckets.push({ month: monthLabel.format(ref), ingresos: 0, particulares: 0 });
  }

  paymentsRes.data?.forEach((row) => {
    if (!row.paid_at) return;
    const d = new Date(row.paid_at);
    const idx = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
    if (idx >= 0 && idx < monthsBack) buckets[idx].ingresos += Number(row.amount ?? 0);
  });

  lessonsRes.data?.forEach((row) => {
    if (!row.date) return;
    const d = new Date(row.date);
    const idx = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
    if (idx >= 0 && idx < monthsBack) buckets[idx].particulares += Number(row.price ?? 0);
  });

  return buckets;
}

export async function fetchLevelDistribution(
  supabase: SupabaseClient,
): Promise<LevelDistributionPoint[]> {
  const { data } = await supabase.from("students").select("level").eq("active", true);
  const tally = new Map<string, number>();
  data?.forEach((row) => {
    tally.set(row.level, (tally.get(row.level) ?? 0) + 1);
  });
  return Array.from(tally.entries()).map(([level, count]) => ({
    level,
    count,
    color: LEVEL_COLORS[level] ?? "#94a3b8",
  }));
}

export async function fetchAttendanceSeries(
  supabase: SupabaseClient,
  weeksBack = 8,
): Promise<AttendanceSeriesPoint[]> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7 * weeksBack);

  const { data } = await supabase
    .from("attendance_records")
    .select("status, classes!inner(date)")
    .gte("classes.date", isoDate(start));

  const buckets: { total: number; presents: number }[] = Array.from({ length: weeksBack }, () => ({
    total: 0,
    presents: 0,
  }));

  (data ?? []).forEach((row) => {
    const classDate = ((row as { classes: { date: string } | Array<{ date: string }> }).classes);
    const date = Array.isArray(classDate) ? classDate[0]?.date : classDate?.date;
    if (!date) return;
    const d = new Date(date);
    const diffDays = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const idx = Math.min(weeksBack - 1, Math.max(0, Math.floor(diffDays / 7)));
    buckets[idx].total += 1;
    if ((row as { status: string }).status === "asistio") buckets[idx].presents += 1;
  });

  return buckets.map((bucket, i) => {
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() + i * 7);
    return {
      week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
      asistencia: bucket.total === 0 ? 0 : Math.round((bucket.presents / bucket.total) * 100),
    };
  });
}

export async function fetchLeadSources(supabase: SupabaseClient): Promise<LeadSourcePoint[]> {
  const { data } = await supabase
    .from("leads")
    .select("source_id, lead_sources(name)")
    .limit(500);

  const tally = new Map<string, number>();
  (data ?? []).forEach((row) => {
    const source = Array.isArray(row.lead_sources)
      ? row.lead_sources[0]?.name
      : (row.lead_sources as { name?: string } | null)?.name;
    const key = source ?? "Sin clasificar";
    tally.set(key, (tally.get(key) ?? 0) + 1);
  });

  return Array.from(tally.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

/** Helper: extrae el nombre del origen de un embed de lead_sources. */
function sourceName(value: unknown): string {
  const embed = Array.isArray(value) ? value[0] : value;
  return (embed as { name?: string } | null)?.name ?? "Sin clasificar";
}

/**
 * Métricas de captación y conversión del Campus: total de leads, total de
 * inscripciones, conversión por origen (Leads vs Inscripciones) y leads por mes.
 */
export async function fetchCampusLeadMetrics(
  supabase: SupabaseClient,
): Promise<CampusLeadMetrics> {
  const [leadsRes, registrationsRes] = await Promise.all([
    supabase.from("leads").select("created_at, lead_sources(name)").limit(5000),
    supabase
      .from("registrations")
      .select("invite_status, leads(lead_sources(name))")
      .limit(5000),
  ]);

  const leadsRows = leadsRes.data ?? [];
  const regRows = registrationsRes.data ?? [];

  // Inscripciones reales: descartamos invitaciones sin completar (draft/sent).
  const inscriptionRows = regRows.filter(
    (r) => r.invite_status == null || r.invite_status === "completed",
  );

  const leadsBySource = new Map<string, number>();
  for (const row of leadsRows) {
    const key = sourceName(row.lead_sources);
    leadsBySource.set(key, (leadsBySource.get(key) ?? 0) + 1);
  }

  const inscBySource = new Map<string, number>();
  for (const row of inscriptionRows) {
    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    const key = sourceName((lead as { lead_sources?: unknown } | null)?.lead_sources);
    inscBySource.set(key, (inscBySource.get(key) ?? 0) + 1);
  }

  const sources = new Set<string>([...leadsBySource.keys(), ...inscBySource.keys()]);
  const bySource = Array.from(sources)
    .map((source) => {
      const leads = leadsBySource.get(source) ?? 0;
      const inscripciones = inscBySource.get(source) ?? 0;
      const rate = leads > 0 ? Math.round((inscripciones / leads) * 100) : 0;
      return { source, leads, inscripciones, rate };
    })
    .sort((a, b) => b.leads - a.leads || b.inscripciones - a.inscripciones);

  // Leads por mes (últimos 6 meses, incluyendo el actual).
  const now = new Date();
  const monthKeys: string[] = [];
  const monthLabels = new Map<string, string>();
  const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthKeys.push(key);
    monthLabels.set(key, `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
  }
  const monthTally = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  for (const row of leadsRows) {
    if (!row.created_at) continue;
    const key = String(row.created_at).slice(0, 7);
    if (monthTally.has(key)) monthTally.set(key, (monthTally.get(key) ?? 0) + 1);
  }
  const byMonth = monthKeys.map((key) => ({
    month: monthLabels.get(key) ?? key,
    leads: monthTally.get(key) ?? 0,
  }));

  const totalLeads = leadsRows.length;
  const totalInscripciones = inscriptionRows.length;
  const conversionRate = totalLeads > 0 ? Math.round((totalInscripciones / totalLeads) * 100) : 0;

  return { totalLeads, totalInscripciones, conversionRate, bySource, byMonth };
}

export async function fetchActionCenter(supabase: SupabaseClient): Promise<ActionCenterItem[]> {
  const now = new Date();
  const today = isoDate(now);
  const recentPast = new Date(now);
  recentPast.setDate(recentPast.getDate() - 7);
  const staleLeadDate = new Date(now);
  staleLeadDate.setDate(staleLeadDate.getDate() - 2);

  const [
    paymentsRes,
    leadsRes,
    registrationsRes,
    classesRes,
    statesRes,
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("id, concept, amount, due_date, status, students(first_name, last_name)")
      .in("status", ["pendiente", "atrasado"])
      .order("due_date", { ascending: true })
      .limit(20),
    supabase
      .from("leads")
      .select("id, full_name, status, next_action_at, created_at")
      .not("status", "in", "(convertido,perdido)")
      .order("created_at", { ascending: true })
      .limit(80),
    supabase
      .from("registrations")
      .select("id, full_name, child_name, type, submitted_at, status")
      .eq("status", "pendiente")
      .order("submitted_at", { ascending: true })
      .limit(12),
    supabase
      .from("classes")
      .select("id, title, date, start_time, groups(name)")
      .gte("date", isoDate(recentPast))
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(40),
    supabase.from("admin_task_states").select("task_key, dismissed_at, snoozed_until"),
  ]);

  const states = new Map(
    (statesRes.data ?? []).map((row) => [
      row.task_key,
      {
        dismissedAt: row.dismissed_at ? new Date(row.dismissed_at).getTime() : null,
        snoozedUntil: row.snoozed_until ? new Date(row.snoozed_until).getTime() : null,
      },
    ]),
  );

  const visible = (item: ActionCenterItem) => {
    const state = states.get(item.key);
    if (!state) return true;
    if (state.dismissedAt) return false;
    if (state.snoozedUntil && state.snoozedUntil > Date.now()) return false;
    return true;
  };

  const items: ActionCenterItem[] = [];

  for (const row of paymentsRes.data ?? []) {
    const due = new Date(row.due_date);
    if (row.status !== "atrasado" && row.due_date >= today) continue;
    const rawStudent = Array.isArray(row.students) ? row.students[0] : row.students;
    const student = rawStudent as { first_name?: string; last_name?: string } | null;
    items.push({
      key: `payment:${row.id}`,
      type: "payment_overdue",
      title: `${student ? `${student.first_name} ${student.last_name}` : "Alumno"} tiene un cobro pendiente`,
      detail: `${row.concept} · ${formatMoney(Number(row.amount ?? 0), true)}`,
      priority: row.status === "atrasado" || due.getTime() < Date.now() ? "high" : "medium",
      dueAt: row.due_date,
      href: "/admin/payments",
      relatedType: "payment",
      relatedId: row.id,
    });
  }

  for (const row of leadsRes.data ?? []) {
    const nextAction = row.next_action_at ? new Date(row.next_action_at) : null;
    const staleNew = row.status === "nuevo" && new Date(row.created_at).getTime() <= staleLeadDate.getTime();
    const dueFollowup = nextAction ? nextAction.getTime() <= now.getTime() : staleNew;
    if (!dueFollowup) continue;
    items.push({
      key: `lead:${row.id}:${row.next_action_at ?? "new"}`,
      type: "lead_followup",
      title: `Seguimiento pendiente: ${row.full_name}`,
      detail: nextAction ? "Próxima acción vencida" : "Contacto nuevo sin avanzar",
      priority: row.status === "nuevo" ? "high" : "medium",
      dueAt: row.next_action_at ?? row.created_at,
      href: "/admin/leads",
      relatedType: "lead",
      relatedId: row.id,
    });
  }

  for (const row of registrationsRes.data ?? []) {
    items.push({
      key: `registration:${row.id}`,
      type: "registration_pending",
      title: `Inscripción pendiente: ${row.child_name}`,
      detail: `${row.full_name} · ${row.type}`,
      priority: "medium",
      dueAt: row.submitted_at,
      href: "/admin/registrations",
      relatedType: "registration",
      relatedId: row.id,
    });
  }

  const classIds = (classesRes.data ?? []).map((row) => row.id);
  const attendanceByClass = new Set<string>();
  if (classIds.length > 0) {
    const { data } = await supabase
      .from("attendance_records")
      .select("class_id")
      .in("class_id", classIds);
    for (const row of data ?? []) attendanceByClass.add(row.class_id);
  }
  for (const row of classesRes.data ?? []) {
    if (attendanceByClass.has(row.id)) continue;
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    items.push({
      key: `class-attendance:${row.id}`,
      type: "class_attendance",
      title: `Falta asistencia: ${row.title}`,
      detail: `${group?.name ?? "Sin grupo"} · ${row.date} ${String(row.start_time).slice(0, 5)}`,
      priority: row.date < today ? "high" : "medium",
      dueAt: row.date,
      href: "/admin/attendance",
      relatedType: "class",
      relatedId: row.id,
    });
  }

  return items
    .filter(visible)
    .sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 };
      const byPriority = priority[a.priority] - priority[b.priority];
      if (byPriority !== 0) return byPriority;
      return new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime();
    })
    .slice(0, 12);
}

function sumAmounts(rows: Array<{ amount: number | string | null }> | null): number {
  return (rows ?? []).reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
}
