import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { ReportsManager } from "@/components/admin/reports/reports-manager";
import { requireAdmin } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("reports") };
}
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.reports");

  const [reportsRes, studentsRes] = await Promise.all([
    supabase
      .from("term_reports")
      .select("id, term, coach_comment, sent_at, created_at, student_id, students(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(4000),
    supabase
      .from("students")
      .select("id, first_name, last_name, active")
      .eq("active", true)
      .order("first_name"),
  ]);

  const reports = (reportsRes.data ?? []).map((row) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    return {
      id: row.id,
      studentId: row.student_id,
      term: row.term,
      coachComment: row.coach_comment ?? "",
      sentAt: row.sent_at,
      createdAt: row.created_at,
      studentName: student ? `${student.first_name} ${student.last_name}` : "—",
    };
  });

  const students = (studentsRes.data ?? []).map((row) => ({
    id: row.id,
    fullName: `${row.first_name} ${row.last_name}`,
  }));

  const sentCount = reports.filter((report) => report.sentAt).length;

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <>
          <Badge tone="primary" iconLeft={<ScrollText className="h-3 w-3" />}>{reports.length} informes</Badge>
          <Badge tone="success">{sentCount} enviados</Badge>
          {reports.length - sentCount > 0 && (
            <Badge tone="warning">{reports.length - sentCount} pendientes de enviar</Badge>
          )}
        </>
      }
    >
      <ReportsManager reports={reports} students={students} />
    </PageShell>
  );
}
