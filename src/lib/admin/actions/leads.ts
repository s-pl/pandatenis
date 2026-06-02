"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { recordAdminActivity } from "@/lib/admin/activity";
import { normalizeWhatsappNumber } from "@/lib/format";
import type { ConsentImportResult, LeadPipelineStage } from "@/lib/types";

const LeadStageSchema = z.enum([
  "nuevo",
  "contactado",
  "interesado",
  "prueba_agendada",
  "convertido",
  "perdido",
]);

const LeadSchema = z.object({
  fullName: z.string().trim().min(1),
  phone: z.string().trim().min(6),
  childAge: z.coerce.number().min(1).max(18),
  interest: z.enum(["escuela", "campus", "ambos"]),
  sourceId: z.string().uuid().optional().nullable(),
  observations: z.string().trim().optional().default(""),
  status: LeadStageSchema.default("nuevo"),
  nextActionAt: z.string().datetime().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  lostReason: z.string().trim().optional().nullable(),
  whatsappConsent: z.boolean().optional().default(false),
  marketingConsent: z.boolean().optional().default(false),
  consentSource: z.string().trim().optional().nullable(),
  consentText: z.string().trim().optional().nullable(),
  consentAt: z.string().datetime().optional().nullable(),
});

const PipelineSchema = z.object({
  leadId: z.string().uuid(),
  status: LeadStageSchema,
  nextActionAt: z.string().datetime().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  lostReason: z.string().trim().optional().nullable(),
});

const ImportSchema = z.object({
  rows: z.array(z.record(z.string(), z.string().optional())).min(1).max(1000),
  defaultInterest: z.enum(["escuela", "campus", "ambos"]).default("escuela"),
  defaultSourceName: z.string().trim().min(1).max(80).default("CSV consentimiento"),
  defaultConsentText: z.string().trim().max(1000).optional().default("Consentimiento importado desde CSV."),
});

export type LeadInput = z.output<typeof LeadSchema>;
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function fail<T>(error: unknown): ActionResult<T> {
  return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
}

