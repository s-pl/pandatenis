import "server-only";

import crypto from "node:crypto";
import {
  type MetaMessageTemplate,
  WhatsappDeliveryError,
  type WhatsappPhoneStatus,
  type WhatsappSendInput,
  type WhatsappSendResult,
  type WhatsappTemplateComponent,
  type WhatsappTemplatePayload,
} from "@/lib/whatsapp/types";

const DEFAULT_GRAPH_VERSION = "v20.0";

function graphBase(): string {
  const version = process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION;
  return `https://graph.facebook.com/${version}`;
}

function readEnv() {
  return {
    accessToken: process.env.META_WHATSAPP_ACCESS_TOKEN ?? "",
    phoneNumberId: process.env.META_PHONE_NUMBER_ID ?? "",
    wabaId: process.env.META_WABA_ID ?? "",
    appId: process.env.META_APP_ID ?? "",
    appSecret: process.env.META_APP_SECRET ?? "",
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? "",
  };
}

export function isMetaConfigured(): boolean {
  const env = readEnv();
  return Boolean(env.accessToken && env.phoneNumberId);
}

export function readMetaWebhookEnv() {
  const env = readEnv();
  return {
    appSecret: env.appSecret,
    verifyToken: env.verifyToken,
  };
}

function ensureConfigured(): { accessToken: string; phoneNumberId: string } {
  const { accessToken, phoneNumberId } = readEnv();
  if (!accessToken || !phoneNumberId) {
    throw new WhatsappDeliveryError(
      "Meta WhatsApp no está configurado. Faltan META_WHATSAPP_ACCESS_TOKEN y META_PHONE_NUMBER_ID en .env.local.",
      { kind: "not_configured", retryable: false },
    );
  }
  return { accessToken, phoneNumberId };
}

function ensureWabaConfigured(): { wabaId: string } {
  const { wabaId } = readEnv();
  if (!wabaId) {
    throw new WhatsappDeliveryError(
      "Meta WhatsApp no está configurado. Falta META_WABA_ID para sincronizar plantillas.",
      { kind: "not_configured", retryable: false },
    );
  }
  return { wabaId };
}

function ensureAppConfigured(): { appId: string } {
  const { appId } = readEnv();
  if (!appId) {
    throw new WhatsappDeliveryError(
      "Falta META_APP_ID en .env.local. Es necesario para subir el archivo de cabecera (header_handle) al crear plantillas con foto, vídeo o documento. Lo encuentras en Meta for Developers → tu app → Configuración → Básica → ID de la aplicación.",
      { kind: "not_configured", retryable: false },
    );
  }
  return { appId };
}

type GraphErrorBody = {
  error?: {
    message?: string;
    error_user_title?: string;
    error_user_msg?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { messaging_product?: string; details?: string };
    fbtrace_id?: string;
  };
};

