import { NextResponse } from "next/server";
import { normalizeWhatsappNumber } from "@/lib/format";
import { log, logError } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { downloadMediaStream, fetchMediaInfo, readMetaWebhookEnv, verifyWebhookSignature } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const TYPE_PLACEHOLDER: Record<string, string> = {
  text: "",
  image: "[Imagen]",
  video: "[Vídeo]",
  audio: "[Audio]",
  voice: "[Nota de voz]",
  sticker: "[Sticker]",
  document: "[Documento]",
  location: "[Ubicación]",
  contacts: "[Contacto]",
  reaction: "[Reacción]",
  unknown: "[Mensaje no soportado]",
};

const STATUS_ORDER: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 99,
};

type MetaContact = { wa_id?: string; profile?: { name?: string } };

type MetaMessage = {
  id?: string;
  from?: string;
  type?: string;
  timestamp?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string; sha256?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  audio?: { id?: string; mime_type?: string; voice?: boolean };
  voice?: { id?: string; mime_type?: string };
  sticker?: { id?: string; mime_type?: string; animated?: boolean };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  reaction?: { message_id?: string; emoji?: string };
  context?: { id?: string; from?: string };
};

type MetaStatus = {
  id?: string;
  status?: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  recipient_id?: string;
  conversation?: { id?: string; origin?: { type?: string } };
  pricing?: { category?: string; pricing_model?: string };
  errors?: Array<{ code?: number; title?: string; message?: string }>;
};

type MetaChange = {
  value?: {
    messaging_product?: string;
    metadata?: { phone_number_id?: string; display_phone_number?: string };
    contacts?: MetaContact[];
    messages?: MetaMessage[];
    statuses?: MetaStatus[];
    message_template_id?: string;
    message_template_name?: string;
    message_template_language?: string;
    event?: string;
    reason?: string;
    disable_info?: { reason?: string };
    other_info?: { title?: string; description?: string };
  };
  field?: string;
};

type MetaWebhookBody = {
  object?: string;
  entry?: Array<{ id?: string; changes?: MetaChange[] }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const { verifyToken } = readMetaWebhookEnv();
  if (!verifyToken) {
    return NextResponse.json({ error: "Verify token no configurado" }, { status: 500 });
  }
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(request: Request) {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(raw, signature)) {
    log("warn", "whatsapp_inbound_invalid_signature");
    return new Response("unauthorized", { status: 401 });
  }

  let body: MetaWebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (body.object !== "whatsapp_business_account") {
    // Meta lo envía siempre con este object. Si no, ignoramos sin error.
    return NextResponse.json({ ok: true, ignored: "unknown_object" });
  }

  const supabase = createServiceRoleClient();
  let processed = 0;
  let skipped = 0;

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        const contactsByWaId = new Map<string, string>();
        for (const contact of value.contacts ?? []) {
          if (contact.wa_id && contact.profile?.name) {
            contactsByWaId.set(contact.wa_id, contact.profile.name);
          }
        }

        for (const message of value.messages ?? []) {
          try {
            const handled = await handleInboundMessage(supabase, message, contactsByWaId);
            if (handled) processed++;
            else skipped++;
          } catch (err) {
            logError("whatsapp_inbound_message_failed", err, { providerMessageId: message.id });
            skipped++;
          }
        }

        for (const status of value.statuses ?? []) {
          try {
            const handled = await handleStatusUpdate(supabase, status);
            if (handled) processed++;
            else skipped++;
          } catch (err) {
            logError("whatsapp_inbound_status_failed", err, { providerMessageId: status.id });
            skipped++;
          }
        }

        if (change.field === "message_template_status_update") {
          try {
            const handled = await handleTemplateStatusUpdate(supabase, value);
            if (handled) processed++;
            else skipped++;
          } catch (err) {
            logError("whatsapp_template_status_failed", err, {
              templateName: value.message_template_name,
              templateId: value.message_template_id,
            });
            skipped++;
          }
        }
      }
    }
  } catch (error) {
    logError("whatsapp_inbound_unexpected_failed", error);
  }

  // Siempre 200 si la firma es válida — Meta reintentaría 7 días con 5xx.
  return NextResponse.json({ ok: true, processed, skipped });
}

