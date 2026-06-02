"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { normalizeWhatsappNumber } from "@/lib/format";
import {
  isRetryableWhatsappError,
  isWhatsappConfigured,
  jitterDelay,
  sendViaProvider,
  whatsappErrorMessage,
} from "@/lib/whatsapp";

const MediaSchema = z.object({
  studentId: z.string().uuid(),
  storagePath: z.string().trim().min(1),
  type: z.enum(["foto", "video"]),
  title: z.string().trim().min(1),
  consentChecked: z.boolean().default(false),
});

export type MediaInput = z.output<typeof MediaSchema>;
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function nextAttemptAt(attemptCount: number) {
  const delays = [30, 90, 180, 300, 600, 1200, 1800];
  const delaySeconds = delays[Math.min(Math.max(attemptCount - 1, 0), delays.length - 1)];
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

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

const SendSchema = z.object({
  assetId: z.string().uuid(),
});

export async function shareMediaByWhatsapp(
  input: z.input<typeof SendSchema>,
): Promise<ActionResult<{ status: "sent" | "queued" }>> {
  try {
    const data = SendSchema.parse(input);
    if (!isWhatsappConfigured()) throw new Error("WhatsApp Business no está configurado");
    const { supabase } = await requireAdmin();

    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .select(
        "id, title, storage_path, consent_checked, student_id, students(first_name, last_name, guardians(full_name, phone))",
      )
      .eq("id", data.assetId)
      .maybeSingle();
    if (assetError) throw assetError;
    if (!asset) throw new Error("Foto no encontrada");
    if (!asset.consent_checked) throw new Error("Falta el consentimiento de imagen de la familia");

    const student = Array.isArray(asset.students) ? asset.students[0] : asset.students;
    if (!student) throw new Error("Alumno sin datos asociados");
    const guardian = Array.isArray(student.guardians) ? student.guardians[0] : student.guardians;
    if (!guardian) throw new Error("El alumno no tiene un tutor con teléfono");

    const phone = normalizeWhatsappNumber(guardian.phone);
    if (!/^\d{8,15}$/.test(phone)) throw new Error("Teléfono del tutor no válido");

    let mediaUrl = asset.storage_path;
    if (!mediaUrl.startsWith("http")) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("student-media")
        .createSignedUrl(asset.storage_path, 60 * 60 * 24);
      if (signedError || !signed?.signedUrl) {
        throw new Error(
          "No se ha podido generar el enlace privado del archivo. Vuelve a subirlo o revisa permisos de Storage.",
        );
      }
      mediaUrl = signed.signedUrl;
    }

    const { data: template } = await supabase
      .from("message_templates")
      .select("id, meta_template_name, body")
      .eq("category", "galeria")
      .eq("meta_status", "approved")
      .limit(1)
      .maybeSingle();

    const guardianFirstName = guardian.full_name.split(" ")[0] ?? guardian.full_name;
    const studentFullName = `${student.first_name} ${student.last_name}`;
    const variables = { "1": guardianFirstName, "2": studentFullName };
    const fallbackBody = `Hola ${guardianFirstName}, te mandamos una foto/vídeo de ${studentFullName} en la clase. ¡Esperamos que os guste!`;
    const body = template ? renderTemplate(template.body, variables) : fallbackBody;

    const { data: row, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        recipient_name: guardian.full_name,
        recipient_phone: phone,
        template_id: template?.id ?? null,
        template_name: template?.meta_template_name ?? "galeria_envio",
        status: "queued",
        related_type: "galeria",
        related_id: asset.id,
        body_text: body,
        payload: {
          ...variables,
          title: asset.title,
          body,
          media_url: mediaUrl,
        },
      })
      .select("id")
      .single();
    if (insertError || !row) throw insertError ?? new Error("No se pudo registrar el mensaje");

    let status: "sent" | "queued" = "sent";
    try {
      const result = await sendViaProvider({
        to: phone,
        mediaUrl,
        mediaCaption: body,
        delayMs: jitterDelay(),
      });
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "sent",
          provider_message_id: result.id,
          sent_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    } catch (sendError) {
      const retryable = isRetryableWhatsappError(sendError);
      const errorMessage = whatsappErrorMessage(sendError);
      const nowIso = new Date().toISOString();
      status = retryable ? "queued" : "sent";
      await supabase
        .from("whatsapp_messages")
        .update({
          status: retryable ? "queued" : "failed",
          error_message: retryable
            ? `${errorMessage}. Se reintentará automáticamente.`
            : errorMessage,
          attempt_count: 1,
          last_attempt_at: nowIso,
          next_attempt_at: retryable ? nextAttemptAt(1) : null,
        })
        .eq("id", row.id);
      if (!retryable) throw sendError;
    }

    revalidatePath("/admin/whatsapp");
    revalidatePath("/admin/gallery");
    return { ok: true, data: { status } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}

function renderTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{(\d+|[a-zA-Z_]\w*)\}\}/g, (_, key) => variables[String(key)] ?? `{{${key}}}`);
}
