"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { appBaseUrl } from "@/lib/base-url";
import { sendAndLog } from "@/lib/sms/send-and-log";
import { promoSms } from "@/lib/sms/templates";
import { buildSmsRecipients } from "@/lib/sms/recipients";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

const PromotionSchema = z.object({
  titleEs: z.string().trim().min(2, "Indica el título en español"),
  titleEn: z.string().trim().min(2, "Indica el título en inglés"),
  posterPath: z.string().trim().optional().nullable(),
  posterUrl: z.string().trim().url().optional().nullable(),
  whatsappMsgEs: z.string().trim().max(400).optional().default(""),
  whatsappMsgEn: z.string().trim().max(400).optional().default(""),
  active: z.boolean().optional().default(true),
});

export type PromotionInput = z.input<typeof PromotionSchema>;

function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: "Revisa los datos de la promoción",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
}

export async function createPromotionAction(
  input: PromotionInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const data = PromotionSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const { data: row, error } = await supabase
      .from("promotions")
      .insert({
        title_es: data.titleEs,
        title_en: data.titleEn,
        poster_path: data.posterPath ?? null,
        poster_url: data.posterUrl ?? null,
        whatsapp_msg_es: data.whatsappMsgEs || null,
        whatsapp_msg_en: data.whatsappMsgEn || null,
        active: data.active,
        created_by: profile.id,
      })
      .select("id, slug")
      .single();
    if (error) throw error;
    revalidatePath("/admin/promotions");
    return { ok: true, data: { id: row.id, slug: row.slug } };
  } catch (error) {
    return fail(error);
  }
}

export async function updatePromotionAction(
  promotionId: string,
  input: PromotionInput,
): Promise<ActionResult> {
  try {
    const data = PromotionSchema.parse(input);
    const { supabase } = await requireAdmin();
    const patch: Record<string, unknown> = {
      title_es: data.titleEs,
      title_en: data.titleEn,
      whatsapp_msg_es: data.whatsappMsgEs || null,
      whatsapp_msg_en: data.whatsappMsgEn || null,
      active: data.active,
      updated_at: new Date().toISOString(),
    };
    // Sólo reemplaza el póster si se ha subido uno nuevo.
    if (data.posterPath) patch.poster_path = data.posterPath;
    if (data.posterUrl) patch.poster_url = data.posterUrl;

    const { error } = await supabase.from("promotions").update(patch).eq("id", promotionId);
    if (error) throw error;
    revalidatePath("/admin/promotions");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function togglePromotionActive(
  promotionId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("promotions")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", promotionId);
    if (error) throw error;
    revalidatePath("/admin/promotions");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePromotionAction(promotionId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { data: promo } = await supabase
      .from("promotions")
      .select("poster_path")
      .eq("id", promotionId)
      .maybeSingle();
    const { error } = await supabase.from("promotions").delete().eq("id", promotionId);
    if (error) throw error;
    if (promo?.poster_path) {
      await supabase.storage.from("promotions").remove([promo.poster_path]);
    }
    revalidatePath("/admin/promotions");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

const SendSchema = z.object({
  promotionId: z.string().uuid(),
  // Alumnos seleccionados: se usa su idioma guardado y el teléfono del tutor.
  studentIds: z.array(z.string().uuid()).optional().default([]),
  // Contactos manuales (aún no alumnos): teléfono + idioma elegido a mano.
  manualRecipients: z
    .array(
      z.object({
        phone: z.string().trim().min(6),
        locale: z.enum(["es", "en"]),
      }),
    )
    .optional()
    .default([]),
  // Campaña masiva por lista: a quién enviar y filtro de idioma.
  audience: z.enum(["none", "students", "leads", "both"]).optional().default("none"),
  localeFilter: z.enum(["all", "es", "en"]).optional().default("all"),
  // Mensaje personalizado opcional. Si se deja vacío se usa el SMS por defecto
  // (título de la promoción + enlace al cartel).
  customBodyEs: z.string().trim().max(600).optional().default(""),
  customBodyEn: z.string().trim().max(600).optional().default(""),
});

export type SendPromotionInput = z.input<typeof SendSchema>;

export async function sendPromotionSmsAction(
  input: SendPromotionInput,
): Promise<ActionResult<{ sent: number; failed: number; skipped: number }>> {
  try {
    const data = SendSchema.parse(input);
    const { supabase } = await requireAdmin();

    const { data: promo, error: promoError } = await supabase
      .from("promotions")
      .select("id, slug, title_es, title_en")
      .eq("id", data.promotionId)
      .maybeSingle();
    if (promoError) throw promoError;
    if (!promo) return { ok: false, error: "Promoción no encontrada" };

    const base = await appBaseUrl();
    const statusCallbackUrl = `${base}/api/sms/status`;

    const recipients = await buildSmsRecipients(supabase, {
      audience: data.audience,
      localeFilter: data.localeFilter,
      studentIds: data.studentIds,
      manualRecipients: data.manualRecipients,
    });

    if (recipients.length === 0) {
      return { ok: false, error: "No hay destinatarios con teléfono válido" };
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const r of recipients) {
      const title = r.locale === "en" ? promo.title_en : promo.title_es;
      const link = `${base}/${r.locale}/p/${promo.slug}`;
      // Mensaje personalizado (con fallback al otro idioma); si no, el por defecto.
      const custom =
        r.locale === "en"
          ? data.customBodyEn || data.customBodyEs
          : data.customBodyEs || data.customBodyEn;
      const body = custom && custom.trim() ? custom : promoSms(title, link, r.locale);
      const result = await sendAndLog(supabase, {
        to: r.phone,
        body,
        locale: r.locale,
        kind: "promo",
        studentId: r.studentId,
        promotionId: promo.id,
        statusCallbackUrl,
      });
      if (result.status === "sent") sent += 1;
      else if (result.status === "skipped") skipped += 1;
      else failed += 1;
    }

    revalidatePath("/admin/promotions");
    return { ok: true, data: { sent, failed, skipped } };
  } catch (error) {
    return fail(error);
  }
}