function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.floor(seconds);
  const date = new Date(value).getTime();
  if (Number.isFinite(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  return undefined;
}

function classifyGraphError(
  httpStatus: number,
  body: GraphErrorBody,
  retryAfter?: number,
): WhatsappDeliveryError {
  const code = body.error?.code ?? 0;
  const subcode = body.error?.error_subcode ?? 0;
  const fbtraceId = body.error?.fbtrace_id;
  const message =
    body.error?.error_data?.details ??
    body.error?.error_user_msg ??
    body.error?.message ??
    `Meta respondió ${httpStatus}`;
  const common = { fbtraceId, retryAfterSeconds: retryAfter, raw: body };

  // Catálogo de códigos de error oficial:
  // https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
  if (code === 131026 || subcode === 131026) {
    return new WhatsappDeliveryError(message, {
      status: httpStatus,
      code,
      kind: "not_registered",
      retryable: false,
      ...common,
    });
  }
  if (code === 131047 || subcode === 131047) {
    return new WhatsappDeliveryError(message, {
      status: httpStatus,
      code,
      kind: "outside_window",
      retryable: false,
      ...common,
    });
  }
  if (code === 132001 || code === 132012 || code === 132000 || code === 132005) {
    return new WhatsappDeliveryError(message, {
      status: httpStatus,
      code,
      kind: "template_required",
      retryable: false,
      ...common,
    });
  }
  if (code === 131049 || code === 80007 || httpStatus === 429) {
    return new WhatsappDeliveryError(message, {
      status: httpStatus,
      code,
      kind: "rate_limited",
      retryable: true,
      ...common,
    });
  }
  if (code === 190 || code === 102 || code === 104 || httpStatus === 401 || httpStatus === 403) {
    // Code 190 = token expired or invalid. La causa #1 son tokens de usuario
    // temporales (caducan en 1-2 h o 60 días). En producción hace falta un
    // System User Token que NO caduca.
    const tokenHint =
      code === 190
        ? " Tu token de Meta ha caducado o no es válido. En .env.local, sustituye META_WHATSAPP_ACCESS_TOKEN por un token de System User permanente (Meta Business Manager → Usuarios del sistema → Generar token con permisos 'whatsapp_business_messaging' Y 'whatsapp_business_management', caducidad 'Nunca'). Reinicia el dev server después."
        : " Revisa permisos del token y que esté autorizado para esta WABA.";
    return new WhatsappDeliveryError(`${message}.${tokenHint}`, {
      status: httpStatus,
      code,
      kind: "auth",
      retryable: false,
      ...common,
    });
  }
  if (code === 368) {
    return new WhatsappDeliveryError(message, {
      status: httpStatus,
      code,
      kind: "auth",
      retryable: false,
      ...common,
    });
  }
  if (httpStatus === 400 && /phone/i.test(message)) {
    return new WhatsappDeliveryError(message, {
      status: httpStatus,
      code,
      kind: "invalid_phone",
      retryable: false,
      ...common,
    });
  }
  if (httpStatus >= 500 || httpStatus === 408 || httpStatus === 425) {
    return new WhatsappDeliveryError(message, {
      status: httpStatus,
      code,
      kind: "transient",
      retryable: true,
      ...common,
    });
  }
  return new WhatsappDeliveryError(message, {
    status: httpStatus,
    code,
    kind: "unknown",
    retryable: false,
    ...common,
  });
}

async function postJson(path: string, body: unknown, timeoutMs = 20000): Promise<Response> {
  const { accessToken } = ensureConfigured();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${graphBase()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function postForm(path: string, body: FormData, timeoutMs = 20000): Promise<Response> {
  const { accessToken } = ensureConfigured();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${graphBase()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(path: string, timeoutMs = 10000): Promise<Response> {
  const { accessToken } = ensureConfigured();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${graphBase()}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  if (!response.ok) {
    throw classifyGraphError(response.status, data as GraphErrorBody, retryAfterSeconds(response.headers.get("retry-after")));
  }
  return data;
}

type GraphMessagesResponse = {
  messages?: Array<{
    id: string;
    message_status?: string;
  }>;
  contacts?: Array<{ wa_id: string }>;
};

function normalizePhone(input: string): string {
  const digits = String(input).replace(/[^\d]/g, "");
  return digits;
}

type UploadedMedia = {
  id: string;
  mimeType: string;
  messageType: "image" | "video" | "audio" | "document";
};

function messageTypeFromMime(mimeType: string): UploadedMedia["messageType"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function extensionFromMime(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0];
  if (!subtype) return "bin";
  if (subtype === "jpeg") return "jpg";
  return subtype.replace(/[^a-z0-9]/gi, "") || "bin";
}

export type HeaderMediaFormat = "IMAGE" | "VIDEO" | "DOCUMENT";

/**
 * Uploads a sample file to Meta's resumable upload API and returns the
 * `header_handle` (the `h:...` string) required to declare a media HEADER when
 * creating a template. This is a two-step App-level flow:
 *
 *   1. `POST /{APP_ID}/uploads` opens a session and returns an upload id.
 *   2. `POST /{uploadId}` (with the raw bytes and `file_offset: 0`) returns
 *      `{ h: "<handle>" }`.
 *
 * The handle is what Meta stores as the template's representative media; the
 * real file is sent per-message via header parameters at send time.
 */
export async function uploadTemplateHeaderHandle(input: {
  bytes: ArrayBuffer;
  filename: string;
  mimeType: string;
  timeoutMs?: number;
}): Promise<string> {
  const { accessToken } = ensureConfigured();
  const { appId } = ensureAppConfigured();
  const timeoutMs = input.timeoutMs ?? 60000;

  const sessionUrl =
    `${graphBase()}/${appId}/uploads` +
    `?file_name=${encodeURIComponent(input.filename)}` +
    `&file_length=${input.bytes.byteLength}` +
    `&file_type=${encodeURIComponent(input.mimeType)}`;

  const sessionResponse = await fetch(sessionUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const session = await readResponse<{ id?: string }>(sessionResponse);
  if (!session.id) {
    throw new WhatsappDeliveryError(
      "Meta no devolvió una sesión de subida para el archivo de cabecera. Revisa META_APP_ID y los permisos del token.",
      { kind: "unknown", retryable: false },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const uploadResponse = await fetch(`${graphBase()}/${session.id}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_offset: "0",
      },
      body: new Blob([input.bytes], { type: input.mimeType }),
      signal: controller.signal,
    });
    const uploaded = await readResponse<{ h?: string }>(uploadResponse);
    if (!uploaded.h) {
      throw new WhatsappDeliveryError(
        "Meta no devolvió el identificador del archivo de cabecera (header_handle).",
        { kind: "unknown", retryable: false },
      );
    }
    return uploaded.h;
  } finally {
    clearTimeout(timer);
  }
}

async function uploadMediaFromUrl(
  mediaUrl: string,
  phoneNumberId: string,
  timeoutMs = 30000,
): Promise<UploadedMedia> {
  const upstream = await fetch(mediaUrl, { cache: "no-store" });
  if (!upstream.ok) {
    throw new WhatsappDeliveryError(`No se pudo descargar el archivo (${upstream.status})`, {
      status: upstream.status,
      kind: upstream.status >= 500 ? "transient" : "unknown",
      retryable: upstream.status >= 500,
    });
  }

  const mimeType = upstream.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
  const blob = new Blob([await upstream.arrayBuffer()], { type: mimeType });
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", blob, `panda-media.${extensionFromMime(mimeType)}`);

  const response = await postForm(`/${phoneNumberId}/media`, form, timeoutMs);
  const data = await readResponse<{ id?: string }>(response);
  if (!data.id) {
    throw new WhatsappDeliveryError("Meta no devolvió id al subir el archivo", {
      kind: "unknown",
      retryable: false,
    });
  }
  return {
    id: data.id,
    mimeType,
    messageType: messageTypeFromMime(mimeType),
  };
}

/**
 * Envía un mensaje vía Meta Cloud API. Si `input.template` viene definido,
 * envía template message (para iniciar conversación o fuera de ventana 24h);
 * en otro caso envía texto libre o media (sólo válido dentro de la ventana 24h
 * tras el último mensaje entrante).
 */
export async function sendViaProvider(input: WhatsappSendInput): Promise<WhatsappSendResult> {
  const phone = normalizePhone(input.to);
  if (!phone) {
    throw new WhatsappDeliveryError("Teléfono no válido", {
      kind: "invalid_phone",
      retryable: false,
    });
  }

  if (input.delayMs && input.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(input.delayMs ?? 0, 8000)));
  }

  const { phoneNumberId } = ensureConfigured();

  let payload: Record<string, unknown>;
  if (input.template) {
    payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: input.template.name,
        language: { code: input.template.language },
        components: input.template.components ?? [],
      },
    };
  } else if (input.mediaUrl) {
    const uploaded = await uploadMediaFromUrl(input.mediaUrl, phoneNumberId, input.timeoutMs ?? 30000);
    const media: Record<string, unknown> = { id: uploaded.id };
    if (input.mediaCaption && uploaded.messageType !== "audio") {
      media.caption = input.mediaCaption;
    }
    // Los documentos pueden llevar el nombre real para que la familia lo vea.
    if (uploaded.messageType === "document" && input.mediaFilename) {
      media.filename = input.mediaFilename;
    }
    payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: uploaded.messageType,
      [uploaded.messageType]: media,
    };
  } else if (input.body) {
    payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: input.body, preview_url: false },
    };
  } else {
    throw new WhatsappDeliveryError("Falta body o template para enviar", {
      kind: "unknown",
      retryable: false,
    });
  }

  const response = await postJson(`/${phoneNumberId}/messages`, payload, input.timeoutMs ?? 20000);
  const data = await readResponse<GraphMessagesResponse>(response);
  const id = data.messages?.[0]?.id ?? null;
  return { id, timestamp: Date.now() };
}

export async function sendTemplate(input: {
  to: string;
  template: WhatsappTemplatePayload;
}): Promise<WhatsappSendResult> {
  return sendViaProvider({ to: input.to, template: input.template });
}

type GraphTemplatesResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    language?: string;
    status?: string;
    category?: string;
    components?: Array<Record<string, unknown>>;
    rejected_reason?: string;
    quality_score?: { score?: string } | string;
  }>;
  paging?: { next?: string };
};

function metaTemplateStatus(status: string | undefined): MetaMessageTemplate["status"] {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "APPROVED") return "approved";
  if (normalized === "REJECTED" || normalized === "DISABLED" || normalized === "PAUSED") return "rejected";
  return "pending";
}

function templateBody(components: Array<Record<string, unknown>> | undefined): string {
  const body = (components ?? []).find((component) => String(component.type ?? "").toUpperCase() === "BODY");
  return typeof body?.text === "string" ? body.text : "";
}

function templateQualityScore(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "score" in value && typeof value.score === "string") return value.score;
  return null;
}

function toTemplate(row: NonNullable<GraphTemplatesResponse["data"]>[number]): MetaMessageTemplate | null {
  if (!row.name || !row.language) return null;
  const components = row.components ?? [];
  return {
    id: row.id ?? null,
    name: row.name,
    language: row.language,
    status: metaTemplateStatus(row.status),
    rawStatus: row.status ?? "UNKNOWN",
    category: row.category ?? null,
    body: templateBody(components),
    components,
    rejectionReason: row.rejected_reason && row.rejected_reason !== "NONE" ? row.rejected_reason : null,
    qualityScore: templateQualityScore(row.quality_score),
  };
}

export async function listMessageTemplates(): Promise<MetaMessageTemplate[]> {
  const { wabaId } = ensureWabaConfigured();
  const fields = [
    "id",
    "name",
    "status",
    "category",
    "language",
    "components",
    "rejected_reason",
    "quality_score",
  ].join(",");
  let path = `/${wabaId}/message_templates?fields=${encodeURIComponent(fields)}&limit=100`;
  const templates: MetaMessageTemplate[] = [];

  for (let page = 0; page < 10 && path; page++) {
    const response = path.startsWith("https://")
      ? await fetch(path, {
          headers: { Authorization: `Bearer ${ensureConfigured().accessToken}` },
          cache: "no-store",
        })
      : await getJson(path);
    const data = await readResponse<GraphTemplatesResponse>(response);
    for (const row of data.data ?? []) {
      const template = toTemplate(row);
      if (template) templates.push(template);
    }
    path = data.paging?.next ?? "";
  }

  return templates;
}

function templateVariableKeys(body: string): string[] {
  const keys = new Set<string>();
  const regex = /\{\{(\d+|[a-zA-Z_]\w*)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body))) keys.add(match[1]);
  return Array.from(keys).sort((a, b) => Number(a) - Number(b));
}

function templateExampleValue(key: string, index: number, contextBefore = ""): string {
  const normalized = key.toLowerCase();
  const ctx = contextBefore.toLowerCase();

  // 1) Pistas explícitas en el nombre de la variable.
  if (normalized.includes("phone") || normalized.includes("telefono") || normalized.includes("tel")) {
    return "600 12 34 56";
  }
  if (normalized.includes("date") || normalized.includes("fecha")) return "25/06/2026";
  if (normalized.includes("time") || normalized.includes("hora")) return "18:30";
  if (normalized.includes("amount") || normalized.includes("importe") || normalized.includes("price")) {
    return "45 €";
  }
  if (normalized.includes("link") || normalized.includes("url")) return "https://pandatenis.com";
  if (normalized.includes("group") || normalized.includes("grupo")) return "Verde A";

  // 2) Pistas del texto que precede a la variable — esto es lo que Meta usa
  //    también para revisar.
  if (/(hola|hello|hi|buenas)\s*$/.test(ctx)) return "María"; // saludo personal
  if (/(de|para|al|alumn[oa]|hijo|hija|peque)\s*$/.test(ctx)) return "Lucas";
  if (/(recibo|factura)\s*$/.test(ctx)) return "R-2026-001";
  if (/(fecha|día|el)\s*$/.test(ctx)) return "viernes 27 de junio";
  if (/(hora|a las)\s*$/.test(ctx)) return "18:30";
  if (/(precio|importe|cuota|coste|son)\s*$/.test(ctx)) return "45 €";
  if (/(grupo|nivel|categoría|categoria|turno)\s*$/.test(ctx)) return "Verde A";
  if (/(enlace|link|aquí|aqui)\s*$/.test(ctx)) return "https://pandatenis.com/inscripcion";
  if (/(escuela|club|panda)\s*$/.test(ctx)) return "Panda Tenis";

  // 3) Defaults razonables por posición — siempre con texto plausible.
  if (key === "1" || index === 0) return "María";
  return ["Lucas", "Verde A", "viernes 27", "18:30", "45 €", "Panda Tenis"][index - 1] ?? "Panda Tenis";
}

/**
 * Validates that a Meta template name complies with Graph API rules:
 * `^[a-z0-9_]{1,512}$` and must NOT start with `_`.
 */
function validateMetaTemplateName(name: string): string | null {
  if (!name) return "El nombre de la plantilla está vacío.";
  if (name.length > 512) return "El nombre de la plantilla supera los 512 caracteres permitidos.";
  if (!/^[a-z0-9_]+$/.test(name)) {
    return `El nombre "${name}" tiene caracteres inválidos. Meta exige solo minúsculas, números y guion bajo.`;
  }
  if (name.startsWith("_")) return "El nombre de la plantilla no puede empezar con guion bajo.";
  return null;
}

/**
 * Builds the `components[]` for create/edit: an optional media HEADER (with its
 * representative `header_handle`) followed by the BODY with example values for
 * each variable (Meta rejects templates whose examples don't read naturally).
 */
function buildTemplateCreateComponents(
  body: string,
  header?: { format: HeaderMediaFormat; handle: string } | null,
): Record<string, unknown>[] {
  const bodyComponent: Record<string, unknown> = { type: "BODY", text: body };
  const variables = templateVariableKeys(body);
  if (variables.length > 0) {
    const examples = variables.map((key, index) => {
      const pattern = new RegExp(`([\\s\\S]*?)\\{\\{\\s*${key}\\s*\\}\\}`);
      const match = pattern.exec(body);
      const contextBefore = match ? match[1].slice(-40) : "";
      return templateExampleValue(key, index, contextBefore);
    });
    bodyComponent.example = { body_text: [examples] };
  }
  const components: Record<string, unknown>[] = [];
  if (header) {
    // Media HEADER must precede the BODY and carry a representative sample
    // (header_handle) so Meta's reviewer can see the kind of media.
    components.push({
      type: "HEADER",
      format: header.format,
      example: { header_handle: [header.handle] },
    });
  }
  components.push(bodyComponent);
  return components;
}

export async function createMessageTemplate(input: {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  body: string;
  header?: { format: HeaderMediaFormat; handle: string } | null;
}): Promise<MetaMessageTemplate> {
  const { wabaId } = ensureWabaConfigured();

  // Pre-flight name validation. Meta returns 200 OK silently for some
  // edge cases; better to fail fast here with a clear message.
  const nameError = validateMetaTemplateName(input.name);
  if (nameError) {
    throw new WhatsappDeliveryError(nameError, { kind: "unknown", retryable: false });
  }

  const components = buildTemplateCreateComponents(input.body, input.header);

  const requestBody = {
    name: input.name,
    language: input.language,
    category: input.category,
    allow_category_change: true,
    components,
  };

  const response = await postJson(`/${wabaId}/message_templates`, requestBody);
  const data = await readResponse<{
    id?: string;
    status?: string;
    category?: string;
  }>(response);

  // CRITICAL: Meta sometimes returns 200 OK with an empty body when the
  // request is silently rejected (wrong WABA_ID, missing scope, duplicate
  // name+language pair, etc.). Treat missing id as a hard failure so the
  // user knows the template did NOT reach Meta's library.
  if (!data.id) {
    throw new WhatsappDeliveryError(
      `Meta aceptó la petición pero no devolvió un ID de plantilla. Suele significar que META_WABA_ID (${wabaId}) no corresponde a tu cuenta, que el token no tiene el permiso 'whatsapp_business_management' o que ya existe una plantilla con el mismo nombre+idioma. Comprueba en Meta Business Manager → WhatsApp → Plantillas de mensaje.`,
      {
        kind: "unknown",
        retryable: false,
        raw: { requestBody, responseBody: data },
      },
    );
  }

  // Confirmation step: fetch the template back from Meta to verify it
  // actually lives in the library. Defensive against soft failures.
  try {
    const verifyResponse = await getJson(
      `/${data.id}?fields=name,status,category,language,components,rejected_reason,quality_score`,
    );
    const verified = await readResponse<{
      id?: string;
      name?: string;
      status?: string;
      category?: string;
      language?: string;
      components?: Array<Record<string, unknown>>;
      rejected_reason?: string;
      quality_score?: { score?: string } | string;
    }>(verifyResponse);
    return {
      id: verified.id ?? data.id,
      name: verified.name ?? input.name,
      language: verified.language ?? input.language,
      status: metaTemplateStatus(verified.status ?? data.status),
      rawStatus: verified.status ?? data.status ?? "PENDING",
      category: verified.category ?? data.category ?? input.category,
      body: input.body,
      components: verified.components ?? components,
      rejectionReason:
        verified.rejected_reason && verified.rejected_reason !== "NONE"
          ? verified.rejected_reason
          : null,
      qualityScore: templateQualityScore(verified.quality_score),
    };
  } catch {
    // Verification failed but the create did return an id — trust the create
    // response and let the next sync round pick up the actual server state.
    return {
      id: data.id,
      name: input.name,
      language: input.language,
      status: metaTemplateStatus(data.status),
      rawStatus: data.status ?? "PENDING",
      category: data.category ?? input.category,
      body: input.body,
      components,
      rejectionReason: null,
      qualityScore: null,
    };
  }
}

/**
 * Edits an EXISTING Meta template (by its template id) — used to add or change
 * the media header / body of a template already in the library. Meta only
 * allows editing templates in APPROVED, REJECTED or PAUSED state, and the edit
 * sends the template back to PENDING review. Name, language and category can't
 * be changed via edit, so we only submit `components`.
 */
export async function editMessageTemplate(input: {
  metaTemplateId: string;
  body: string;
  header?: { format: HeaderMediaFormat; handle: string } | null;
}): Promise<MetaMessageTemplate> {
  ensureWabaConfigured();
  const components = buildTemplateCreateComponents(input.body, input.header);

  const response = await postJson(`/${input.metaTemplateId}`, { components });
  await readResponse<{ success?: boolean }>(response);

  // Fetch the template back so the caller gets the refreshed status.
  try {
    const verifyResponse = await getJson(
      `/${input.metaTemplateId}?fields=name,status,category,language,components,rejected_reason,quality_score`,
    );
    const verified = await readResponse<{
      id?: string;
      name?: string;
      status?: string;
      category?: string;
      language?: string;
      components?: Array<Record<string, unknown>>;
      rejected_reason?: string;
      quality_score?: { score?: string } | string;
    }>(verifyResponse);
    return {
      id: verified.id ?? input.metaTemplateId,
      name: verified.name ?? "",
      language: verified.language ?? "es",
      status: metaTemplateStatus(verified.status),
      rawStatus: verified.status ?? "PENDING",
      category: verified.category ?? null,
      body: input.body,
      components: verified.components ?? components,
      rejectionReason:
        verified.rejected_reason && verified.rejected_reason !== "NONE"
          ? verified.rejected_reason
          : null,
      qualityScore: templateQualityScore(verified.quality_score),
    };
  } catch {
    return {
      id: input.metaTemplateId,
      name: "",
      language: "es",
      status: "pending",
      rawStatus: "PENDING",
      category: null,
      body: input.body,
      components,
      rejectionReason: null,
      qualityScore: null,
    };
  }
}

export function buildTemplateComponents(
  variables: Record<string, string>,
  schema?: { body?: { variables?: string[] } } | null,
): WhatsappTemplateComponent[] {
  // Si hay esquema declarado, lo respetamos en orden. Si no, asumimos {{1}} {{2}} … numéricos.
  const ordered: string[] = [];
  if (schema?.body?.variables && Array.isArray(schema.body.variables)) {
    for (const key of schema.body.variables) {
      ordered.push(String(variables[key] ?? ""));
    }
  } else {
    let i = 1;
    while (variables[String(i)] !== undefined) {
      ordered.push(String(variables[String(i)] ?? ""));
      i++;
    }
  }
  if (ordered.length === 0) return [];
  return [
    {
      type: "body",
      parameters: ordered.map((value) => ({ type: "text", text: value })),
    },
  ];
}

export async function getPhoneNumberStatus(): Promise<WhatsappPhoneStatus> {
  if (!isMetaConfigured()) {
    return { configured: false, lastError: "Faltan credenciales Meta" };
  }
  const { phoneNumberId } = ensureConfigured();
  const start = Date.now();
  try {
    const response = await getJson(
      `/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,platform_type`,
    );
    const data = await readResponse<{
      verified_name?: string;
      display_phone_number?: string;
      quality_rating?: string;
      platform_type?: string;
    }>(response);
    return {
      configured: true,
      phoneNumberId,
      verifiedName: data.verified_name,
      displayPhoneNumber: data.display_phone_number,
      qualityRating: (data.quality_rating as WhatsappPhoneStatus["qualityRating"]) ?? undefined,
      platformType: data.platform_type,
      status: "ready",
      elapsedMs: Date.now() - start,
    };
  } catch (error) {
    return {
      configured: true,
      phoneNumberId,
      status: "error",
      lastError: error instanceof Error ? error.message : "Error desconocido",
      elapsedMs: Date.now() - start,
    };
  }
}

export type WabaStatus = {
  reachable: boolean;
  wabaId: string;
  name?: string | null;
  currency?: string | null;
  templatesCount?: number | null;
  lastError?: string | null;
  elapsedMs?: number;
};

/**
 * Reports whether `META_WABA_ID` is reachable with the current access token and
 * how many message templates Meta sees. This is the diagnostic that catches
 * the "template sent but missing from library" failure mode: if the WABA is
 * not reachable, the create-template call will silently no-op.
 */
export async function getWabaStatus(): Promise<WabaStatus> {
  const { wabaId } = readEnv();
  const empty: WabaStatus = { reachable: false, wabaId };
  if (!wabaId) {
    return { ...empty, lastError: "META_WABA_ID no está definido en .env.local" };
  }
  if (!isMetaConfigured()) {
    return { ...empty, lastError: "Faltan credenciales Meta" };
  }
  const start = Date.now();
  try {
    const response = await getJson(`/${wabaId}?fields=name,currency,message_template_namespace`);
    const data = await readResponse<{
      name?: string;
      currency?: string;
    }>(response);

    let templatesCount: number | null = null;
    try {
      const countResponse = await getJson(`/${wabaId}/message_templates?limit=1&summary=total_count`);
      const countData = await readResponse<{
        data?: unknown[];
        summary?: { total_count?: number };
      }>(countResponse);
      templatesCount = countData.summary?.total_count ?? countData.data?.length ?? null;
    } catch {
      // Non-fatal — the WABA is still reachable.
    }

    return {
      reachable: true,
      wabaId,
      name: data.name ?? null,
      currency: data.currency ?? null,
      templatesCount,
      elapsedMs: Date.now() - start,
    };
  } catch (error) {
    return {
      ...empty,
      lastError: error instanceof Error ? error.message : "Error desconocido",
      elapsedMs: Date.now() - start,
    };
  }
}

export type MetaMediaInfo = {
  url: string;
  mimeType: string;
  fileSize?: number;
  expired?: boolean;
};

export async function fetchMediaInfo(mediaId: string): Promise<MetaMediaInfo | null> {
  if (!/^\d{10,20}$/.test(mediaId)) return null;
  try {
    const response = await getJson(`/${mediaId}?fields=url,mime_type,file_size`);
    if (response.status === 404 || response.status === 410) return { url: "", mimeType: "", expired: true };
    const data = await readResponse<{ url?: string; mime_type?: string; file_size?: number }>(response);
    if (!data.url) return null;
    return {
      url: data.url,
      mimeType: data.mime_type ?? "application/octet-stream",
      fileSize: data.file_size,
    };
  } catch (error) {
    if (error instanceof WhatsappDeliveryError && (error.status === 404 || error.status === 410)) {
      return { url: "", mimeType: "", expired: true };
    }
    return null;
  }
}

export async function downloadMediaStream(url: string): Promise<Response> {
  const { accessToken } = ensureConfigured();
  return fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
}

/**
 * Verifica la firma X-Hub-Signature-256 que Meta envía en cada webhook.
 * Hay que llamarla con el body crudo (sin parsear) para que el HMAC cuadre.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const { appSecret } = readMetaWebhookEnv();
  if (!appSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice(7);
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