async function handleInboundMessage(
  supabase: ReturnType<typeof createServiceRoleClient>,
  message: MetaMessage,
  contactsByWaId: Map<string, string>,
): Promise<boolean> {
  if (!message.id || !message.from) return false;

  // Reacciones se procesan aparte y NO se insertan como mensaje nuevo.
  if (message.type === "reaction") {
    await applyReaction(supabase, {
      messageId: message.reaction?.message_id,
      emoji: message.reaction?.emoji ?? "",
      timestamp: message.timestamp,
    });
    return true;
  }

  const phone = normalizeWhatsappNumber(message.from);
  if (!phone || phone.length < 8 || phone.length > 15) return false;

  const name = contactsByWaId.get(message.from) || `+${phone}`;
  const createdAt = message.timestamp
    ? new Date(Number(message.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const { body, payload } = extractContent(message);
  await applyOptInState(supabase, phone, body);
  await upsertConversationFromWebhook(supabase, {
    phone,
    displayName: name,
    direction: "inbound",
    at: createdAt,
  });
  await persistInboundMedia(supabase, phone, createdAt, payload);

  const insertPayload: Record<string, unknown> = {
    direction: "inbound",
    recipient_name: name,
    recipient_phone: phone,
    template_name: "incoming",
    status: "delivered",
    related_type: "promocion",
    body_text: body,
    provider_message_id: message.id,
    payload,
    created_at: createdAt,
    sent_at: createdAt,
    delivered_at: createdAt,
    provider: "meta",
  };

  log("info", "whatsapp_inbound_message_received", {
    phone,
    name,
    providerMessageId: message.id,
    type: message.type,
  });

  const { error } = await supabase.from("whatsapp_messages").insert(insertPayload);
  if (error) {
    // 23505 = duplicate provider_message_id → dedupe silencioso
    if (error.code === "23505") return true;
    throw error;
  }
  return true;
}

async function upsertConversationFromWebhook(
  supabase: ReturnType<typeof createServiceRoleClient>,
  input: {
    phone: string;
    displayName: string;
    direction: "inbound" | "outbound";
    at: string;
  },
) {
  const row: Record<string, unknown> = {
    phone: input.phone,
    display_name: input.displayName,
    last_message_at: input.at,
  };
  if (input.direction === "inbound") row.last_inbound_at = input.at;
  else row.last_outbound_at = input.at;
  const { error } = await supabase.from("whatsapp_conversations").upsert(row, { onConflict: "phone" });
  if (error) logError("whatsapp_conversation_upsert_failed", error, { phone: input.phone });
}

async function applyOptInState(
  supabase: ReturnType<typeof createServiceRoleClient>,
  phone: string,
  body: string,
) {
  // Combining diacritical marks (U+0300 → U+036F) — explicit escape so the
  // regex doesn't depend on invisible characters in source files.
  const normalized = body
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .trim()
    .toLowerCase();
  const firstToken = normalized.split(/\s+/)[0] ?? "";
  const optOut = ["baja", "stop", "cancelar", "unsubscribe"].includes(firstToken);
  const optIn = ["alta", "start"].includes(firstToken);
  if (!optOut && !optIn) return;

  const { data: existing, error: readError } = await supabase
    .from("whatsapp_conversations")
    .select("tags")
    .eq("phone", phone)
    .maybeSingle();
  if (readError) logError("whatsapp_opt_state_read_failed", readError, { phone });

  const tags = nextOptInTags(existing?.tags, optOut);
  const now = new Date().toISOString();
  const { error } = await supabase.from("whatsapp_conversations").upsert(
    {
      phone,
      marketing_opt_out: optOut,
      opted_out_at: optOut ? now : null,
      opt_out_keyword: optOut ? firstToken : null,
      tags,
    },
    { onConflict: "phone" },
  );
  if (error) logError("whatsapp_opt_state_failed", error, { phone, keyword: firstToken });
}

function nextOptInTags(existing: unknown, optOut: boolean) {
  const tags = Array.isArray(existing)
    ? existing
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean)
    : [];
  const next = new Set(tags);
  if (optOut) next.add("sin-promos");
  else next.delete("sin-promos");
  return [...next];
}

function extensionFromMime(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0] ?? "bin";
  if (subtype === "jpeg") return "jpg";
  if (subtype === "quicktime") return "mov";
  return subtype.replace(/[^a-z0-9]/gi, "") || "bin";
}

