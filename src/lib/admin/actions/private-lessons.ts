"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const LessonSchema = z.object({
  studentId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price: z.coerce.number().min(0),
  paymentStatus: z.enum(["pagado", "pendiente", "atrasado"]).default("pendiente"),
  professorId: z.string().uuid().optional().nullable(),
});

export type LessonInput = z.output<typeof LessonSchema>;
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createLessonAction(input: LessonInput): Promise<ActionResult> {
  try {
    const data = LessonSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("private_lessons").insert({
      student_id: data.studentId,
      date: data.date,
      price: data.price,
      payment_status: data.paymentStatus,
      professor_id: data.professorId ?? null,
    });
    if (error) throw error;
    revalidatePath("/admin/private-lessons");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}

export async function toggleLessonPaid(lessonId: string, paymentStatus: "pagado" | "pendiente"): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("private_lessons")
      .update({ payment_status: paymentStatus })
      .eq("id", lessonId);
    if (error) throw error;
    revalidatePath("/admin/private-lessons");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}

export async function deleteLessonAction(lessonId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("private_lessons").delete().eq("id", lessonId);
    if (error) throw error;
    revalidatePath("/admin/private-lessons");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}
