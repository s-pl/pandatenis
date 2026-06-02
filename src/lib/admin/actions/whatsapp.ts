"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { recordAdminActivity } from "@/lib/admin/activity";
import { requireAdmin } from "@/lib/dal";
import { normalizeWhatsappNumber } from "@/lib/format";
import { logError } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findCatalogTemplate } from "@/lib/admin/template-catalog";
import {
  buildTemplateComponents,
  createMessageTemplate,
  editMessageTemplate,
  uploadTemplateHeaderHandle,
  hasOpen24hWindow,
  isRetryableWhatsappError,
  isWhatsappConfigured,
  jitterDelay,
  listMessageTemplates,
  sendViaProvider,
  WhatsappDeliveryError,
  whatsappErrorMessage,
  type MetaMessageTemplate,
  type WhatsappTemplateComponent,
  type WhatsappTemplatePayload,
} from "@/lib/whatsapp";

const TEMPLATE_LANGUAGES = ["es", "es_ES", "en_US", "en"] as const;
const META_STATUS = ["pending", "approved", "rejected"] as const;

// Meta WhatsApp template HEADERs support three media types in addition to
// plain TEXT. We persist the chosen type alongside the storage path so the
// sender knows which Cloud-API `parameters[].type` to use.
const HEADER_MEDIA_TYPES = ["DOCUMENT", "IMAGE", "VIDEO"] as const;
export type HeaderMediaType = (typeof HEADER_MEDIA_TYPES)[number];

const HeaderMediaSchema = z.object({
  type: z.enum(HEADER_MEDIA_TYPES),
  storagePath: z.string().trim().min(1),
  filename: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
});

const TemplateSchema = z.object({
  name: z.string().trim().min(1),
  category: z.enum(["recibo", "promocion", "evento", "inscripcion", "galeria"]),
  body: z.string().trim().min(1),
  metaTemplateName: z.string().trim().optional().default(""),
  language: z.enum(TEMPLATE_LANGUAGES).default("es"),
  metaStatus: z.enum(META_STATUS).default("pending"),
  componentsSchema: z
    .object({
      body: z
        .object({ variables: z.array(z.string()).optional() })
        .optional(),
      header: HeaderMediaSchema.optional().nullable(),
      raw: z.unknown().optional(),
    })
    .nullable()
    .optional(),
});

export type TemplateHeaderMedia = z.output<typeof HeaderMediaSchema>;

const WhatsappPhoneSchema = z
  .string()
  .trim()
  .transform((phone) => normalizeWhatsappNumber(phone))
  .pipe(z.string().regex(/^\d{8,15}$/, "Teléfono inválido"));

const ConversationMetaSchema = z.object({
  phone: WhatsappPhoneSchema,
  tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
  internalNote: z.string().trim().max(1000).optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  marketingOptOut: z.boolean().optional(),
});

const LeadFromConversationSchema = z.object({
  phone: WhatsappPhoneSchema,
  fullName: z.string().trim().min(1),
  childAge: z.coerce.number().min(1).max(18).default(6),
  interest: z.enum(["escuela", "campus"]).default("escuela"),
});

const BulkRecipientSchema = z.object({
  name: z.string().trim().min(1),
  phone: WhatsappPhoneSchema,
  variables: z.record(z.string(), z.string()).optional(),
});

const BulkPayloadSchema = z.object({
  templateId: z.string().uuid(),
  category: z.enum(["recibo", "promocion", "evento", "inscripcion", "galeria"]).default("promocion"),
  recipients: z.array(BulkRecipientSchema).min(1, "Añade al menos un destinatario"),
});

const ManualBatchSchema = z.object({
  category: z.enum(["recibo", "promocion", "evento", "inscripcion", "galeria"]).default("promocion"),
  templateId: z.string().uuid().nullable().optional(),
  templateName: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        phone: WhatsappPhoneSchema,
        body: z.string().trim().min(1),
      }),
    )
    .min(1, "No hay envíos que registrar"),
});

export type ManualBatchInput = z.input<typeof ManualBatchSchema>;
export type TemplateInput = z.output<typeof TemplateSchema>;
export type BulkPayloadInput = z.output<typeof BulkPayloadSchema>;
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

type DeliveryStatus = "sent" | "queued" | "failed";
type DeliveryOutcome = { status: DeliveryStatus; error?: string; kind?: string };
type WhatsappDeliveryRow = {
  id: string;
  recipient_phone: string;
  body_text?: string | null;
  payload: Record<string, unknown> | null;
  attempt_count?: number | null;
  max_attempts?: number | null;
  locked_by?: string | null;
  template_id?: string | null;
  template_language?: string | null;
  template_variables?: Record<string, unknown> | null;
  message_templates?:
    | { body: string; meta_template_name: string; language: string; components_schema: unknown | null }
    | { body: string; meta_template_name: string; language: string; components_schema: unknown | null }[]
    | null;
};

const PROMO_BLOCKED_ERROR =
  "Este contacto pidió no recibir promociones por WhatsApp. Puedes enviar mensajes de servicio, pero no campañas promocionales.";

function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof z.ZodError) {
    const first = error.issues[0]?.message ?? "Datos no válidos";
    return { ok: false, error: first };
  }
  logError("whatsapp_action_failed", error);
  if (error instanceof WhatsappDeliveryError) {
    const details = [
      error.code ? `code ${error.code}` : null,
      error.fbtraceId ? `fbtrace ${error.fbtraceId}` : null,
    ].filter(Boolean);
    return {
      ok: false,
      error: details.length > 0 ? `${error.message} (${details.join(", ")})` : error.message,
    };
  }
  if (error instanceof Error) return { ok: false, error: error.message };
  if (typeof error === "string") return { ok: false, error };
  if (error && typeof error === "object") {
    const obj = error as { message?: string; error?: string; details?: string; hint?: string; code?: string };
    const message = obj.message ?? obj.error ?? obj.details ?? obj.hint;
    if (message) {
      const code = obj.code ? ` (${obj.code})` : "";
      return { ok: false, error: `${message}${code}` };
    }
    try {
      return { ok: false, error: JSON.stringify(error).slice(0, 400) };
    } catch {
      /* circular */
    }
  }
  return { ok: false, error: "Error desconocido. Mira los logs del servidor para más detalle." };
}

function revalidateWhatsappViews(phone?: string) {
  revalidatePath("/admin/whatsapp");
  revalidatePath("/admin/whatsapp/chats");
  if (phone) revalidatePath(`/admin/whatsapp/chats/${phone}`);
}

function normalizeConversationTags(tags: unknown) {
  return Array.isArray(tags)
    ? tags
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean)
    : [];
}

function withConversationTag(tags: unknown, tag: string) {
  const next = new Set(normalizeConversationTags(tags));
  const normalizedTag = tag.trim().toLowerCase();
  if (normalizedTag) next.add(normalizedTag);
  return [...next];
}

function renderTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{(\d+|[a-zA-Z_]\w*)\}\}/g, (_, key) => variables[String(key)] ?? `{{${key}}}`);
}

