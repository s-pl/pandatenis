import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatRoom } from "@/components/admin/whatsapp/chat-room";
import type { ApprovedTemplate } from "@/components/admin/whatsapp/template-composer";
import { requireAdmin } from "@/lib/dal";
import { normalizeWhatsappNumber } from "@/lib/format";
import { isWithin24h } from "@/lib/whatsapp/window";

export const dynamic = "force-dynamic";

const PHONE_REGEX = /^\d{8,15}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ phone: string }>;
}): Promise<Metadata> {
  const { phone } = await params;
  if (!PHONE_REGEX.test(phone)) return { title: "Chat" };
  return { title: `Chat con +${phone}` };
}

export default async function ChatRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ phone: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const { phone } = await params;
  const { limit: limitParam } = await searchParams;
  if (!PHONE_REGEX.test(phone)) notFound();
  const { supabase } = await requireAdmin();

  // Carga por defecto 80 mensajes; el cliente puede pedir más con ?limit=N.
  // Topamos en 800 para evitar cargas patológicas.
  const parsedLimit = Number(limitParam ?? "80");
  const messageLimit = Math.min(
    Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 80, 20),
    800,
  );

  const [{ data: messagesRaw }, { data: approvedTemplatesRaw }, { data: conversationMeta }] = await Promise.all([
    supabase
      .from("whatsapp_messages")
      .select(
        "id, direction, recipient_name, recipient_phone, body_text, template_name, status, related_type, payload, provider_message_id, error_message, created_at, sent_at, delivered_at, read_at, message_templates(name, body)",
      )
      .eq("recipient_phone", phone)
      .order("created_at", { ascending: false })
      .limit(messageLimit),
    supabase
      .from("message_templates")
      .select("id, name, body, language, category, components_schema")
      .eq("meta_status", "approved")
      .order("name"),
    supabase
      .from("whatsapp_conversations")
      .select("tags, internal_note, marketing_opt_out")
      .eq("phone", phone)
      .maybeSingle(),
  ]);

  const approvedTemplates: ApprovedTemplate[] = (approvedTemplatesRaw ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    body: row.body,
    language: row.language ?? "es",
    category: row.category,
    componentsSchema: (row.components_schema ?? null) as
      | { body?: { variables?: string[] } }
      | null,
  }));

  // El query devuelve los más recientes primero (DESC). Lo invertimos para
  // que el componente reciba el hilo en orden cronológico ascendente.
  const messages = (messagesRaw ?? []).slice().reverse().map((row) => {
    const template = Array.isArray(row.message_templates)
      ? row.message_templates[0]
      : (row.message_templates as { name: string; body: string } | null);
    const payload = (row.payload as Record<string, unknown>) ?? {};
    const isManual = payload.manual === true;
    const directBody = typeof payload.body === "string" ? payload.body : null;
    const rendered =
      row.body_text ?? directBody ?? renderTemplate(template?.body ?? "", payload);
    const providerMessageId =
      typeof (row as { provider_message_id?: string | null }).provider_message_id === "string"
        ? ((row as { provider_message_id?: string | null }).provider_message_id as string)
        : null;
    return {
      id: row.id,
      providerMessageId,
      direction: (row.direction as "inbound" | "outbound") ?? "outbound",
      status: row.status as "queued" | "sent" | "failed" | "delivered" | "read",
      relatedType: row.related_type as
        | "recibo"
        | "promocion"
        | "evento"
        | "inscripcion"
        | "galeria"
        | null,
      templateName: template?.name ?? row.template_name,
      body: rendered,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      isManual,
      isDirect: payload.direct === true,
      mediaType: typeof payload.type === "string" ? (payload.type as string) : "chat",
      hasMedia: Boolean(payload.hasMedia),
      mediaMime: typeof payload.mediaMime === "string" ? (payload.mediaMime as string) : null,
      mediaFilename:
        typeof payload.mediaFilename === "string" ? (payload.mediaFilename as string) : null,
      mediaSize: typeof payload.mediaSize === "number" ? (payload.mediaSize as number) : null,
      location:
        payload.location && typeof payload.location === "object"
          ? (payload.location as {
              latitude: number;
              longitude: number;
              description: string | null;
            })
          : null,
      reactions: Array.isArray(payload.reactions)
        ? (payload.reactions as Array<{ emoji: string; fromMe: boolean; timestamp: number }>)
        : [],
      isForwarded: payload.isForwarded === true,
    };
  });

  // Buscar info del contacto
  const last9 = phone.slice(-9);
  const { data: guardianCandidates } = await supabase
    .from("guardians")
    .select(
      "id, full_name, phone, email, relationship, student_id, students(first_name, last_name, level, group_id, groups(name))",
    )
    .ilike("phone", `%${last9}%`)
    .limit(50);

  const matchedGuardian = (guardianCandidates ?? []).find(
    (candidate) => normalizeWhatsappNumber(candidate.phone) === phone,
  );

  const student = matchedGuardian
    ? Array.isArray(matchedGuardian.students)
      ? matchedGuardian.students[0]
      : matchedGuardian.students
    : null;
  const group = student
    ? Array.isArray(student.groups)
      ? student.groups[0]
      : (student.groups as { name?: string } | null)
    : null;

  const contactName =
    matchedGuardian?.full_name ?? messagesRaw?.[0]?.recipient_name ?? `+${phone}`;
  const studentName = student ? `${student.first_name} ${student.last_name}` : null;
  const studentId = matchedGuardian?.student_id ?? null;
  const lastInboundAt = messages.findLast?.((m) => m.direction === "inbound")?.createdAt ?? null;
  const windowOpen = isWithin24h(lastInboundAt);

  return (
    <ChatRoom
      contactName={contactName}
      phone={phone}
      recipientName={matchedGuardian?.full_name ?? null}
      studentName={studentName}
      studentId={studentId}
      groupName={group?.name ?? null}
      relationship={matchedGuardian?.relationship ?? null}
      isKnownContact={Boolean(matchedGuardian)}
      tags={Array.isArray(conversationMeta?.tags) ? conversationMeta.tags : []}
      internalNote={conversationMeta?.internal_note ?? null}
      marketingOptOut={Boolean(conversationMeta?.marketing_opt_out)}
      lastInboundAt={lastInboundAt}
      messages={messages}
      windowOpen={windowOpen}
      approvedTemplates={approvedTemplates}
    />
  );
}

function renderTemplate(body: string, variables: Record<string, unknown>): string {
  return body.replace(/\{\{(\d+|[a-zA-Z_]\w*)\}\}/g, (_, key) => {
    const value = variables[String(key)];
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : `{{${key}}}`;
  });
}