async function persistInboundMedia(
  supabase: ReturnType<typeof createServiceRoleClient>,
  phone: string,
  createdAt: string,
  payload: Record<string, unknown>,
) {
  const mediaId = typeof payload.mediaId === "string" ? payload.mediaId : null;
  if (!mediaId || payload.mediaStoragePath) return;
  try {
    const info = await fetchMediaInfo(mediaId);
    if (!info || info.expired || !info.url) return;
    const response = await downloadMediaStream(info.url);
    if (!response.ok) {
      log("warn", "whatsapp_media_download_failed", { mediaId, status: response.status });
      return;
    }
    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? info.mimeType;
    const buffer = await response.arrayBuffer();
    const stamp = createdAt.replace(/[^0-9]/g, "").slice(0, 14);
    const path = `inbound/${phone}/${stamp}-${mediaId}.${extensionFromMime(mimeType)}`;
    const { error } = await supabase.storage.from("whatsapp-media").upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) throw error;
    payload.mediaStorageBucket = "whatsapp-media";
    payload.mediaStoragePath = path;
    payload.mediaMime = payload.mediaMime ?? mimeType;
    payload.mediaSize = info.fileSize ?? buffer.byteLength;
  } catch (error) {
    logError("whatsapp_media_persist_failed", error, { mediaId, phone });
  }
}

function extractContent(message: MetaMessage): {
  body: string;
  payload: Record<string, unknown>;
} {
  const type = message.type || "unknown";
  const placeholder = TYPE_PLACEHOLDER[type] ?? TYPE_PLACEHOLDER.unknown;

  const payload: Record<string, unknown> = {
    type,
    quotedId: message.context?.id ?? null,
  };

  switch (type) {
    case "text":
      return { body: message.text?.body ?? "", payload };
    case "image":
      payload.hasMedia = true;
      payload.mediaId = message.image?.id ?? null;
      payload.mediaMime = message.image?.mime_type ?? null;
      return { body: message.image?.caption || placeholder, payload };
    case "video":
      payload.hasMedia = true;
      payload.mediaId = message.video?.id ?? null;
      payload.mediaMime = message.video?.mime_type ?? null;
      return { body: message.video?.caption || placeholder, payload };
    case "audio":
    case "voice": {
      payload.hasMedia = true;
      const media = message.audio ?? message.voice;
      payload.mediaId = media?.id ?? null;
      payload.mediaMime = media?.mime_type ?? null;
      payload.type = message.audio?.voice ? "voice" : type;
      return { body: placeholder, payload };
    }
    case "sticker":
      payload.hasMedia = true;
      payload.mediaId = message.sticker?.id ?? null;
      payload.mediaMime = message.sticker?.mime_type ?? null;
      payload.animated = Boolean(message.sticker?.animated);
      return { body: placeholder, payload };
    case "document":
      payload.hasMedia = true;
      payload.mediaId = message.document?.id ?? null;
      payload.mediaMime = message.document?.mime_type ?? null;
      payload.mediaFilename = message.document?.filename ?? null;
      return { body: message.document?.caption || message.document?.filename || placeholder, payload };
    case "location":
      payload.location = {
        latitude: message.location?.latitude ?? null,
        longitude: message.location?.longitude ?? null,
        description: message.location?.name ?? message.location?.address ?? null,
      };
      return { body: placeholder, payload };
    default:
      return { body: placeholder, payload };
  }
}

