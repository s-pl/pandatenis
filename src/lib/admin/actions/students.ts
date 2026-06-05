"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const StudentSchema = z.object({
  firstName: z.string().trim().min(1, "Indica el nombre"),
  lastName: z.string().trim().min(1, "Indica los apellidos"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: AAAA-MM-DD"),
  address: z.string().trim().optional().default(""),
  level: z.enum(["Rojo", "Naranja", "Verde", "Amarillo"]),
  dominantHand: z.enum(["Derecha", "Izquierda", "Ambidiestro"]),
  groupId: z.string().uuid().optional().nullable(),
  professorId: z.string().uuid().optional().nullable(),
  medicalInfo: z.string().trim().optional().default(""),
  imageConsent: z.boolean().default(false),
  coachNotes: z.string().trim().optional().default(""),
  guardianName: z.string().trim().min(1, "Indica el nombre del tutor"),
  guardianPhone: z.string().trim().min(6, "Teléfono inválido"),
  guardianEmail: z.string().trim().email().optional().or(z.literal("")),
  relationship: z.string().trim().min(1, "Indica la relación"),
  commLocale: z.enum(["es", "en"]).default("es"),
});

export type StudentInput = z.output<typeof StudentSchema>;
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

function fail<T>(error: unknown, fieldErrors?: Record<string, string[] | undefined>): ActionResult<T> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: "Revisa los campos marcados",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Algo ha fallado",
    fieldErrors,
  };
}

export async function createStudentAction(input: StudentInput): Promise<ActionResult<{ id: string }>> {
  try {
    const data = StudentSchema.parse(input);
    const { supabase } = await requireAdmin();

    const { data: student, error } = await supabase
      .from("students")
      .insert({
        first_name: data.firstName,
        last_name: data.lastName,
        birth_date: data.birthDate,
        address: data.address,
        level: data.level,
        dominant_hand: data.dominantHand,
        group_id: data.groupId ?? null,
        professor_id: data.professorId ?? null,
        medical_info: data.medicalInfo,
        image_consent: data.imageConsent,
        coach_notes: data.coachNotes,
        comm_locale: data.commLocale,
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: guardianError } = await supabase.from("guardians").insert({
      student_id: student.id,
      full_name: data.guardianName,
      phone: data.guardianPhone,
      email: data.guardianEmail || null,
      relationship: data.relationship,
    });
    if (guardianError) {
      await supabase.from("students").delete().eq("id", student.id);
      throw guardianError;
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin");
    return { ok: true, data: { id: student.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateStudentAction(
  studentId: string,
  guardianId: string | null,
  input: StudentInput,
): Promise<ActionResult> {
  try {
    const data = StudentSchema.parse(input);
    const { supabase } = await requireAdmin();

    const { error: studentError } = await supabase
      .from("students")
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        birth_date: data.birthDate,
        address: data.address,
        level: data.level,
        dominant_hand: data.dominantHand,
        group_id: data.groupId ?? null,
        professor_id: data.professorId ?? null,
        medical_info: data.medicalInfo,
        image_consent: data.imageConsent,
        coach_notes: data.coachNotes,
        comm_locale: data.commLocale,
      })
      .eq("id", studentId);
    if (studentError) throw studentError;

    if (guardianId) {
      const { error: guardianError } = await supabase
        .from("guardians")
        .update({
          full_name: data.guardianName,
          phone: data.guardianPhone,
          email: data.guardianEmail || null,
          relationship: data.relationship,
        })
        .eq("id", guardianId);
      if (guardianError) throw guardianError;
    } else {
      const { error: insertError } = await supabase.from("guardians").insert({
        student_id: studentId,
        full_name: data.guardianName,
        phone: data.guardianPhone,
        email: data.guardianEmail || null,
        relationship: data.relationship,
      });
      if (insertError) throw insertError;
    }

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${studentId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleStudentActive(studentId: string, active: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("students").update({ active }).eq("id", studentId);
    if (error) throw error;
    revalidatePath("/admin/students");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteStudentAction(studentId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("students").delete().eq("id", studentId);
    if (error) throw error;
    revalidatePath("/admin/students");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
