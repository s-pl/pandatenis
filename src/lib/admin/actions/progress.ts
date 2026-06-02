"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const ProgressSchema = z.object({
  studentId: z.string().uuid(),
  term: z.string().trim().min(1),
  drive: z.coerce.number().min(0).max(100),
  reves: z.coerce.number().min(0).max(100),
  saque: z.coerce.number().min(0).max(100),
  actitud: z.coerce.number().min(0).max(100),
  asistencia: z.coerce.number().min(0).max(100),
  coachComment: z.string().trim().optional().default(""),
});

export type ProgressInput = z.output<typeof ProgressSchema>;
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveProgressEvaluation(input: ProgressInput): Promise<ActionResult> {
  try {
    const data = ProgressSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const { error } = await supabase.from("progress_evaluations").insert({
      student_id: data.studentId,
      term: data.term,
      drive: data.drive,
      reves: data.reves,
      saque: data.saque,
      actitud: data.actitud,
      asistencia: data.asistencia,
      coach_comment: data.coachComment || null,
      created_by: profile.id,
    });
    if (error) throw error;
    revalidatePath(`/admin/students/${data.studentId}`);
    revalidatePath("/admin/students");
    revalidatePath("/admin/reports");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}
