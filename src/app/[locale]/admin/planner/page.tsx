import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CalendarRange, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { SchedulePlanner } from "@/components/admin/planner/schedule-planner";
import { requireAdmin } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("planner") };
}
export const dynamic = "force-dynamic";

function ageFromBirthDate(birthDate: string): number {
  const d = new Date(birthDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

export default async function PlannerPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.planner");

  const [groupsRes, studentsRes] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, level, capacity, weekdays, start_time, end_time, location")
      .order("level")
      .order("start_time"),
    supabase
      .from("students")
      .select(
        "id, first_name, last_name, birth_date, level, group_id, active, preferred_days, preferred_time_blocks",
      )
      .eq("active", true)
      .order("first_name"),
  ]);

  const groups = (groupsRes.data ?? []).map((g) => ({
    id: g.id as string,
    name: g.name as string,
    level: g.level as "Rojo" | "Naranja" | "Verde" | "Amarillo",
    capacity: g.capacity as number,
    weekdays: (g.weekdays ?? []) as Array<"L" | "M" | "X" | "J" | "V" | "S" | "D">,
    startTime: g.start_time ? String(g.start_time).slice(0, 5) : "",
    endTime: g.end_time ? String(g.end_time).slice(0, 5) : "",
    location: (g.location as string) ?? "",
  }));

  const students = (studentsRes.data ?? []).map((s) => ({
    id: s.id as string,
    fullName: `${s.first_name} ${s.last_name}`,
    age: ageFromBirthDate(s.birth_date as string),
    level: s.level as "Rojo" | "Naranja" | "Verde" | "Amarillo",
    groupId: (s.group_id as string | null) ?? null,
    preferredDays: (s.preferred_days ?? []) as Array<"L" | "M" | "X" | "J" | "V" | "S" | "D">,
    preferredTimeBlocks: (s.preferred_time_blocks ?? []) as Array<
      "tarde-temprano" | "tarde-media" | "tarde-tardia" | "sabado-manana"
    >,
  }));

  const pending = students.filter((s) => !s.groupId);

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <>
          <Badge tone="primary" iconLeft={<CalendarRange className="h-3 w-3" />}>
            {groups.length} grupos
          </Badge>
          <Badge tone="info">{students.length} alumnos activos</Badge>
          {pending.length > 0 && (
            <Badge tone="warning">{pending.length} sin asignar</Badge>
          )}
        </>
      }
      actions={
        <a
          href="/api/admin/planner/export"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          download
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar horario
        </a>
      }
    >
      <SchedulePlanner groups={groups} students={students} />
    </PageShell>
  );
}
