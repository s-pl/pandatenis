"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const CourseSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "Slug demasiado corto")
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  title: z.string().trim().min(2, "Indica un título").max(120),
  kind: z.enum(["campus", "escuela"]).default("campus"),
  datesLabel: z.string().trim().max(80).optional().default(""),
  startsOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
    .optional()
    .or(z.literal(""))
    .nullable(),
  endsOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
    .optional()
    .or(z.literal(""))
    .nullable(),
  intro: z.string().trim().max(2000).optional().default(""),
  imagePath: z.string().trim().max(400).optional().nullable(),
  isPublic: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type CampusCourseInput = z.input<typeof CourseSchema>;
type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Datos no válidos" };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Algo falló" };
}

function revalidateCourseViews() {
  revalidatePath("/admin/campus");
  revalidatePath("/campamentos");
  revalidatePath("/");
}

export async function createCampusCourseAction(
  input: CampusCourseInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const data = CourseSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { data: row, error } = await supabase
      .from("campus_courses")
      .insert({
        slug: data.slug,
        title: data.title,
        kind: data.kind,
        dates_label: data.datesLabel,
        starts_on: data.startsOn || null,
        ends_on: data.endsOn || null,
        intro: data.intro,
        image_path: data.imagePath || null,
        is_public: data.isPublic,
        sort_order: data.sortOrder,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateCourseViews();
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateCampusCourseAction(
  id: string,
  input: CampusCourseInput,
): Promise<ActionResult> {
  try {
    const data = CourseSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("campus_courses")
      .update({
        slug: data.slug,
        title: data.title,
        kind: data.kind,
        dates_label: data.datesLabel,
        starts_on: data.startsOn || null,
        ends_on: data.endsOn || null,
        intro: data.intro,
        image_path: data.imagePath || null,
        is_public: data.isPublic,
        sort_order: data.sortOrder,
      })
      .eq("id", id);
    if (error) throw error;
    revalidateCourseViews();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteCampusCourseAction(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("campus_courses").delete().eq("id", id);
    if (error) throw error;
    revalidateCourseViews();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleCampusCoursePublicAction(
  id: string,
  isPublic: boolean,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("campus_courses")
      .update({ is_public: isPublic })
      .eq("id", id);
    if (error) throw error;
    revalidateCourseViews();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