function nextAttemptAt(attemptCount: number) {
  const delays = [30, 90, 180, 300, 600, 1200, 1800];
  const delaySeconds = delays[Math.min(Math.max(attemptCount - 1, 0), delays.length - 1)];
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

function retryAfterAt(error: unknown): string | null {
  if (!(error instanceof WhatsappDeliveryError) || !error.retryAfterSeconds) return null;
  return new Date(Date.now() + error.retryAfterSeconds * 1000).toISOString();
}

function errorCode(error: unknown): string | null {
  if (!(error instanceof WhatsappDeliveryError)) return null;
  return error.code ? String(error.code) : null;
}

function fbtraceId(error: unknown): string | null {
  if (!(error instanceof WhatsappDeliveryError)) return null;
  return error.fbtraceId ?? null;
}

function metaErrorPayload(error: unknown): Record<string, unknown> | null {
  if (!(error instanceof WhatsappDeliveryError)) return null;
  return {
    status: error.status ?? null,
    code: error.code ?? null,
    kind: error.kind,
    fbtraceId: error.fbtraceId ?? null,
    retryAfterSeconds: error.retryAfterSeconds ?? null,
    raw: error.raw ?? null,
  };
}

async function resolveTemplateDocumentUrl(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string | null> {
  // 7 días — el mensaje normalmente se entrega en segundos pero Meta puede
  // reintentar, así que dejamos un margen generoso. El bucket es privado.
  const { data, error } = await supabase.storage
    .from("whatsapp-media")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

type TemplateComponentsSchema = {
  body?: { variables?: string[] };
  header?: {
    type: HeaderMediaType;
    storagePath: string;
    filename: string;
    mimeType: string;
  } | null;
  raw?: unknown;
} | null;

type TemplateComponentsForSendResult =
  | { ok: true; components: WhatsappTemplateComponent[] }
  | { ok: false; error: string };

type TemplatePayloadForSendResult =
  | { ok: true; template: WhatsappTemplatePayload | null }
  | { ok: false; error: string };

/**
 * Returns the media HEADER type declared by Meta (`raw` = components from
 * sync). We only send a header parameter when Meta actually expects one;
 * otherwise Meta rejects with "Template does not contain title component".
 */
function metaTemplateMediaHeaderType(raw: unknown): HeaderMediaType | null {
  if (!Array.isArray(raw)) return null;
  for (const component of raw) {
    const c = component as { type?: unknown; format?: unknown };
    const format = String(c.format ?? "").toUpperCase();
    if (
      String(c.type ?? "").toUpperCase() === "HEADER" &&
      (format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT")
    ) {
      return format;
    }
  }
  return null;
}

function metaTemplateHasMediaHeader(raw: unknown, type?: HeaderMediaType): boolean {
  const headerType = metaTemplateMediaHeaderType(raw);
  return type ? headerType === type : headerType !== null;
}

/**
 * Builds the full Cloud-API `components[]` for a template send: the BODY
 * parameters from the variables plus, when the template carries a media
 * HEADER, the matching `image` / `video` / `document` header parameter with a
 * freshly signed URL. Every send path (single, bulk and queue retry) goes
 * through here so media templates never lose their attachment.
 *
 * Returns `null` when a declared header media file cannot be signed, so the
 * caller can fail loudly instead of silently sending a template with no media.
 */
async function buildTemplateComponentsForSend(
  supabase: SupabaseClient,
  variables: Record<string, string>,
  schema: TemplateComponentsSchema,
): Promise<TemplateComponentsForSendResult> {
  const components = buildTemplateComponents(variables, schema);
  const metaHeaderType = metaTemplateMediaHeaderType(schema?.raw);
  if (!schema?.header) {
    if (metaHeaderType) {
      return {
        ok: false,
        error: `Meta confirma que esta plantilla tiene cabecera ${metaHeaderType}, pero la web no tiene un archivo local para enviarla. Edita la plantilla, sube la imagen, vídeo o documento y guarda los cambios antes de usarla.`,
      };
    }
    return { ok: true, components };
  }
  // Skip the header parameter unless Meta's approved template declares a media
  // header. Avoids the "Template does not contain title component" rejection
  // for templates that were approved without a header (e.g. not yet re-synced).
  if (!metaTemplateHasMediaHeader(schema.raw, schema.header.type)) {
    return {
      ok: false,
      error: Array.isArray(schema.raw)
        ? `Meta tiene esta plantilla aprobada sin cabecera ${schema.header.type}. No se ha enviado para evitar que llegue sin archivo. Actualiza la plantilla en Meta con cabecera ${schema.header.type}, espera a que vuelva a estar aprobada y pulsa "Sincronizar Meta".`
        : `La plantilla tiene un archivo local, pero falta la sincronización de Meta que confirma la cabecera ${schema.header.type}. Pulsa "Sincronizar Meta" antes de enviarla.`,
    };
  }

  const header = schema.header;
  const headerUrl = await resolveTemplateDocumentUrl(supabase, header.storagePath);
  if (!headerUrl) {
    return {
      ok: false,
      error:
        "No se ha podido generar el enlace al archivo adjunto de la plantilla. Vuelve a subirlo desde la plantilla.",
    };
  }

  const headerParam =
    header.type === "IMAGE"
      ? { type: "image" as const, image: { link: headerUrl } }
      : header.type === "VIDEO"
        ? { type: "video" as const, video: { link: headerUrl } }
        : {
            type: "document" as const,
            document: { link: headerUrl, filename: header.filename },
          };
  components.unshift({ type: "header", parameters: [headerParam] });
  return { ok: true, components };
}

async function isMarketingBlocked(supabase: SupabaseClient, phone: string): Promise<boolean> {
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("marketing_opt_out")
    .eq("phone", phone)
    .maybeSingle();
  return Boolean(data?.marketing_opt_out);
}

async function touchConversation(
  supabase: SupabaseClient,
  input: {
    phone: string;
    displayName?: string | null;
    direction: "inbound" | "outbound";
    at?: string;
  },
) {
  const at = input.at ?? new Date().toISOString();
  await supabase.from("whatsapp_conversations").upsert(
    {
      phone: input.phone,
      display_name: input.displayName ?? `+${input.phone}`,
      last_message_at: at,
      last_inbound_at: input.direction === "inbound" ? at : undefined,
      last_outbound_at: input.direction === "outbound" ? at : undefined,
    },
    { onConflict: "phone" },
  );
}

function resolveMessageBody(message: WhatsappDeliveryRow): string | null {
  if (message.body_text?.trim()) return message.body_text;
  const payload = message.payload ?? {};
  if (typeof payload.body === "string" && payload.body.trim()) return payload.body;

  const template = Array.isArray(message.message_templates)
    ? message.message_templates[0]
    : message.message_templates;
  if (!template?.body) return null;

  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number") variables[key] = String(value);
  }
  return renderTemplate(template.body, variables);
}

async function templateFromRow(
  supabase: SupabaseClient,
  message: WhatsappDeliveryRow,
): Promise<TemplatePayloadForSendResult> {
  const template = Array.isArray(message.message_templates)
    ? message.message_templates[0]
    : message.message_templates;
  if (!template || !template.meta_template_name) return { ok: true, template: null };
  const language = message.template_language ?? template.language ?? "es";
  const variables: Record<string, string> = {};
  const raw = (message.template_variables ?? message.payload ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" || typeof value === "number") variables[key] = String(value);
  }
  const schema = template.components_schema as TemplateComponentsSchema;
  // Reconstruct the full components (incl. media header) on every retry so a
  // queued media template keeps its attachment. If Meta has not approved a
  // media HEADER, fail loudly instead of sending the text-only version.
  const result = await buildTemplateComponentsForSend(supabase, variables, schema);
  if (!result.ok) return result;
  return {
    ok: true,
    template: {
      name: template.meta_template_name,
      language,
      components: result.components,
    },
  };
}

async function deliverWhatsappMessage(
  supabase: SupabaseClient,
  message: WhatsappDeliveryRow,
  options: {
    body?: string;
    mediaUrl?: string;
    mediaCaption?: string;
    mediaFilename?: string;
    template?: WhatsappTemplatePayload | null;
    delayMs?: number;
  } = {},
): Promise<DeliveryOutcome> {
  const body = options.body ?? resolveMessageBody(message);
  const payload = message.payload ?? {};
  const mediaUrl = options.mediaUrl ?? (typeof payload.media_url === "string" ? payload.media_url : undefined);
  const mediaCaption = options.mediaCaption ?? (mediaUrl ? body ?? undefined : undefined);
  const mediaFilename =
    options.mediaFilename ??
    (typeof payload.mediaFilename === "string" ? payload.mediaFilename : undefined);
  const templateResult: TemplatePayloadForSendResult =
    options.template !== undefined
      ? { ok: true, template: options.template ?? null }
      : await templateFromRow(supabase, message);
  const attemptCount = (message.attempt_count ?? 0) + 1;
  const nowIso = new Date().toISOString();

  if (!templateResult.ok) {
    const { error } = await supabase
      .from("whatsapp_messages")
      .update({
        status: "failed",
        error_message: templateResult.error,
        attempt_count: attemptCount,
        last_attempt_at: nowIso,
        next_attempt_at: null,
        retry_after_at: null,
        locked_at: null,
        locked_by: null,
      })
      .eq("id", message.id);
    if (error) throw error;
    return { status: "failed", error: templateResult.error };
  }

  const template = templateResult.template;

  if (!body && !mediaUrl && !template) {
    const error = "Mensaje sin cuerpo, archivo ni plantilla";
    const { error: updateError } = await supabase
      .from("whatsapp_messages")
      .update({
        status: "failed",
        error_message: error,
        attempt_count: attemptCount,
        last_attempt_at: nowIso,
        next_attempt_at: null,
      })
      .eq("id", message.id);
    if (updateError) throw updateError;
    return { status: "failed", error };
  }

  try {
    const result = await sendViaProvider({
      to: message.recipient_phone,
      body: template || mediaUrl ? undefined : body ?? undefined,
      mediaUrl,
      mediaCaption,
      mediaFilename,
      template: template ?? undefined,
      delayMs: options.delayMs,
    });
    const { error: sentUpdateError } = await supabase
      .from("whatsapp_messages")
      .update({
        status: "sent",
        provider_message_id: result.id,
        sent_at: nowIso,
        error_message: null,
        error_code: null,
        fbtrace_id: null,
        meta_error: null,
        attempt_count: attemptCount,
        last_attempt_at: nowIso,
        next_attempt_at: null,
        retry_after_at: null,
        locked_at: null,
        locked_by: null,
      })
      .eq("id", message.id);
    if (sentUpdateError) throw sentUpdateError;
    await touchConversation(supabase, {
      phone: message.recipient_phone,
      direction: "outbound",
      at: nowIso,
    });
    return { status: "sent" };
  } catch (error) {
    const messageText = whatsappErrorMessage(error);
    const retryable = isRetryableWhatsappError(error);
    const kind = error instanceof WhatsappDeliveryError ? error.kind : "unknown";
    const maxAttempts = message.max_attempts ?? 7;
    const exhausted = retryable && attemptCount >= maxAttempts;
    const queuedError = retryable
      ? `${messageText}. Se reintentará automáticamente.`
      : messageText;
    const finalError = exhausted
      ? `${messageText}. Se agotaron ${maxAttempts} intentos y el mensaje pasó a dead letter.`
      : queuedError;

    const { error: failureUpdateError } = await supabase
      .from("whatsapp_messages")
      .update({
        status: retryable && !exhausted ? "queued" : "failed",
        error_message: finalError,
        error_code: errorCode(error),
        fbtrace_id: fbtraceId(error),
        meta_error: metaErrorPayload(error),
        attempt_count: attemptCount,
        last_attempt_at: nowIso,
        next_attempt_at: retryable && !exhausted ? nextAttemptAt(attemptCount) : null,
        retry_after_at: retryable && !exhausted ? retryAfterAt(error) : null,
        dead_letter_at: exhausted ? nowIso : null,
        locked_at: null,
        locked_by: null,
      })
      .eq("id", message.id);
    if (failureUpdateError) throw failureUpdateError;

    return { status: retryable && !exhausted ? "queued" : "failed", error: finalError, kind };
  }
}

// Combining diacritical marks (U+0300 → U+036F). Written with an explicit
// unicode escape so it survives copy-pastes and encoding changes — the
// previous `/[̀-ͯ]/g` literal relied on invisible characters.
const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(COMBINING_MARKS_RE, "");
}

function templateSlugFromName(name: string): string {
  // Meta requires `^[a-z0-9_]+$` and forbids leading underscore.
  return (
    stripDiacritics(name.toLowerCase())
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "plantilla"
  );
}

function withPreservedMetaRaw(
  next: TemplateInput["componentsSchema"],
  previous: unknown,
): TemplateInput["componentsSchema"] {
  if (!next) return next;
  if ("raw" in next && next.raw !== undefined) return next;
  const raw = (previous as { raw?: unknown } | null)?.raw;
  return raw === undefined ? next : { ...next, raw };
}

export async function createTemplateAction(input: TemplateInput): Promise<ActionResult> {
  try {
    const data = TemplateSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const componentsSchema = data.componentsSchema ?? null;
    const { data: row, error } = await supabase
      .from("message_templates")
      .insert({
        name: data.name,
        category: data.category,
        body: data.body,
        meta_template_name: data.metaTemplateName || templateSlugFromName(data.name),
        language: data.language,
        meta_status: data.metaStatus,
        components_schema: componentsSchema,
      })
      .select("id")
      .single();
    if (error) throw error;
    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_template_created",
      entityType: "message_template",
      entityId: row?.id ?? null,
      summary: `Plantilla WhatsApp creada: ${data.name}`,
      metadata: { name: data.name, category: data.category, language: data.language },
    });
    revalidatePath("/admin/whatsapp");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTemplateAction(
  templateId: string,
  input: TemplateInput,
): Promise<ActionResult> {
  try {
    const data = TemplateSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const { data: existing, error: existingError } = await supabase
      .from("message_templates")
      .select("components_schema")
      .eq("id", templateId)
      .maybeSingle();
    if (existingError) throw existingError;
    const componentsSchema = withPreservedMetaRaw(
      data.componentsSchema ?? null,
      existing?.components_schema ?? null,
    );
    const { error } = await supabase
      .from("message_templates")
      .update({
        name: data.name,
        category: data.category,
        body: data.body,
        meta_template_name: data.metaTemplateName || templateSlugFromName(data.name),
        language: data.language,
        meta_status: data.metaStatus,
        components_schema: componentsSchema,
      })
      .eq("id", templateId);
    if (error) throw error;
    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_template_updated",
      entityType: "message_template",
      entityId: templateId,
      summary: `Plantilla WhatsApp actualizada: ${data.name}`,
      metadata: { name: data.name, category: data.category, language: data.language, metaStatus: data.metaStatus },
    });
    revalidatePath("/admin/whatsapp");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Asocia (o quita) SOLO el archivo de cabecera de una plantilla, sin tocar
 * nombre, cuerpo, categoría, estado ni la plantilla en Meta. Evita el problema
 * de que editar la plantilla aprobada para subir la imagen reescriba campos o
 * desemparente la cabecera al sincronizar.
 */
export async function setTemplateHeaderAction(
  templateId: string,
  header: TemplateHeaderMedia | null,
): Promise<ActionResult> {
  try {
    const parsed = header ? HeaderMediaSchema.parse(header) : null;
    const { supabase, profile } = await requireAdmin();
    const { data: existing, error: readError } = await supabase
      .from("message_templates")
      .select("components_schema, name")
      .eq("id", templateId)
      .maybeSingle();
    if (readError) throw readError;
    const schema = (existing?.components_schema as Record<string, unknown> | null) ?? {};
    const nextSchema = { ...schema, header: parsed };
    const { error } = await supabase
      .from("message_templates")
      .update({ components_schema: nextSchema })
      .eq("id", templateId);
    if (error) throw error;
    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_template_media_set",
      entityType: "message_template",
      entityId: templateId,
      summary: parsed
        ? `Archivo de cabecera asociado a la plantilla ${existing?.name ?? ""}`.trim()
        : `Archivo de cabecera retirado de la plantilla ${existing?.name ?? ""}`.trim(),
      metadata: { type: parsed?.type ?? null },
    });
    revalidatePath("/admin/whatsapp");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTemplateAction(templateId: string): Promise<ActionResult> {
  try {
    const { supabase, profile } = await requireAdmin();
    const { data: template } = await supabase
      .from("message_templates")
      .select("name, meta_template_name")
      .eq("id", templateId)
      .maybeSingle();
    const { error } = await supabase.from("message_templates").delete().eq("id", templateId);
    if (error) throw error;
    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_template_deleted",
      entityType: "message_template",
      entityId: templateId,
      summary: `Plantilla WhatsApp eliminada: ${template?.name ?? templateId}`,
      metadata: { name: template?.name ?? null, metaTemplateName: template?.meta_template_name ?? null },
    });
    revalidatePath("/admin/whatsapp");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

function localCategoryFromMeta(category: string | null | undefined): TemplateInput["category"] {
  const normalized = (category ?? "").toUpperCase();
  if (normalized === "MARKETING") return "promocion";
  if (normalized === "AUTHENTICATION") return "inscripcion";
  return "evento";
}

function metaCategoryFromLocal(category: TemplateInput["category"]): "MARKETING" | "UTILITY" | "AUTHENTICATION" {
  if (category === "promocion") return "MARKETING";
  return "UTILITY";
}

function edgeVariableError(body: string): string | null {
  const trimmed = body.trim();
  const variable = "\\{\\{\\s*(\\d+|[a-zA-Z_]\\w*)\\s*\\}\\}";

  // ── Regla 1: Meta rechaza variables al PRINCIPIO del body. ─────────────
  if (new RegExp(`^${variable}`).test(trimmed)) {
    return "Meta no permite variables al principio de la plantilla (error code 100). Añade texto antes de la primera variable, por ejemplo: 'Hola {{1}}'.";
  }

  // ── Regla 2: Meta rechaza variables al FINAL del body, aunque haya ────
  // signos de puntuación detrás. Solo cuenta como "no final" si hay texto
  // (letras o dígitos) después de la última variable. Esto incluye saltos de
  // línea: si la última línea acaba en variable + signos, Meta también lo
  // rechaza.
  const trailingPunctuation = "[\\s.!?¡¿:;,'\"”’\\)\\(\\-—–]*";
  if (new RegExp(`${variable}${trailingPunctuation}$`).test(trimmed)) {
    const lastMatch = [...trimmed.matchAll(new RegExp(variable, "g"))].pop();
    const key = lastMatch?.[1] ?? "X";
    return `Meta no permite variables al final de la plantilla (error code 100). La variable {{${key}}} queda al final solo con signos de puntuación detrás. Añade texto real después, por ejemplo: '...reservar la plaza de {{${key}}}, ¡contesta y te llamamos!'.`;
  }

  // ── Regla 3: El body no puede ser solo variables. ─────────────────────
  const variableRe = new RegExp(variable, "g");
  const stripped = trimmed.replace(variableRe, "").replace(/\s+/g, "").trim();
  if (!stripped) {
    return "La plantilla no puede contener solo variables. Añade al menos una frase fija.";
  }

  // ── Regla 4: Variables huérfanas entre signos de puntuación. ──────────
  // Meta rechaza por "INVALID_FORMAT" si el revisor humano no puede entender
  // qué representa la variable por el contexto.
  const isolated = /(?:^|[.!?¡¿\n])\s*\{\{\s*(\d+|[a-zA-Z_]\w*)\s*\}\}\s*(?:$|[.!?\n])/;
  const isolatedMatch = isolated.exec(trimmed);
  if (isolatedMatch) {
    return `La variable {{${isolatedMatch[1]}}} está aislada entre signos de puntuación sin texto que la describa. Añade palabras alrededor (ej. "el alumno {{${isolatedMatch[1]}}}") para que Meta entienda qué representa.`;
  }

  return null;
}

function componentsSchemaFromMeta(template: MetaMessageTemplate): { body?: { variables?: string[] }; raw?: unknown } {
  const variables = new Set<string>();
  const regex = /\{\{(\d+|[a-zA-Z_]\w*)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template.body))) variables.add(match[1]);
  return {
    body: variables.size > 0 ? { variables: Array.from(variables) } : undefined,
    raw: template.components,
  };
}

export async function syncTemplatesFromMetaAction(): Promise<ActionResult<{ synced: number }>> {
  try {
    if (!isWhatsappConfigured()) return { ok: false, error: "Meta WhatsApp no configurado" };
    const { supabase, profile } = await requireAdmin();
    const templates = await listMessageTemplates();
    const nowIso = new Date().toISOString();

    // Meta never returns our locally-uploaded header media (it lives in our
    // private bucket, referenced by storage path). Without this the upsert
    // below would wipe the media config on every sync. Preload existing
    // headers so we can carry them over.
    const { data: existing } = await supabase
      .from("message_templates")
      .select("meta_template_name, language, components_schema");
    const existingHeaderByName = new Map<string, unknown>();
    for (const row of existing ?? []) {
      const header = (row.components_schema as { header?: unknown } | null)?.header;
      if (header && row.meta_template_name) {
        existingHeaderByName.set(`${row.meta_template_name}:${row.language ?? ""}`, header);
      }
    }

    const rows = templates.map((template) => {
      const schema = componentsSchemaFromMeta(template);
      const header = existingHeaderByName.get(`${template.name}:${template.language}`);
      return {
        name: template.name,
        category: localCategoryFromMeta(template.category),
        body: template.body || `Plantilla ${template.name}`,
        meta_template_name: template.name,
        language: template.language,
        meta_status: template.status,
        meta_template_id: template.id,
        meta_review_status: template.rawStatus,
        meta_rejection_reason: template.rejectionReason,
        meta_quality_score: template.qualityScore,
        meta_synced_at: nowIso,
        components_schema: header ? { ...schema, header } : schema,
      };
    });

    if (rows.length > 0) {
      const { error } = await supabase
        .from("message_templates")
        .upsert(rows, { onConflict: "meta_template_name" });
      if (error) throw error;
    }

    const available = new Set(templates.map((template) => `${template.name}:${template.language}`));
    const { data: localApproved, error: localError } = await supabase
      .from("message_templates")
      .select("id, meta_template_name, language, meta_status")
      .eq("meta_status", "approved");
    if (localError) throw localError;

    const missingIds = (localApproved ?? [])
      .filter((template) => !available.has(`${template.meta_template_name}:${template.language}`))
      .map((template) => template.id);
    if (missingIds.length > 0) {
      const { error: staleError } = await supabase
        .from("message_templates")
        .update({
          meta_status: "pending",
          meta_review_status: "NOT_FOUND_IN_META",
          meta_rejection_reason:
            "Meta no devuelve esta plantilla con ese idioma. Pulsa Sincronizar Meta o envíala a Meta antes de usarla.",
          meta_template_id: null,
          meta_synced_at: nowIso,
        })
        .in("id", missingIds);
      if (staleError) throw staleError;
    }

    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_templates_synced",
      entityType: "message_template",
      summary: `Plantillas sincronizadas con Meta: ${rows.length}`,
      metadata: { synced: rows.length, stale: missingIds.length },
    });
    revalidatePath("/admin/whatsapp");
    return { ok: true, data: { synced: rows.length } };
  } catch (error) {
    return fail(error);
  }
}

