"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const AwardSchema = z.object({
  studentId: z.string().uuid(),
  medalId: z.string().uuid(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function awardMedalAction(input: z.input<typeof AwardSchema>): Promise<ActionResult> {
  try {
    const data = AwardSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const { error } = await supabase.from("student_medals").insert({
      student_id: data.studentId,
      medal_id: data.medalId,
      awarded_by: profile.id,
    });
    if (error) throw error;
    revalidatePath(`/admin/students/${data.studentId}`);
    revalidatePath("/admin/medals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}

export async function removeMedalAction(studentMedalId: string, studentId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("student_medals").delete().eq("id", studentMedalId);
    if (error) throw error;
    revalidatePath(`/admin/students/${studentId}`);
    revalidatePath("/admin/medals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}