async function applyReaction(
  supabase: ReturnType<typeof createServiceRoleClient>,
  reaction: { messageId?: string; emoji: string; timestamp?: string },
): Promise<void> {
  if (!reaction.messageId) return;
  const { data: row } = await supabase
    .from("whatsapp_messages")
    .select("id, payload")
    .eq("provider_message_id", reaction.messageId)
    .maybeSingle();
  if (!row) return;

  const payload = (row.payload as Record<string, unknown>) ?? {};
  const existing = Array.isArray(payload.reactions)
    ? (payload.reactions as Array<Record<string, unknown>>)
    : [];
  const filtered = existing.filter((r) => r.fromMe !== false);
  const next = reaction.emoji
    ? [
        ...filtered,
        {
          emoji: reaction.emoji,
          fromMe: false,
          timestamp: reaction.timestamp ? Number(reaction.timestamp) * 1000 : Date.now(),
        },
      ]
    : filtered;
  await supabase
    .from("whatsapp_messages")
    .update({ payload: { ...payload, reactions: next } })
    .eq("id", row.id);
}

async function handleStatusUpdate(
  supabase: ReturnType<typeof createServiceRoleClient>,
  status: MetaStatus,
): Promise<boolean> {
  if (!status.id || !status.status) return false;

  const { data: row } = await supabase
    .from("whatsapp_messages")
    .select("id, status, payload")
    .eq("provider_message_id", status.id)
    .maybeSingle();
  if (!row) return false;

  const currentRank = STATUS_ORDER[row.status] ?? -1;
  const incomingRank = STATUS_ORDER[status.status] ?? -1;

  // failed siempre gana; el resto sólo avanza.
  if (status.status !== "failed" && incomingRank < currentRank) return false;

  const updates: Record<string, unknown> = { status: status.status };
  const tsIso = status.timestamp
    ? new Date(Number(status.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  if (status.status === "sent") updates.sent_at = tsIso;
  if (status.status === "delivered") updates.delivered_at = tsIso;
  if (status.status === "read") {
    updates.delivered_at = tsIso;
    updates.read_at = tsIso;
  }
  if (status.status === "failed") {
    updates.error_message =
      status.errors?.[0]?.message ||
      status.errors?.[0]?.title ||
      "Meta marcó el mensaje como fallido";
  }

  // Billing y conversación si vienen.
  if (status.conversation?.id) updates.meta_conversation_id = status.conversation.id;
  if (status.pricing?.category) updates.meta_pricing_category = status.pricing.category;

  const { error } = await supabase.from("whatsapp_messages").update(updates).eq("id", row.id);
  if (error) throw error;
  return true;
}

function templateStatusFromEvent(event: string | undefined): "pending" | "approved" | "rejected" {
  const normalized = (event ?? "").toUpperCase();
  if (normalized === "APPROVED") return "approved";
  if (normalized === "REJECTED" || normalized === "PAUSED" || normalized === "DISABLED") return "rejected";
  return "pending";
}

async function handleTemplateStatusUpdate(
  supabase: ReturnType<typeof createServiceRoleClient>,
  value: NonNullable<MetaChange["value"]>,
): Promise<boolean> {
  const templateName = value.message_template_name;
  const templateId = value.message_template_id;
  const language = value.message_template_language;
  if (!templateName && !templateId) return false;

  const reason =
    value.reason ??
    value.disable_info?.reason ??
    value.other_info?.description ??
    value.other_info?.title ??
    null;
  const updates = {
    meta_template_id: templateId ?? undefined,
    language: language ?? undefined,
    meta_status: templateStatusFromEvent(value.event),
    meta_review_status: value.event ?? null,
    meta_rejection_reason: reason && reason !== "NONE" ? reason : null,
    meta_synced_at: new Date().toISOString(),
  };

  let query = supabase.from("message_templates").update(updates);
  if (templateId) query = query.eq("meta_template_id", templateId);
  else query = query.eq("meta_template_name", templateName);
  const { data, error } = await query.select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