export async function submitTemplateToMetaAction(
  templateId: string,
): Promise<ActionResult<{ metaTemplateId: string; rawStatus: string }>> {
  try {
    const parsed = z.string().uuid().parse(templateId);
    if (!isWhatsappConfigured()) return { ok: false, error: "Meta WhatsApp no configurado" };
    const { supabase, profile } = await requireAdmin();
    const { data: template, error } = await supabase
      .from("message_templates")
      .select("id, name, category, body, meta_template_name, language, meta_template_id, components_schema")
      .eq("id", parsed)
      .single();
    if (error) throw error;

    const edgeError = edgeVariableError(template.body);
    if (edgeError) return { ok: false, error: edgeError };

    const metaName = template.meta_template_name || templateSlugFromName(template.name);

    // If the template carries a media header, upload a representative sample to
    // Meta to obtain the header_handle. Meta needs this to declare the HEADER
    // component; the real file is sent per-message at send time.
    const schema = template.components_schema as TemplateComponentsSchema;
    let header: { format: HeaderMediaType; handle: string } | undefined;
    if (schema?.header) {
      const { data: file, error: downloadError } = await supabase.storage
        .from("whatsapp-media")
        .download(schema.header.storagePath);
      if (downloadError || !file) {
        return {
          ok: false,
          error:
            "No se ha podido leer el archivo de cabecera para enviarlo a Meta. Vuelve a subirlo desde la plantilla.",
        };
      }
      const handle = await uploadTemplateHeaderHandle({
        bytes: await file.arrayBuffer(),
        filename: schema.header.filename,
        mimeType: schema.header.mimeType,
      });
      header = { format: schema.header.type, handle };
    }

    // A template already in Meta (has an id) is EDITED to add/update the
    // header; one that doesn't exist yet is CREATED. Editing avoids the
    // "duplicate name+language" error and is the only way to add a media
    // header to a template that was first approved as text-only.
    const created = template.meta_template_id
      ? await editMessageTemplate({
          metaTemplateId: template.meta_template_id,
          body: template.body,
          header,
        })
      : await createMessageTemplate({
          name: metaName,
          language: template.language ?? "es",
          category: metaCategoryFromLocal(template.category as TemplateInput["category"]),
          body: template.body,
          header,
        });

    // Defensive: even though createMessageTemplate now throws on missing id,
    // re-check here so the action contract is explicit.
    if (!created.id) {
      return {
        ok: false,
        error:
          "Meta no confirmó la creación de la plantilla. Revisa META_WABA_ID, los permisos del token y que la plantilla no exista ya con ese nombre + idioma.",
      };
    }

    const { error: updateError } = await supabase
      .from("message_templates")
      .update({
        meta_template_id: created.id,
        meta_template_name: metaName,
        meta_status: created.status,
        meta_review_status: created.rawStatus,
        meta_rejection_reason: created.rejectionReason,
        meta_quality_score: created.qualityScore,
        meta_synced_at: new Date().toISOString(),
        // Preserve the locally-uploaded header (its storagePath is what we send
        // at message time); Meta never returns it, so merge it back in.
        components_schema: schema?.header
          ? { ...componentsSchemaFromMeta(created), header: schema.header }
          : componentsSchemaFromMeta(created),
      })
      .eq("id", template.id);
    if (updateError) throw updateError;

    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_template_submitted",
      entityType: "message_template",
      entityId: template.id,
      summary: `Plantilla enviada a Meta: ${template.name}`,
      metadata: {
        name: template.name,
        metaTemplateName: metaName,
        metaTemplateId: created.id,
        rawStatus: created.rawStatus,
      },
    });
    revalidatePath("/admin/whatsapp");
    return {
      ok: true,
      data: { metaTemplateId: created.id, rawStatus: created.rawStatus },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function retryWhatsappMessage(
  messageId: string,
): Promise<ActionResult<{ status: DeliveryStatus }>> {
  try {
    if (!isWhatsappConfigured()) {
      return { ok: false, error: "Meta WhatsApp no configurado" };
    }
    const { supabase } = await requireAdmin();
    const { data: message, error: messageError } = await supabase
      .from("whatsapp_messages")
      .select(
        "id, recipient_phone, body_text, payload, attempt_count, max_attempts, template_id, template_language, template_variables, message_templates(body, meta_template_name, language, components_schema)",
      )
      .eq("id", messageId)
      .single();
    if (messageError) throw messageError;

    const { error: reviveError } = await supabase
      .from("whatsapp_messages")
      .update({
        status: "queued",
        attempt_count: 0,
        next_attempt_at: null,
        retry_after_at: null,
        dead_letter_at: null,
        locked_at: null,
        locked_by: null,
        error_message: null,
      })
      .eq("id", messageId);
    if (reviveError) throw reviveError;

    const outcome = await deliverWhatsappMessage(
      supabase,
      {
        ...(message as WhatsappDeliveryRow),
        attempt_count: 0,
      },
      {
        delayMs: jitterDelay(),
      },
    );
    revalidatePath("/admin/whatsapp");
    revalidatePath("/admin/whatsapp/chats");
    if (outcome.status === "failed") return { ok: false, error: outcome.error ?? "No se ha podido enviar" };
    return { ok: true, data: { status: outcome.status } };
  } catch (error) {
    return fail(error);
  }
}

export async function sendBulkWhatsapp(
  input: BulkPayloadInput,
): Promise<ActionResult<{ sent: number; queued: number; failed: number }>> {
  try {
    const data = BulkPayloadSchema.parse(input);
    if (!isWhatsappConfigured()) {
      return {
        ok: false,
        error: "Meta WhatsApp no configurado. Define META_WHATSAPP_ACCESS_TOKEN y META_PHONE_NUMBER_ID en .env.local.",
      };
    }
    const { supabase, profile } = await requireAdmin();

    const { data: template, error: templateError } = await supabase
      .from("message_templates")
      .select("id, meta_template_name, category, body, language, meta_status, components_schema")
      .eq("id", data.templateId)
      .single();
    if (templateError) throw templateError;
    if (template.meta_status !== "approved") {
      return {
        ok: false,
        error: "La plantilla no está aprobada por Meta. Cámbiala a 'approved' tras la aprobación.",
      };
    }

    const recipients = data.recipients
      .map((recipient) => {
        const phone = normalizeWhatsappNumber(recipient.phone);
        if (!phone) return null;
        return { ...recipient, phone };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (recipients.length === 0) {
      return { ok: false, error: "No hay destinatarios con teléfono válido" };
    }

    let sent = 0;
    let queued = 0;
    let failed = 0;

    for (const recipient of recipients) {
      if (data.category === "promocion" && (await isMarketingBlocked(supabase, recipient.phone))) {
        const variables = recipient.variables ?? {};
        const previewBody = renderTemplate(template.body, variables);
        await supabase.from("whatsapp_messages").insert({
          direction: "outbound",
          recipient_name: recipient.name,
          recipient_phone: recipient.phone,
          template_id: template.id,
          template_name: template.meta_template_name || template.id,
          template_language: template.language,
          template_variables: variables,
          status: "failed" as const,
          related_type: data.category,
          body_text: previewBody,
          payload: { ...variables, body: previewBody, blockedByOptOut: true },
          error_message: PROMO_BLOCKED_ERROR,
        });
        failed++;
        continue;
      }

      const variables = recipient.variables ?? {};
      const componentsResult = await buildTemplateComponentsForSend(
        supabase,
        variables,
        template.components_schema as TemplateComponentsSchema,
      );
      if (!componentsResult.ok) {
        await supabase.from("whatsapp_messages").insert({
          direction: "outbound",
          recipient_name: recipient.name,
          recipient_phone: recipient.phone,
          template_id: template.id,
          template_name: template.meta_template_name || template.id,
          template_language: template.language,
          template_variables: variables,
          status: "failed" as const,
          related_type: data.category,
          body_text: renderTemplate(template.body, variables),
          payload: { ...variables },
          error_message: componentsResult.error,
        });
        failed++;
        continue;
      }
      const previewBody = renderTemplate(template.body, variables);

      const { data: row, error: insertError } = await supabase
        .from("whatsapp_messages")
        .insert({
          direction: "outbound",
          recipient_name: recipient.name,
          recipient_phone: recipient.phone,
          template_id: template.id,
          template_name: template.meta_template_name || template.id,
          template_language: template.language,
          template_variables: variables,
          status: "queued" as const,
          related_type: data.category,
          body_text: previewBody,
          payload: { ...variables, body: previewBody },
        })
        .select("id, recipient_phone, payload, attempt_count, max_attempts")
        .single();

      if (insertError || !row) {
        failed++;
        continue;
      }

      const outcome = await deliverWhatsappMessage(supabase, row as WhatsappDeliveryRow, {
        template: {
          name: template.meta_template_name,
          language: template.language,
          components: componentsResult.components,
        },
        delayMs: jitterDelay(1200, 2500),
      });
      if (outcome.status === "sent") sent++;
      else if (outcome.status === "queued") queued++;
      else failed++;
    }

    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_bulk_sent",
      entityType: data.category,
      entityId: template.id,
      summary: `Envío WhatsApp masivo: ${recipients.length} destinatarios`,
      metadata: {
        templateId: template.id,
        templateName: template.meta_template_name,
        recipients: recipients.length,
        sent,
        queued,
        failed,
      },
    });
    revalidatePath("/admin/whatsapp");
    return { ok: true, data: { sent, queued, failed } };
  } catch (error) {
    return fail(error);
  }
}

export async function recordManualBatch(input: ManualBatchInput): Promise<ActionResult<{ saved: number }>> {
  try {
    const data = ManualBatchSchema.parse(input);
    const { supabase, profile } = await requireAdmin();

    const nowIso = new Date().toISOString();
    const rows = data.items
      .map((item) => {
        const phone = normalizeWhatsappNumber(item.phone);
        if (!phone) return null;
        return {
          recipient_name: item.name,
          recipient_phone: phone,
          template_id: data.templateId ?? null,
          template_name: data.templateName || "manual_envio",
          status: "sent" as const,
          related_type: data.category,
          provider_message_id: "manual",
          body_text: item.body,
          payload: { manual: true, body: item.body },
          sent_at: nowIso,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) return { ok: false, error: "No hay envíos con teléfono válido" };
    const { error } = await supabase.from("whatsapp_messages").insert(rows);
    if (error) throw error;
    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_manual_batch_recorded",
      entityType: data.category,
      entityId: data.templateId ?? null,
      summary: `Lote WhatsApp manual registrado: ${rows.length} mensajes`,
      metadata: { saved: rows.length, templateName: data.templateName ?? null },
    });
    revalidatePath("/admin/whatsapp");
    return { ok: true, data: { saved: rows.length } };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteWhatsappMessage(messageId: string): Promise<ActionResult> {
  try {
    const parsed = z.string().uuid().safeParse(messageId);
    if (!parsed.success) return { ok: false, error: "ID de mensaje no válido" };
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("whatsapp_messages").delete().eq("id", parsed.data);
    if (error) throw error;
    revalidateWhatsappViews();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

const DeleteConversationSchema = z.object({
  phone: WhatsappPhoneSchema,
});

const BulkDeleteConversationsSchema = z
  .object({
    phones: z
      .array(WhatsappPhoneSchema)
      .min(1, "Selecciona al menos una conversación")
      .max(50, "Máximo 50 conversaciones por operación"),
  })
  .transform((data) => ({ phones: Array.from(new Set(data.phones)) }));

export async function deleteWhatsappConversation(
  input: z.input<typeof DeleteConversationSchema>,
): Promise<ActionResult<{ deleted: number; phone: string }>> {
  try {
    const data = DeleteConversationSchema.parse(input);
    const { supabase } = await requireAdmin();

    const { error, count } = await supabase
      .from("whatsapp_messages")
      .delete({ count: "exact" })
      .eq("recipient_phone", data.phone);
    if (error) throw error;

    revalidateWhatsappViews(data.phone);
    return { ok: true, data: { deleted: count ?? 0, phone: data.phone } };
  } catch (error) {
    return fail(error);
  }
}

export async function bulkDeleteWhatsappConversations(
  input: z.input<typeof BulkDeleteConversationsSchema>,
): Promise<ActionResult<{ deleted: number; conversations: number }>> {
  try {
    const data = BulkDeleteConversationsSchema.parse(input);
    const { supabase } = await requireAdmin();

    const { error, count } = await supabase
      .from("whatsapp_messages")
      .delete({ count: "exact" })
      .in("recipient_phone", data.phones);
    if (error) throw error;

    revalidateWhatsappViews();
    for (const phone of data.phones) revalidatePath(`/admin/whatsapp/chats/${phone}`);
    return { ok: true, data: { deleted: count ?? 0, conversations: data.phones.length } };
  } catch (error) {
    return fail(error);
  }
}

const BulkDeleteSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, "Selecciona al menos un mensaje")
    .max(500, "Máximo 500 mensajes por operación"),
  restrictToStatus: z
    .array(z.enum(["queued", "sent", "failed", "delivered", "read"]))
    .optional(),
});

export async function bulkDeleteMessages(
  input: z.input<typeof BulkDeleteSchema>,
): Promise<ActionResult<{ deleted: number }>> {
  try {
    const data = BulkDeleteSchema.parse(input);
    const { supabase } = await requireAdmin();

    let query = supabase.from("whatsapp_messages").delete({ count: "exact" }).in("id", data.ids);
    if (data.restrictToStatus && data.restrictToStatus.length > 0) {
      query = query.in("status", data.restrictToStatus);
    }

    const { error, count } = await query;
    if (error) throw error;
    revalidateWhatsappViews();
    return { ok: true, data: { deleted: count ?? 0 } };
  } catch (error) {
    return fail(error);
  }
}

const PurgeSchema = z.object({
  status: z.enum(["queued", "failed"]),
  relatedType: z.enum(["recibo", "promocion", "evento", "inscripcion", "galeria"]).optional(),
});

const MarkConversationSchema = z.object({
  phone: WhatsappPhoneSchema,
});

const DirectMessageSchema = z.object({
  phone: WhatsappPhoneSchema,
  body: z.string().trim().min(1, "El mensaje no puede estar vacío").max(4000, "Demasiado largo"),
  recipientName: z.string().trim().optional(),
});

export async function sendDirectMessage(
  input: z.input<typeof DirectMessageSchema>,
): Promise<
  ActionResult<{ id: string; status: "sent" | "queued"; notice?: string }> & {
    requiresTemplate?: boolean;
  }
> {
  try {
    const data = DirectMessageSchema.parse(input);
    if (!isWhatsappConfigured()) {
      return { ok: false, error: "Meta WhatsApp no configurado" };
    }
    const { supabase, profile } = await requireAdmin();

    // Meta sólo permite texto libre dentro de la ventana de 24h tras el último
    // inbound. Verificación server-side antes de gastar nada.
    const windowOpen = await hasOpen24hWindow(supabase, data.phone);
    if (!windowOpen) {
      return {
        ok: false,
        error:
          "La ventana de 24h con este contacto está cerrada. Tienes que iniciar la conversación con una plantilla aprobada.",
        requiresTemplate: true,
      };
    }

    const { data: row, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        direction: "outbound",
        recipient_name: data.recipientName ?? `+${data.phone}`,
        recipient_phone: data.phone,
        template_id: null,
        template_name: "chat_directo",
        status: "queued",
        related_type: "promocion",
        body_text: data.body,
        payload: { direct: true, body: data.body },
      })
      .select("id, recipient_phone, body_text, payload, attempt_count, max_attempts")
      .single();
    if (insertError || !row) throw insertError ?? new Error("No se pudo registrar el mensaje");

    const outcome = await deliverWhatsappMessage(supabase, row as WhatsappDeliveryRow, {
      body: data.body,
    });
    revalidatePath(`/admin/whatsapp/chats/${data.phone}`);
    revalidatePath("/admin/whatsapp/chats");
    revalidatePath("/admin/whatsapp");

    if (outcome.status === "failed") {
      const requiresTemplate = outcome.kind === "outside_window";
      return {
        ok: false,
        error: outcome.error ?? "No se ha podido enviar",
        requiresTemplate,
      };
    }
    if (outcome.status === "queued") {
      await recordAdminActivity(supabase, {
        actorId: profile.id,
        eventType: "whatsapp_direct_message_sent",
        entityType: "whatsapp_message",
        entityId: row.id,
        summary: `Mensaje directo WhatsApp encolado a +${data.phone}`,
        metadata: { phone: data.phone, status: "queued" },
      });
      return {
        ok: true,
        data: {
          id: row.id,
          status: "queued",
          notice: "Meta tuvo un problema temporal. El mensaje quedó en cola y se reintentará solo.",
        },
      };
    }
    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_direct_message_sent",
      entityType: "whatsapp_message",
      entityId: row.id,
      summary: `Mensaje directo WhatsApp enviado a +${data.phone}`,
      metadata: { phone: data.phone, status: "sent" },
    });
    return { ok: true, data: { id: row.id, status: "sent" } };
  } catch (error) {
    return fail(error);
  }
}

