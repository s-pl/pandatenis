"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/dal";

const UpsertSchema = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: z.enum(["asistio", "no_asistio", "aviso_ausencia"]),
  note: z.string().trim().optional().default(""),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function upsertAttendance(input: z.input<typeof UpsertSchema>): Promise<ActionResult> {
  try {
    const data = UpsertSchema.parse(input);
    const { supabase } = await requireStaff();
    const { error } = await supabase.from("attendance_records").upsert(
      {
        class_id: data.classId,
        student_id: data.studentId,
        status: data.status,
        note: data.note || null,
      },
      { onConflict: "class_id,student_id" },
    );
    if (error) throw error;
    revalidatePath("/admin/attendance");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}
