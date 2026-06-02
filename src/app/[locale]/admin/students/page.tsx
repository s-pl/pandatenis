import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FileSpreadsheet, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { StudentsManager } from "@/components/admin/students/students-manager";
import { requireAdmin } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("students") };
}
export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.students");

  const [studentsRes, guardiansRes, groupsRes, profilesRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, birth_date, address, level, dominant_hand, group_id, professor_id, medical_info, image_consent, coach_notes, active")
      .order("first_name")
      .limit(2000),
    supabase
      .from("guardians")
      .select("id, student_id, full_name, phone, email, relationship"),
    supabase.from("groups").select("id, name, level, capacity").order("name"),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
  ]);

  const students = (studentsRes.data ?? []).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date,
    address: row.address ?? "",
    level: row.level as "Rojo" | "Naranja" | "Verde" | "Amarillo",
    dominantHand: row.dominant_hand as "Derecha" | "Izquierda" | "Ambidiestro",
    groupId: row.group_id,
    professorId: row.professor_id,
    medicalInfo: row.medical_info ?? "",
    imageConsent: row.image_consent,
    coachNotes: row.coach_notes ?? "",
    active: row.active,
  }));

  const guardians = (guardiansRes.data ?? []).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email ?? "",
    relationship: row.relationship,
  }));

  const groups = (groupsRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    capacity: row.capacity,
  }));
  const teachers = (profilesRes.data ?? [])
    .filter((row) => row.role === "profesor" || row.role === "admin")
    .map((row) => ({ id: row.id, fullName: row.full_name }));

  const activeCount = students.filter((student) => student.active).length;

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <>
          <Badge tone="primary" iconLeft={<Users className="h-3 w-3" />}>
            {students.length} en total
          </Badge>
          <Badge tone="success">{activeCount} activos</Badge>
          {students.length - activeCount > 0 && (
            <Badge tone="neutral">{students.length - activeCount} archivados</Badge>
          )}
        </>
      }
      actions={
        <a
          href="/api/admin/students/export"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          download
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Excel
        </a>
      }
    >
      <StudentsManager
        students={students}
        guardians={guardians}
        groups={groups}
        teachers={teachers}
      />
    </PageShell>
  );
}