export async function createLeadAction(input: LeadInput): Promise<ActionResult> {
  try {
    const data = LeadSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const { error } = await supabase.from("leads").insert({
      full_name: data.fullName,
      phone: data.phone,
      child_age: data.childAge,
      interest: data.interest,
      source_id: data.sourceId ?? null,
      observations: data.observations,
      status: data.status,
      next_action_at: data.nextActionAt ?? null,
      assigned_to: data.assignedTo ?? null,
      lost_reason: data.lostReason ?? null,
      whatsapp_consent: data.whatsappConsent,
      marketing_consent: data.marketingConsent,
      consent_source: data.consentSource ?? null,
      consent_text: data.consentText ?? null,
      consent_at: data.consentAt ?? null,
    });
    if (error) throw error;
    await recordAdminActivity(supabase, {
      eventType: "lead_created",
      entityType: "lead",
      summary: `Contacto creado: ${data.fullName}`,
      actorId: profile.id,
      metadata: { status: data.status, sourceId: data.sourceId },
    });
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateLeadStatusAction(
  leadId: string,
  status: LeadPipelineStage,
): Promise<ActionResult> {
  return updateLeadPipelineAction({ leadId, status });
}

export async function updateLeadPipelineAction(
  input: z.input<typeof PipelineSchema>,
): Promise<ActionResult> {
  try {
    const data = PipelineSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const updates = {
      status: data.status,
      next_action_at: data.nextActionAt ?? null,
      assigned_to: data.assignedTo ?? null,
      lost_reason: data.status === "perdido" ? data.lostReason ?? null : null,
    };
    const { error } = await supabase.from("leads").update(updates).eq("id", data.leadId);
    if (error) throw error;
    await recordAdminActivity(supabase, {
      eventType: "lead_pipeline_updated",
      entityType: "lead",
      entityId: data.leadId,
      summary: `Contacto movido a ${data.status}`,
      actorId: profile.id,
      metadata: updates,
    });
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function importConsentedLeadsAction(
  input: z.input<typeof ImportSchema>,
): Promise<ActionResult<ConsentImportResult>> {
  try {
    const data = ImportSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const result: ConsentImportResult = { created: 0, updated: 0, skipped: 0, invalid: [] };

    const { data: source, error: sourceError } = await supabase
      .from("lead_sources")
      .upsert({ name: data.defaultSourceName }, { onConflict: "name" })
      .select("id")
      .single();
    if (sourceError) throw sourceError;

    const { data: existingRows, error: existingError } = await supabase
      .from("leads")
      .select("id, phone");
    if (existingError) throw existingError;
    const existingByPhone = new Map<string, string>();
    for (const row of existingRows ?? []) {
      const normalized = normalizeWhatsappNumber(row.phone ?? "");
      if (normalized) existingByPhone.set(normalized, row.id);
    }

    const seen = new Set<string>();
    for (const [index, row] of data.rows.entries()) {
      const fullName = pick(row, ["nombre", "name", "full_name", "responsable", "contacto", "familia"]);
      const phoneRaw = pick(row, ["telefono", "teléfono", "phone", "movil", "móvil", "whatsapp", "celular"]);
      const phone = normalizeWhatsappNumber(phoneRaw);
      if (!fullName) {
        result.invalid.push({ row: index + 1, reason: "Falta nombre" });
        result.skipped++;
        continue;
      }
      if (!phone || !/^\d{8,15}$/.test(phone)) {
        result.invalid.push({ row: index + 1, reason: "Teléfono inválido" });
        result.skipped++;
        continue;
      }
      if (seen.has(phone)) {
        result.invalid.push({ row: index + 1, reason: "Duplicado en el CSV" });
        result.skipped++;
        continue;
      }
      seen.add(phone);

      const whatsappConsent = parseBool(pick(row, ["consentimiento_whatsapp", "whatsapp_consent", "consent_whatsapp", "whatsapp"]));
      const marketingConsent = parseBool(pick(row, ["consentimiento_marketing", "marketing_consent", "consent_marketing", "marketing"]));
      if (!whatsappConsent && !marketingConsent) {
        result.invalid.push({ row: index + 1, reason: "Sin consentimiento marcado" });
        result.skipped++;
        continue;
      }

      const consentAt = parseDate(pick(row, ["fecha_consentimiento", "consent_at", "fecha", "date"]));
      const childAge = Number(pick(row, ["edad", "child_age", "edad_nino", "edad_niño"]) || 6);
      const interest = parseInterest(pick(row, ["interes", "interés", "interest", "tipo"])) ?? data.defaultInterest;
      const observations = pick(row, ["observaciones", "observations", "nota", "notas"]);
      const consentSource = pick(row, ["origen", "source", "consent_source"]) || data.defaultSourceName;
      const consentText = pick(row, ["texto_consentimiento", "consent_text", "texto"]) || data.defaultConsentText;
      const existingId = existingByPhone.get(phone);
      const payload = {
        full_name: fullName,
        phone,
        child_age: Number.isFinite(childAge) ? Math.max(1, Math.min(18, childAge)) : 6,
        interest,
        source_id: source.id,
        observations,
        status: "nuevo" as const,
        whatsapp_consent: whatsappConsent,
        marketing_consent: marketingConsent,
        consent_source: consentSource,
        consent_text: consentText,
        consent_at: consentAt,
      };

      if (existingId) {
        const { error } = await supabase
          .from("leads")
          .update({
            whatsapp_consent: payload.whatsapp_consent,
            marketing_consent: payload.marketing_consent,
            consent_source: payload.consent_source,
            consent_text: payload.consent_text,
            consent_at: payload.consent_at,
            observations: observations || undefined,
          })
          .eq("id", existingId);
        if (error) throw error;
        result.updated++;
      } else {
        const { error } = await supabase.from("leads").insert(payload);
        if (error) throw error;
        result.created++;
      }
    }

    await recordAdminActivity(supabase, {
      eventType: "leads_imported",
      entityType: "lead",
      summary: `Importados ${result.created + result.updated} contactos con consentimiento`,
      actorId: profile.id,
      metadata: result,
    });
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteLeadAction(leadId: string): Promise<ActionResult> {
  try {
    const { supabase, profile } = await requireAdmin();
    const { error } = await supabase.from("leads").delete().eq("id", leadId);
    if (error) throw error;
    await recordAdminActivity(supabase, {
      eventType: "lead_deleted",
      entityType: "lead",
      entityId: leadId,
      summary: "Contacto eliminado",
      actorId: profile.id,
    });
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

function pick(row: Record<string, string | undefined>, candidates: string[]): string {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const found = entries.find(([key]) => normalizeKey(key) === normalizeKey(candidate));
    const value = found?.[1]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseBool(value: string): boolean {
  return /^(si|sí|yes|true|1|x|ok|acepto|aceptado)$/i.test(value.trim());
}

function parseDate(value: string): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function parseInterest(value: string): "escuela" | "campus" | "ambos" | null {
  const normalized = normalizeKey(value);
  if (normalized.includes("campus") || normalized.includes("campamento")) return "campus";
  if (normalized.includes("ambos") || normalized.includes("escuela_campus")) return "ambos";
  if (normalized.includes("escuela")) return "escuela";
  return null;
}