// ── Envío de documentos/archivos dentro de la ventana de 24h ──────────────
//
// Para soportar archivos grandes sin chocar con el límite de body de las server
// actions, el navegador sube el archivo directamente al bucket privado
// `whatsapp-media` usando una signed upload URL emitida por
// `createWhatsappDocumentUploadUrl`. Después `sendWhatsappDocumentMessage`
// registra el mensaje y lo entrega (el dispatcher descarga el archivo desde una
// URL firmada y lo sube a Meta).

const SENDABLE_MEDIA_MIME = new Set<string>([
  // Documentos que WhatsApp Cloud API entrega
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  // Imágenes
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function sendableMessageType(mimeType: string): "image" | "video" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function maxBytesForMime(mimeType: string): number {
  if (mimeType.startsWith("image/")) return 5 * 1024 * 1024;
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return 16 * 1024 * 1024;
  return 100 * 1024 * 1024;
}

function safeMediaName(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "archivo";
}

const WhatsappDocumentUploadSchema = z.object({
  phone: WhatsappPhoneSchema,
  filename: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(1),
});

/**
 * Emite una signed upload URL para que el navegador suba el archivo directamente
 * al bucket privado `whatsapp-media`. Comprueba la ventana de 24h antes para no
 * subir nada si no se va a poder enviar.
 */
export async function createWhatsappDocumentUploadUrl(
  input: z.input<typeof WhatsappDocumentUploadSchema>,
): Promise<
  ActionResult<{ storagePath: string; token: string }> & { requiresTemplate?: boolean }
> {
  try {
    const data = WhatsappDocumentUploadSchema.parse(input);
    if (!SENDABLE_MEDIA_MIME.has(data.mimeType)) {
      return { ok: false, error: "Tipo de archivo no admitido por WhatsApp." };
    }
    const { supabase } = await requireAdmin();

    const windowOpen = await hasOpen24hWindow(supabase, data.phone);
    if (!windowOpen) {
      return {
        ok: false,
        error:
          "La ventana de 24h con este contacto está cerrada. Tienes que iniciar la conversación con una plantilla aprobada.",
        requiresTemplate: true,
      };
    }

    const storagePath = `outbound/${data.phone}/${crypto.randomUUID()}-${safeMediaName(data.filename)}`;
    const { data: signed, error } = await supabase.storage
      .from("whatsapp-media")
      .createSignedUploadUrl(storagePath);
    if (error || !signed) {
      return { ok: false, error: "No se pudo preparar la subida del archivo." };
    }
    return { ok: true, data: { storagePath: signed.path, token: signed.token } };
  } catch (error) {
    return fail(error);
  }
}

const SendWhatsappDocumentSchema = z.object({
  phone: WhatsappPhoneSchema,
  storagePath: z.string().trim().min(1),
  filename: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(1),
  size: z.coerce.number().int().nonnegative().optional(),
  caption: z.string().trim().max(1024).optional(),
  recipientName: z.string().trim().optional(),
});

/**
 * Registra y entrega un mensaje con un archivo ya subido a `whatsapp-media`.
 * El archivo se referencia por su `storagePath`; el dispatcher genera una URL
 * firmada y lo sube a Meta como documento/imagen/etc.
 */
export async function sendWhatsappDocumentMessage(
  input: z.input<typeof SendWhatsappDocumentSchema>,
): Promise<
  ActionResult<{ id: string; status: "sent" | "queued"; notice?: string }> & {
    requiresTemplate?: boolean;
  }
> {
  try {
    const data = SendWhatsappDocumentSchema.parse(input);
    if (!isWhatsappConfigured()) {
      return { ok: false, error: "Meta WhatsApp no configurado" };
    }
    if (!SENDABLE_MEDIA_MIME.has(data.mimeType)) {
      return { ok: false, error: "Tipo de archivo no admitido por WhatsApp." };
    }
    // El archivo debe haberse subido a outbound/{phone}/… con la signed URL.
    if (!data.storagePath.startsWith(`outbound/${data.phone}/`)) {
      return { ok: false, error: "Ruta de archivo no válida." };
    }
    if (data.size && data.size > maxBytesForMime(data.mimeType)) {
      return { ok: false, error: "El archivo es demasiado grande para WhatsApp." };
    }

    const { supabase, profile } = await requireAdmin();

    const windowOpen = await hasOpen24hWindow(supabase, data.phone);
    if (!windowOpen) {
      return {
        ok: false,
        error:
          "La ventana de 24h con este contacto está cerrada. Tienes que iniciar la conversación con una plantilla aprobada.",
        requiresTemplate: true,
      };
    }

    const mediaUrl = await resolveTemplateDocumentUrl(supabase, data.storagePath);
    if (!mediaUrl) {
      return { ok: false, error: "No se pudo generar el enlace al archivo subido." };
    }

    const messageType = sendableMessageType(data.mimeType);
    const caption = data.caption?.trim() || undefined;

    const { data: row, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        direction: "outbound",
        recipient_name: data.recipientName ?? `+${data.phone}`,
        recipient_phone: data.phone,
        template_id: null,
        template_name: "chat_directo",
        status: "queued",
        related_type: null,
        body_text: caption ?? null,
        payload: {
          direct: true,
          type: messageType,
          hasMedia: true,
          mediaMime: data.mimeType,
          mediaFilename: data.filename,
          mediaSize: data.size ?? null,
          mediaStoragePath: data.storagePath,
          media_url: mediaUrl,
          ...(caption ? { body: caption } : {}),
        },
      })
      .select("id, recipient_phone, body_text, payload, attempt_count, max_attempts")
      .single();
    if (insertError || !row) throw insertError ?? new Error("No se pudo registrar el mensaje");

    const outcome = await deliverWhatsappMessage(supabase, row as WhatsappDeliveryRow, {
      mediaUrl,
      mediaCaption: caption,
      mediaFilename: data.filename,
    });
    revalidatePath(`/admin/whatsapp/chats/${data.phone}`);
    revalidatePath("/admin/whatsapp/chats");
    revalidatePath("/admin/whatsapp");

    if (outcome.status === "failed") {
      return {
        ok: false,
        error: outcome.error ?? "No se ha podido enviar el archivo",
        requiresTemplate: outcome.kind === "outside_window",
      };
    }

    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_direct_message_sent",
      entityType: "whatsapp_message",
      entityId: row.id,
      summary: `Documento WhatsApp ${
        outcome.status === "queued" ? "encolado" : "enviado"
      } a +${data.phone}`,
      metadata: { phone: data.phone, status: outcome.status, filename: data.filename },
    });

    if (outcome.status === "queued") {
      return {
        ok: true,
        data: {
          id: row.id,
          status: "queued",
          notice: "Meta tuvo un problema temporal. El archivo quedó en cola y se reintentará solo.",
        },
      };
    }
    return { ok: true, data: { id: row.id, status: "sent" } };
  } catch (error) {
    return fail(error);
  }
}

