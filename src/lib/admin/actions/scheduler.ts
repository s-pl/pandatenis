"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { autoAssign, type Suggestion } from "@/lib/admin/scheduler";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const AssignSchema = z.object({
  studentId: z.string().uuid(),
  groupId: z.string().uuid().nullable(),
});

const BulkAssignSchema = z.object({
  assignments: z
    .array(z.object({ studentId: z.string().uuid(), groupId: z.string().uuid() }))
    .min(1),
});

function ageFromBirthDate(birthDate: string): number {
  const d = new Date(birthDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

export async function suggestScheduleAction(): Promise<ActionResult<Suggestion[]>> {
  try {
    const { supabase } = await requireAdmin();
    const [groupsRes, studentsRes] = await Promise.all([
      supabase
        .from("groups")
        .select("id, name, level, capacity, weekdays, start_time, end_time"),
      supabase
        .from("students")
        .select(
          "id, first_name, last_name, birth_date, level, group_id, active, preferred_days, preferred_time_blocks",
        )
        .eq("active", true)
        .is("group_id", null),
    ]);

    if (groupsRes.error) throw groupsRes.error;
    if (studentsRes.error) throw studentsRes.error;

    const enrolledCounts = new Map<string, number>();
    const { data: counts } = await supabase
      .from("students")
      .select("group_id")
      .eq("active", true)
      .not("group_id", "is", null);
    for (const row of counts ?? []) {
      const id = row.group_id as string;
      enrolledCounts.set(id, (enrolledCounts.get(id) ?? 0) + 1);
    }

    const groups = (groupsRes.data ?? []).map((g) => ({
      id: g.id as string,
      name: g.name as string,
      level: g.level as "Rojo" | "Naranja" | "Verde" | "Amarillo",
      capacity: g.capacity as number,
      weekdays: (g.weekdays ?? []) as Array<"L" | "M" | "X" | "J" | "V" | "S" | "D">,
      startTime: g.start_time ? String(g.start_time).slice(0, 5) : null,
      endTime: g.end_time ? String(g.end_time).slice(0, 5) : null,
      enrolled: enrolledCounts.get(g.id as string) ?? 0,
    }));

    const students = (studentsRes.data ?? []).map((s) => ({
      id: s.id as string,
      fullName: `${s.first_name} ${s.last_name}`,
      level: s.level as "Rojo" | "Naranja" | "Verde" | "Amarillo",
      age: ageFromBirthDate(s.birth_date as string),
      preferredDays: (s.preferred_days ?? []) as Array<"L" | "M" | "X" | "J" | "V" | "S" | "D">,
      preferredTimeBlocks: (s.preferred_time_blocks ?? []) as Array<
        "tarde-temprano" | "tarde-media" | "tarde-tardia" | "sabado-manana"
      >,
    }));

    const suggestions = autoAssign(groups, students);
    return { ok: true, data: suggestions };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo falló" };
  }
}

export async function assignStudentToGroupAction(
  input: z.input<typeof AssignSchema>,
): Promise<ActionResult> {
  try {
    const data = AssignSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("students")
      .update({ group_id: data.groupId })
      .eq("id", data.studentId);
    if (error) throw error;
    revalidatePath("/admin/planner");
    revalidatePath("/admin/students");
    revalidatePath("/admin/groups");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo falló" };
  }
}

export async function applyBulkAssignmentsAction(
  input: z.input<typeof BulkAssignSchema>,
): Promise<ActionResult<{ applied: number }>> {
  try {
    const data = BulkAssignSchema.parse(input);
    const { supabase } = await requireAdmin();
    let applied = 0;
    // Hacemos updates uno a uno para que un error parcial no rompa el resto.
    for (const a of data.assignments) {
      const { error } = await supabase
        .from("students")
        .update({ group_id: a.groupId })
        .eq("id", a.studentId);
      if (!error) applied += 1;
    }
    revalidatePath("/admin/planner");
    revalidatePath("/admin/students");
    revalidatePath("/admin/groups");
    return { ok: true, data: { applied } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo falló" };
  }
}
