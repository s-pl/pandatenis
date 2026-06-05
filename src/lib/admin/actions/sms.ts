"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { appBaseUrl } from "@/lib/base-url";
import { sendAndLog } from "@/lib/sms/send-and-log";
import { buildSmsRecipients } from "@/lib/sms/recipients";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: "Revisa los datos",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
}

/* ───────────────────────── Campaña de SMS ───────────────────────── */

const CampaignSchema = z
  .object({
    bodyEs: z.string().trim().min(2, "Escribe el mensaje en español").max(600),
    bodyEn: z.string().trim().max(600).optional().default(""),
    audience: z.enum(["none", "students", "leads", "both"]).default("both"),
    localeFilter: z.enum(["all", "es", "en"]).default("all"),
    studentIds: z.array(z.string().uuid()).optional().default([]),
    manualRecipients: z
      .array(z.object({ phone: z.string().trim().min(6), locale: z.enum(["es", "en"]) }))
      .optional()
      .default([]),
  })
  .refine((v) => v.audience !== "none" || v.studentIds.length > 0 || v.manualRecipients.length > 0, {
    message: "Elige una audiencia o destinatarios",
  });

export type SmsCampaignInput = z.input<typeof CampaignSchema>;

export async function sendSmsCampaignAction(
  input: SmsCampaignInput,
): Promise<ActionResult<{ sent: number; failed: number; skipped: number; total: number }>> {
  try {
    const data = CampaignSchema.parse(input);
    const { supabase } = await requireAdmin();

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
      // Inglés con fallback a español si no se ha escrito la versión EN.
      const body = r.locale === "en" && data.bodyEn ? data.bodyEn : data.bodyEs;
      const result = await sendAndLog(supabase, {
        to: r.phone,
        body,
        locale: r.locale,
        kind: "campaign",
        studentId: r.studentId,
        statusCallbackUrl,
      });
      if (result.status === "sent") sent += 1;
      else if (result.status === "skipped") skipped += 1;
      else failed += 1;
    }

    revalidatePath("/admin/sms");
    return { ok: true, data: { sent, failed, skipped, total: recipients.length } };
  } catch (error) {
    return fail(error);
  }
}

/* ───────────────────────── Plantillas SMS ───────────────────────── */

const TemplateSchema = z.object({
  name: z.string().trim().min(2, "Indica un nombre").max(80),
  bodyEs: z.string().trim().min(2, "Escribe el mensaje en español").max(600),
  bodyEn: z.string().trim().min(2, "Escribe el mensaje en inglés").max(600),
});

export type SmsTemplateInput = z.input<typeof TemplateSchema>;

export async function createSmsTemplateAction(
  input: SmsTemplateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const data = TemplateSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { data: row, error } = await supabase
      .from("sms_templates")
      .insert({ name: data.name, body_es: data.bodyEs, body_en: data.bodyEn })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/admin/sms");
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateSmsTemplateAction(
  id: string,
  input: SmsTemplateInput,
): Promise<ActionResult> {
  try {
    const data = TemplateSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("sms_templates")
      .update({
        name: data.name,
        body_es: data.bodyEs,
        body_en: data.bodyEn,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/sms");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteSmsTemplateAction(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("sms_templates").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/sms");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