const SendTemplateSchema = z.object({
  phone: WhatsappPhoneSchema,
  templateId: z.string().uuid("Plantilla no válida"),
  variables: z.record(z.string(), z.string()).default({}),
  recipientName: z.string().trim().optional(),
});

export async function sendTemplateMessage(
  input: z.input<typeof SendTemplateSchema>,
): Promise<ActionResult<{ id: string; status: "sent" | "queued"; notice?: string }>> {
  try {
    const data = SendTemplateSchema.parse(input);
    if (!isWhatsappConfigured()) {
      return { ok: false, error: "Meta WhatsApp no configurado" };
    }
    const { supabase, profile } = await requireAdmin();

    const { data: template, error: templateError } = await supabase
      .from("message_templates")
      .select("id, meta_template_name, category, body, language, meta_status, components_schema")
      .eq("id", data.templateId)
      .single();
    if (templateError) throw templateError;
    if (template.meta_status !== "approved") {
      return { ok: false, error: "La plantilla no está aprobada por Meta" };
    }
    if (template.category === "promocion" && (await isMarketingBlocked(supabase, data.phone))) {
      return { ok: false, error: PROMO_BLOCKED_ERROR };
    }

    const variables = data.variables ?? {};
    const componentsResult = await buildTemplateComponentsForSend(
      supabase,
      variables,
      template.components_schema as TemplateComponentsSchema,
    );
    if (!componentsResult.ok) {
      return {
        ok: false,
        error: componentsResult.error,
      };
    }

    const previewBody = renderTemplate(template.body, variables);

    const { data: row, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        direction: "outbound",
        recipient_name: data.recipientName ?? `+${data.phone}`,
        recipient_phone: data.phone,
        template_id: template.id,
        template_name: template.meta_template_name || template.id,
        template_language: template.language,
        template_variables: variables,
        status: "queued",
        related_type: template.category,
        body_text: previewBody,
        payload: { ...variables, body: previewBody },
      })
      .select("id, recipient_phone, payload, attempt_count, max_attempts")
      .single();
    if (insertError || !row) throw insertError ?? new Error("No se pudo registrar el mensaje");

    const outcome = await deliverWhatsappMessage(supabase, row as WhatsappDeliveryRow, {
      template: {
        name: template.meta_template_name,
        language: template.language,
        components: componentsResult.components,
      },
    });
    revalidatePath(`/admin/whatsapp/chats/${data.phone}`);
    revalidatePath("/admin/whatsapp/chats");
    revalidatePath("/admin/whatsapp");

    if (outcome.status === "failed") {
      return { ok: false, error: outcome.error ?? "No se ha podido enviar" };
    }
    if (outcome.status === "queued") {
      await recordAdminActivity(supabase, {
        actorId: profile.id,
        eventType: "whatsapp_template_message_sent",
        entityType: "whatsapp_message",
        entityId: row.id,
        summary: `Plantilla WhatsApp encolada a +${data.phone}`,
        metadata: { phone: data.phone, templateId: template.id, status: "queued" },
      });
      return {
        ok: true,
        data: {
          id: row.id,
          status: "queued",
          notice: "Mensaje encolado para reintento automático.",
        },
      };
    }
    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_template_message_sent",
      entityType: "whatsapp_message",
      entityId: row.id,
      summary: `Plantilla WhatsApp enviada a +${data.phone}`,
      metadata: { phone: data.phone, templateId: template.id, status: "sent" },
    });
    return { ok: true, data: { id: row.id, status: "sent" } };
  } catch (error) {
    return fail(error);
  }
}

