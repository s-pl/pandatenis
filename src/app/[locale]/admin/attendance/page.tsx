import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageShell } from "@/components/admin/page-shell";
import { AttendanceWorkspace } from "@/components/admin/attendance/attendance-workspace";
import { requireStaff } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("attendance") };
}
export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const { supabase, profile } = await requireStaff();
  const tPage = await getTranslations("admin.pages.attendance");

  const today = new Date();
  const past = new Date(today);
  past.setDate(past.getDate() - 14);
  const future = new Date(today);
  future.setDate(future.getDate() + 14);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 60);

  const isoPast = past.toISOString().slice(0, 10);
  const isoFuture = future.toISOString().slice(0, 10);

  const [classesRes, attendanceRes, studentsRes, longAttendanceRes, settingsRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, date, start_time, end_time, title, group_id, groups(name, level)")
      .gte("date", isoPast)
      .lte("date", isoFuture)
      .order("date")
      .order("start_time"),
    supabase.from("attendance_records").select("id, class_id, student_id, status, note"),
    supabase.from("students").select("id, first_name, last_name, group_id, active"),
    supabase
      .from("attendance_records")
      .select("student_id, status, classes!inner(date)")
      .gte("classes.date", monthAgo.toISOString().slice(0, 10)),
    supabase.from("school_settings").select("absence_alert_threshold").maybeSingle(),
  ]);

  const students = (studentsRes.data ?? []).map((row) => ({
    id: row.id,
    fullName: `${row.first_name} ${row.last_name}`,
    groupId: row.group_id,
    active: row.active,
  }));

  const attendance = (attendanceRes.data ?? []).map((row) => ({
    id: row.id,
    classId: row.class_id,
    studentId: row.student_id,
    status: row.status as "asistio" | "no_asistio" | "aviso_ausencia",
    note: row.note ?? "",
  }));

  const sessions = (classesRes.data ?? []).map((row) => {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      startTime: typeof row.start_time === "string" ? row.start_time.slice(0, 5) : row.start_time,
      endTime: typeof row.end_time === "string" ? row.end_time.slice(0, 5) : row.end_time,
      groupId: row.group_id,
      groupName: group?.name ?? "Sin grupo",
      level: (group?.level as string) ?? "",
    };
  });

  const threshold = settingsRes.data?.absence_alert_threshold ?? 75;
  const tally = new Map<string, { total: number; presents: number; absences: number }>();
  for (const row of (longAttendanceRes.data ?? []) as Array<{ student_id: string; status: string }>) {
    const bucket = tally.get(row.student_id) ?? { total: 0, presents: 0, absences: 0 };
    bucket.total += 1;
    if (row.status === "asistio") bucket.presents += 1;
    if (row.status === "no_asistio") bucket.absences += 1;
    tally.set(row.student_id, bucket);
  }

  type Alert = {
    student: { id: string; fullName: string; groupId: string | null; active: boolean };
    rate: number;
    absences: number;
    total: number;
  };
  const alerts = students
    .filter((student) => student.active)
    .map<Alert | null>((student) => {
      const stats = tally.get(student.id);
      if (!stats || stats.total < 4) return null;
      const rate = Math.round((stats.presents / stats.total) * 100);
      if (rate >= threshold) return null;
      return { student, rate, absences: stats.absences, total: stats.total };
    })
    .filter((entry): entry is Alert => entry !== null)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 6);

  const globalTotal = Array.from(tally.values()).reduce((acc, value) => acc + value.total, 0);
  const globalPresent = Array.from(tally.values()).reduce((acc, value) => acc + value.presents, 0);
  const globalRate = globalTotal === 0 ? 100 : Math.round((globalPresent / globalTotal) * 100);

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <>
          <Badge tone="primary" iconLeft={<GraduationCap className="h-3 w-3" />}>
            {sessions.length} clases en la ventana de 4 semanas
          </Badge>
          <Badge tone="info">Media global {globalRate}%</Badge>
          {alerts.length > 0 && <Badge tone="danger">{alerts.length} alumnos en alerta</Badge>}
        </>
      }
    >
      {alerts.length > 0 && (
        <Card>
          <CardHeader
            title="Alumnos con baja asistencia"
            description={`Por debajo del ${threshold}% en los últimos 60 días. Considera avisar a sus familias.`}
            actions={
              <Badge tone="danger" iconLeft={<AlertTriangle className="h-3 w-3" />}>
                {alerts.length} en alerta
              </Badge>
            }
          />
          <CardBody>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {alerts.map((entry) => {
                const content = (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{entry.student.fullName}</span>
                      <span className="text-xs font-semibold text-[var(--danger)]">{entry.rate}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/60">
                      <div className="h-full rounded-full bg-[var(--danger)]" style={{ width: `${entry.rate}%` }} />
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      {entry.absences} faltas sin avisar sobre {entry.total} clases registradas
                    </p>
                  </>
                );

                return (
                  <li key={entry.student.id}>
                    {profile.role === "admin" ? (
                      <Link
                        href={`/admin/students/${entry.student.id}`}
                        className="flex flex-col gap-2 rounded-2xl border border-[#f1c5c5] bg-[var(--danger-soft)] p-4 transition-colors hover:bg-[#fbe2e2]"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex flex-col gap-2 rounded-2xl border border-[#f1c5c5] bg-[var(--danger-soft)] p-4">
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
      <AttendanceWorkspace sessions={sessions} students={students} attendance={attendance} />
    </PageShell>
  );
}
