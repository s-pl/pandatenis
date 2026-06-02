import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { PrivateLessonsManager } from "@/components/admin/private-lessons/private-lessons-manager";
import { requireAdmin } from "@/lib/dal";
import { formatMoney } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("privateLessons") };
}
export const dynamic = "force-dynamic";

export default async function PrivateLessonsPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.privateLessons");

  const [lessonsRes, studentsRes, profilesRes] = await Promise.all([
    supabase
      .from("private_lessons")
      .select("id, date, price, payment_status, student_id, professor_id, students(first_name, last_name), profiles(full_name)")
      .order("date", { ascending: false }),
    supabase.from("students").select("id, first_name, last_name, active").eq("active", true).order("first_name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const lessons = (lessonsRes.data ?? []).map((row) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    const teacher = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      studentId: row.student_id,
      studentName: student ? `${student.first_name} ${student.last_name}` : "—",
      teacherId: row.professor_id,
      teacherName: teacher?.full_name ?? "Sin asignar",
      date: row.date,
      price: Number(row.price),
      status: row.payment_status as "pagado" | "pendiente" | "atrasado",
    };
  });

  const students = (studentsRes.data ?? []).map((row) => ({
    id: row.id,
    fullName: `${row.first_name} ${row.last_name}`,
  }));
  const teachers = (profilesRes.data ?? []).map((row) => ({ id: row.id, fullName: row.full_name }));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const isoMonthStart = monthStart.toISOString().slice(0, 10);

  const monthLessons = lessons.filter((lesson) => lesson.date >= isoMonthStart);
  const monthRevenue = monthLessons.filter((l) => l.status === "pagado").reduce((acc, l) => acc + l.price, 0);
  const monthPending = monthLessons.filter((l) => l.status !== "pagado").reduce((acc, l) => acc + l.price, 0);

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <>
          <Badge tone="primary" iconLeft={<Sparkles className="h-3 w-3" />}>
            {monthLessons.length} clases este mes
          </Badge>
          <Badge tone="success">Cobrado · {formatMoney(monthRevenue)}</Badge>
          {monthPending > 0 && <Badge tone="warning">Pendiente · {formatMoney(monthPending)}</Badge>}
        </>
      }
    >
      <PrivateLessonsManager lessons={lessons} students={students} teachers={teachers} />
    </PageShell>
  );
}