const QueueProcessSchema = z.object({
  phone: WhatsappPhoneSchema.optional(),
  limit: z.number().int().min(1).max(25).default(10),
});

export async function processWhatsappQueueWithClient(
  supabase: SupabaseClient,
  input: z.input<typeof QueueProcessSchema> = {},
): Promise<{ sent: number; queued: number; failed: number; skipped: number }> {
  const data = QueueProcessSchema.parse(input);
  if (!isWhatsappConfigured()) throw new Error("Meta WhatsApp no configurado");

  const worker = `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data: claimed, error: claimError } = await supabase.rpc("claim_whatsapp_queue", {
    p_limit: data.limit,
    p_worker: worker,
    p_phone: data.phone ?? null,
  });
  if (claimError) throw claimError;

  const claimedIds = ((claimed ?? []) as Array<{ id: string; recipient_phone: string }>)
    .map((row) => row.id);

  let due: WhatsappDeliveryRow[] = [];
  if (claimedIds.length > 0) {
    const { data: rows, error } = await supabase
      .from("whatsapp_messages")
      .select(
        "id, recipient_phone, body_text, payload, attempt_count, max_attempts, locked_by, next_attempt_at, template_id, template_language, template_variables, message_templates(body, meta_template_name, language, components_schema)",
      )
      .in("id", claimedIds)
      .eq("locked_by", worker);
    if (error) throw error;
    due = (rows ?? []) as WhatsappDeliveryRow[];
  }

  let sent = 0;
  let queued = 0;
  let failed = 0;

  for (const row of due) {
    const outcome = await deliverWhatsappMessage(supabase, row, { delayMs: jitterDelay(500, 1500) });
    if (outcome.status === "sent") sent++;
    else if (outcome.status === "queued") queued++;
    else failed++;
  }

  return {
    sent,
    queued,
    failed,
    skipped: Math.max(0, ((claimed ?? []) as unknown[]).length - due.length),
  };
}

export async function processWhatsappQueue(
  input: z.input<typeof QueueProcessSchema> = {},
): Promise<ActionResult<{ sent: number; queued: number; failed: number; skipped: number }>> {
  try {
    const data = QueueProcessSchema.parse(input);
    await requireAdmin();
    const result = await processWhatsappQueueWithClient(createServiceRoleClient(), data);

    if (data.phone) revalidatePath(`/admin/whatsapp/chats/${data.phone}`);
    revalidatePath("/admin/whatsapp/chats");
    revalidatePath("/admin/whatsapp");

    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

const MarkReadSchema = z.object({
  phone: WhatsappPhoneSchema,
});

export async function markConversationAsRead(
  input: z.input<typeof MarkReadSchema>,
): Promise<ActionResult<{ marked: number }>> {
  try {
    const data = MarkReadSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { error, count } = await supabase
      .from("whatsapp_messages")
      .update({ read_at: new Date().toISOString() }, { count: "exact" })
      .eq("recipient_phone", data.phone)
      .eq("direction", "inbound")
      .is("read_at", null);
    if (error) throw error;
    revalidatePath(`/admin/whatsapp/chats/${data.phone}`);
    revalidatePath("/admin/whatsapp/chats");
    return { ok: true, data: { marked: count ?? 0 } };
  } catch (error) {
    return fail(error);
  }
}

export async function markConversationAsDelivered(
  input: z.input<typeof MarkConversationSchema>,
): Promise<ActionResult<{ marked: number }>> {
  try {
    const data = MarkConversationSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { error, count } = await supabase
      .from("whatsapp_messages")
      .update({ status: "delivered", delivered_at: new Date().toISOString() }, { count: "exact" })
      .eq("recipient_phone", data.phone)
      .eq("status", "sent");
    if (error) throw error;
    revalidatePath(`/admin/whatsapp/chats/${data.phone}`);
    return { ok: true, data: { marked: count ?? 0 } };
  } catch (error) {
    return fail(error);
  }
}

export async function purgeWhatsappMessages(
  input: z.input<typeof PurgeSchema>,
): Promise<ActionResult<{ deleted: number }>> {
  try {
    const data = PurgeSchema.parse(input);
    const { supabase } = await requireAdmin();

    let query = supabase
      .from("whatsapp_messages")
      .delete({ count: "exact" })
      .eq("status", data.status);
    if (data.relatedType) query = query.eq("related_type", data.relatedType);

    const { error, count } = await query;
    if (error) throw error;
    revalidatePath("/admin/whatsapp");
    return { ok: true, data: { deleted: count ?? 0 } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateWhatsappConversationMeta(
  input: z.input<typeof ConversationMetaSchema>,
): Promise<ActionResult> {
  try {
    const data = ConversationMetaSchema.parse(input);
    const { supabase } = await requireAdmin();
    const updates: Record<string, unknown> = {};
    if (data.tags) updates.tags = Array.from(new Set(data.tags.map((tag) => tag.toLowerCase())));
    if (data.internalNote !== undefined) updates.internal_note = data.internalNote;
    if (data.assigneeId !== undefined) updates.assignee_id = data.assigneeId;
    if (data.marketingOptOut !== undefined) {
      updates.marketing_opt_out = data.marketingOptOut;
      updates.opted_out_at = data.marketingOptOut ? new Date().toISOString() : null;
      updates.opt_out_keyword = data.marketingOptOut ? "manual" : null;
    }
    const { error } = await supabase
      .from("whatsapp_conversations")
      .upsert({ phone: data.phone, ...updates }, { onConflict: "phone" });
    if (error) throw error;
    revalidateWhatsappViews(data.phone);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function createLeadFromWhatsappConversation(
  input: z.input<typeof LeadFromConversationSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const data = LeadFromConversationSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .in("phone", [data.phone, `+${data.phone}`])
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      await markConversationAsLead(supabase, data.phone);
      revalidateWhatsappViews(data.phone);
      return { ok: true, data: { id: existing.id } };
    }

    const { data: inserted, error } = await supabase
      .from("leads")
      .insert({
        full_name: data.fullName,
        phone: `+${data.phone}`,
        child_age: data.childAge,
        interest: data.interest,
        observations: "Creado desde una conversación de WhatsApp.",
        status: "contactado",
      })
      .select("id")
      .single();
    if (error) throw error;
    await markConversationAsLead(supabase, data.phone);
    revalidatePath("/admin/leads");
    revalidateWhatsappViews(data.phone);
    return { ok: true, data: { id: inserted.id } };
  } catch (error) {
    return fail(error);
  }
}

async function markConversationAsLead(supabase: SupabaseClient, phone: string) {
  const { data: conversation, error: readError } = await supabase
    .from("whatsapp_conversations")
    .select("tags")
    .eq("phone", phone)
    .maybeSingle();
  if (readError) throw readError;

  const { error } = await supabase
    .from("whatsapp_conversations")
    .upsert({ phone, tags: withConversationTag(conversation?.tags, "lead") }, { onConflict: "phone" });
  if (error) throw error;
}

/**
 * Deprecado: Meta Cloud API no expone histórico. La conversación se construye
 * desde ahora con los webhooks. Lo mantenemos como stub para no romper imports
 * que aún pudieran existir; la UI lo trata con un toast informativo.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function syncChatHistory(_input: {
  phone: string;
  limit?: number;
}): Promise<
  ActionResult<{
    fetched: number;
    inserted: number;
    notRegistered?: boolean;
    unknownChat?: boolean;
  }>
> {
  return {
    ok: false,
    error:
      "Meta Cloud API no expone histórico. La conversación se construye con los nuevos mensajes a partir de ahora.",
  };
}

/**
 * Sube un PDF (u otro documento permitido por Meta) al bucket privado
 * `whatsapp-media` para usarlo como cabecera (HEADER) de una plantilla.
 *
 * Devolvemos el `storagePath` para guardarlo en `components_schema.header`.
 * El URL público / firmado se genera bajo demanda al enviar.
 */
const TemplateMediaUploadSchema = z.object({
  filename: z.string().trim().min(1).max(120),
  mimeType: z.string().trim().min(1),
  base64: z.string().trim().min(8),
});

/**
 * Allowed MIME types per WhatsApp Cloud API template HEADER limits.
 * Source: Meta's "Send Template Messages" reference, table "Supported
 * media types and file sizes for templates".
 *
 *  - IMAGE      jpg, jpeg, png                 ≤ 5 MB
 *  - VIDEO      mp4, 3gpp                      ≤ 16 MB
 *  - DOCUMENT   pdf, doc(x), xls(x), ppt(x),
 *               txt                            ≤ 100 MB
 */
const TEMPLATE_MEDIA_RULES: Record<
  HeaderMediaType,
  { mimeTypes: Set<string>; maxBytes: number }
> = {
  IMAGE: {
    mimeTypes: new Set(["image/jpeg", "image/jpg", "image/png"]),
    maxBytes: 5 * 1024 * 1024,
  },
  VIDEO: {
    mimeTypes: new Set(["video/mp4", "video/3gpp"]),
    maxBytes: 16 * 1024 * 1024,
  },
  DOCUMENT: {
    mimeTypes: new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ]),
    maxBytes: 100 * 1024 * 1024,
  },
};

function detectHeaderMediaType(mimeType: string): HeaderMediaType | null {
  for (const type of HEADER_MEDIA_TYPES) {
    if (TEMPLATE_MEDIA_RULES[type].mimeTypes.has(mimeType)) return type;
  }
  return null;
}

/**
 * Uploads any media file allowed by Meta for template HEADERs.
 *
 * Accepts images (jpg/png), videos (mp4/3gpp), and documents (pdf, Word,
 * Excel, PowerPoint, txt). Returns the chosen `type` so the templates UI
 * and the dispatcher know which Cloud-API parameter shape to use.
 */
export async function uploadTemplateMediaAction(
  input: z.input<typeof TemplateMediaUploadSchema>,
): Promise<
  ActionResult<{
    storagePath: string;
    filename: string;
    mimeType: string;
    type: HeaderMediaType;
  }>
> {
  try {
    const data = TemplateMediaUploadSchema.parse(input);
    const type = detectHeaderMediaType(data.mimeType);
    if (!type) {
      return {
        ok: false,
        error:
          "Tipo de archivo no admitido. Permitidos: imágenes (JPG, PNG), vídeos (MP4, 3GPP) y documentos (PDF, Word, Excel, PowerPoint, TXT).",
      };
    }

    const rules = TEMPLATE_MEDIA_RULES[type];
    const buffer = Buffer.from(data.base64, "base64");
    if (buffer.byteLength === 0) {
      return { ok: false, error: "El archivo está vacío." };
    }
    if (buffer.byteLength > rules.maxBytes) {
      const mb = Math.round(rules.maxBytes / (1024 * 1024));
      return {
        ok: false,
        error: `El archivo es demasiado grande (máx. ${mb} MB para ${type.toLowerCase()}s en WhatsApp).`,
      };
    }

    const { supabase } = await requireAdmin();
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    const storagePath = `templates/${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from("whatsapp-media")
      .upload(storagePath, buffer, { contentType: data.mimeType, upsert: false });
    if (error) throw error;

    return {
      ok: true,
      data: {
        storagePath,
        filename: data.filename,
        mimeType: data.mimeType,
        type,
      },
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Backwards-compat alias — old UI calls this name. New code should use
 * `uploadTemplateMediaAction`.
 */
export const uploadTemplateDocumentAction = uploadTemplateMediaAction;

export async function deleteTemplateDocumentAction(storagePath: string): Promise<ActionResult> {
  try {
    if (!storagePath.startsWith("templates/")) {
      return { ok: false, error: "Ruta de documento no válida." };
    }
    const { supabase } = await requireAdmin();
    const { error } = await supabase.storage.from("whatsapp-media").remove([storagePath]);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Clona una plantilla de la biblioteca (catálogo predefinido) a la lista local
 * del admin. NO la envía a Meta: queda como borrador pendiente para que el
 * admin decida cuándo someterla a aprobación.
 *
 * Si el nombre interno ya existe, añade un sufijo `_N` para evitar choques.
 */
const CatalogCloneSchema = z.object({
  slug: z.string().trim().min(1),
});

export async function cloneCatalogTemplateAction(
  input: z.input<typeof CatalogCloneSchema>,
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const data = CatalogCloneSchema.parse(input);
    const blueprint = findCatalogTemplate(data.slug);
    if (!blueprint) {
      return { ok: false, error: "Plantilla del catálogo no encontrada." };
    }

    const { supabase, profile } = await requireAdmin();

    const { data: existing } = await supabase
      .from("message_templates")
      .select("name, meta_template_name")
      .or(
        `name.ilike.${blueprint.name}%,meta_template_name.like.${blueprint.metaTemplateName}%`,
      );

    const existingNames = new Set((existing ?? []).map((row) => row.name));
    const existingMetaNames = new Set(
      (existing ?? []).map((row) => row.meta_template_name).filter(Boolean) as string[],
    );

    let finalName = blueprint.name;
    let finalMetaName = blueprint.metaTemplateName;
    let suffix = 2;
    while (existingNames.has(finalName) || existingMetaNames.has(finalMetaName)) {
      finalName = `${blueprint.name} (${suffix})`;
      finalMetaName = `${blueprint.metaTemplateName}_${suffix}`;
      suffix += 1;
      if (suffix > 99) break;
    }

    const { data: row, error } = await supabase
      .from("message_templates")
      .insert({
        name: finalName,
        category: blueprint.category,
        body: blueprint.body,
        meta_template_name: finalMetaName,
        language: "es",
        meta_status: "pending",
        components_schema: null,
      })
      .select("id")
      .single();
    if (error) throw error;

    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "whatsapp_template_cloned_from_catalog",
      entityType: "message_template",
      entityId: row?.id ?? null,
      summary: `Plantilla añadida desde la biblioteca: ${finalName}`,
      metadata: { catalogSlug: blueprint.slug, category: blueprint.category },
    });
    revalidatePath("/admin/whatsapp");
    return { ok: true, data: { id: row.id, name: finalName } };
  } catch (error) {
    return fail(error);
  }
}
