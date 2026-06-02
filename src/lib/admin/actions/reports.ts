"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const ReportSchema = z.object({
  studentId: z.string().uuid(),
  term: z.string().trim().min(1),
  coachComment: z.string().trim().optional().default(""),
});

export type ReportInput = z.output<typeof ReportSchema>;
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createTermReportAction(input: ReportInput): Promise<ActionResult> {
  try {
    const data = ReportSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const { error } = await supabase.from("term_reports").insert({
      student_id: data.studentId,
      term: data.term,
      coach_comment: data.coachComment || null,
      created_by: profile.id,
    });
    if (error) throw error;
    revalidatePath("/admin/reports");
    revalidatePath(`/admin/students/${data.studentId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}

export async function markReportSent(reportId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("term_reports")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", reportId);
    if (error) throw error;
    revalidatePath("/admin/reports");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}
