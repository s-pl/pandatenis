import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { GroupsManager } from "@/components/admin/groups/groups-manager";
import { requireAdmin } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("groups") };
}
export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.groups");

  const [groupsRes, studentsRes, profilesRes] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, level, professor_id, schedule, capacity, location, weekdays, start_time, end_time")
      .order("name"),
    supabase.from("students").select("id, group_id, active"),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
  ]);

  const teachers = (profilesRes.data ?? []).map((row) => ({ id: row.id, fullName: row.full_name }));

  const groups = (groupsRes.data ?? []).map((row) => {
    const enrolled = (studentsRes.data ?? []).filter(
      (student) => student.group_id === row.id && student.active,
    ).length;
    return {
      id: row.id,
      name: row.name,
      level: row.level as "Rojo" | "Naranja" | "Verde" | "Amarillo",
      professorId: row.professor_id,
      professorName:
        teachers.find((teacher) => teacher.id === row.professor_id)?.fullName ?? "Sin asignar",
      schedule: row.schedule,
      capacity: row.capacity,
      location: row.location ?? "",
      weekdays: (row.weekdays ?? []) as Array<"L" | "M" | "X" | "J" | "V" | "S" | "D">,
      startTime: row.start_time ? String(row.start_time).slice(0, 5) : "",
      endTime: row.end_time ? String(row.end_time).slice(0, 5) : "",
      enrolled,
    };
  });

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <Badge tone="primary" iconLeft={<MapPinned className="h-3 w-3" />}>
          {groups.length} grupos activos
        </Badge>
      }
    >
      <GroupsManager groups={groups} teachers={teachers} />
    </PageShell>
  );
}
