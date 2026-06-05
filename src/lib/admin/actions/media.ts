"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const MediaSchema = z.object({
  studentId: z.string().uuid(),
  storagePath: z.string().trim().min(1),
  type: z.enum(["foto", "video"]),
  title: z.string().trim().min(1),
  consentChecked: z.boolean().default(false),
});

export type MediaInput = z.output<typeof MediaSchema>;
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export async function registerMediaAsset(input: MediaInput): Promise<ActionResult<{ id: string }>> {
  try {
    const data = MediaSchema.parse(input);
    if (data.storagePath.startsWith("http") || !data.storagePath.startsWith(`${data.studentId}/`)) {
      return { ok: false, error: "La ruta del archivo no pertenece al alumno seleccionado" };
    }
    const { supabase, profile } = await requireAdmin();
    const { data: row, error } = await supabase
      .from("media_assets")
      .insert({
        student_id: data.studentId,
        storage_path: data.storagePath,
        type: data.type,
        title: data.title,
        consent_checked: data.consentChecked,
        uploaded_by: profile.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/admin/gallery");
    revalidatePath(`/admin/students/${data.studentId}`);
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}

export async function deleteMediaAsset(assetId: string): Promise<ActionResult> {
  try {
    const id = z.string().uuid("Archivo no válido").parse(assetId);
    const { supabase } = await requireAdmin();
    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .select("id, student_id, storage_path")
      .eq("id", id)
      .maybeSingle();
    if (assetError) throw assetError;
    if (!asset) return { ok: false, error: "Archivo no encontrado" };

    if (!asset.storage_path.startsWith("http")) {
      const { error: removeError } = await supabase.storage
        .from("student-media")
        .remove([asset.storage_path]);
      if (removeError) throw removeError;
    }

    const { error: deleteRowError, count } = await supabase
      .from("media_assets")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("student_id", asset.student_id);
    if (deleteRowError) throw deleteRowError;
    if (count === 0) {
      return { ok: false, error: "No se ha podido confirmar el borrado del archivo" };
    }
    revalidatePath("/admin/gallery");
    revalidatePath(`/admin/students/${asset.student_id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}
