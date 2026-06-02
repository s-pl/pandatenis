import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import {
  WhatsappWorkspace,
  type Message,
  type Template,
  type WhatsappOperations,
} from "@/components/admin/whatsapp/whatsapp-workspace";
import { requireAdmin } from "@/lib/dal";
import { isWhatsappConfigured } from "@/lib/whatsapp";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("whatsapp") };
}
export const dynamic = "force-dynamic";

export default async function WhatsappPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.whatsapp");
  const nowIso = new Date().toISOString();
  const since24h = new Date(Date.parse(nowIso) - 24 * 60 * 60 * 1000).toISOString();

  const [
    messagesRes,
    templatesRes,
    guardiansRes,
    inbound24hRes,
    unreadInboundRes,
    lastInboundRes,
  ] = await Promise.all([
    supabase
      .from("whatsapp_messages")
      .select("id, recipient_name, recipient_phone, template_name, status, related_type, payload, provider_message_id, error_message, created_at, sent_at, delivered_at, attempt_count, max_attempts, next_attempt_at, locked_at, dead_letter_at, error_code, fbtrace_id, meta_pricing_category")
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("message_templates")
      .select("id, name, category, body, meta_template_name, language, meta_status, meta_template_id, meta_review_status, meta_rejection_reason, meta_quality_score, meta_synced_at, components_schema")
      .order("name"),
    supabase
      .from("guardians")
      .select("full_name, phone, students(first_name, last_name, level, group_id)")
      .order("full_name"),
    supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .gte("created_at", since24h),
    supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .is("read_at", null),
    supabase
      .from("whatsapp_messages")
      .select("created_at")
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (messagesRes.error) throw new Error(`No se pudieron cargar mensajes WhatsApp: ${messagesRes.error.message}`);
  if (templatesRes.error) throw new Error(`No se pudieron cargar plantillas WhatsApp: ${templatesRes.error.message}`);
  if (guardiansRes.error) throw new Error(`No se pudo cargar audiencia WhatsApp: ${guardiansRes.error.message}`);
  if (inbound24hRes.error) throw new Error(`No se pudo calcular inbound 24h: ${inbound24hRes.error.message}`);
  if (unreadInboundRes.error) throw new Error(`No se pudo calcular inbound sin leer: ${unreadInboundRes.error.message}`);
  if (lastInboundRes.error) throw new Error(`No se pudo cargar último inbound: ${lastInboundRes.error.message}`);

  const messages: Message[] = (messagesRes.data ?? []).map((row) => ({
    id: row.id,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    templateName: row.template_name,
    status: row.status as "queued" | "sent" | "failed" | "delivered" | "read",
    relatedType: row.related_type as "recibo" | "promocion" | "evento" | "inscripcion" | "galeria",
    payload: row.payload ?? {},
    providerMessageId: row.provider_message_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    lockedAt: row.locked_at,
    deadLetterAt: row.dead_letter_at,
    errorCode: row.error_code,
    fbtraceId: row.fbtrace_id,
  }));

  const templates: Template[] = (templatesRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category as "recibo" | "promocion" | "evento" | "inscripcion" | "galeria",
    body: row.body,
    metaTemplateName: row.meta_template_name,
    language: row.language ?? "es",
    metaStatus: (row.meta_status ?? "pending") as "pending" | "approved" | "rejected",
    metaTemplateId: row.meta_template_id,
    metaReviewStatus: row.meta_review_status,
    metaRejectionReason: row.meta_rejection_reason,
    metaQualityScore: row.meta_quality_score,
    metaSyncedAt: row.meta_synced_at,
    componentsSchema: (row.components_schema ?? null) as
      | {
          body?: { variables?: string[] };
          header?: {
            type: "DOCUMENT" | "IMAGE" | "VIDEO";
            storagePath: string;
            filename: string;
            mimeType: string;
          } | null;
          raw?: unknown;
        }
      | null,
  }));

  const audience = (guardiansRes.data ?? []).map((row) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    return {
      name: row.full_name,
      phone: row.phone,
      studentName: student ? `${student.first_name} ${student.last_name}` : null,
      level: student?.level ?? null,
    };
  });

  const queuedMessages = messages.filter((m) => m.status === "queued" && !m.deadLetterAt);
  const dueQueued = queuedMessages.filter(
    (m) => !m.nextAttemptAt || m.nextAttemptAt <= nowIso,
  ).length;
  const oldestQueuedAt =
    queuedMessages.length > 0
      ? queuedMessages.reduce(
          (oldest, message) => (!oldest || message.createdAt < oldest ? message.createdAt : oldest),
          "",
        )
      : null;
  const recentErrors = messages
    .filter((message) => message.status === "failed" || Boolean(message.deadLetterAt))
    .slice(0, 5)
    .map((message) => ({
      id: message.id,
      recipientName: message.recipientName,
      recipientPhone: message.recipientPhone,
      templateName: message.templateName,
      errorMessage: message.errorMessage,
      errorCode: message.errorCode ?? null,
      createdAt: message.createdAt,
    }));

  const operations: WhatsappOperations = {
    configured: isWhatsappConfigured(),
    approvedTemplates: templates.filter((template) => template.metaStatus === "approved").length,
    pendingTemplates: templates.filter((template) => template.metaStatus === "pending").length,
    rejectedTemplates: templates.filter((template) => template.metaStatus === "rejected").length,
    queued: queuedMessages.length,
    dueQueued,
    locked: messages.filter((m) => m.lockedAt && m.status === "queued").length,
    dead: messages.filter((m) => m.deadLetterAt).length,
    failed: messages.filter((m) => m.status === "failed").length,
    inbound24h: inbound24hRes.count ?? 0,
    unreadInbound: unreadInboundRes.count ?? 0,
    lastInboundAt: lastInboundRes.data?.created_at ?? null,
    oldestQueuedAt,
    recentErrors,
  };

  const counters = {
    total: messages.length,
    sent: messages.filter((m) => m.status === "sent" || m.status === "delivered" || m.status === "read").length,
    failed: messages.filter((m) => m.status === "failed").length,
    queued: messages.filter((m) => m.status === "queued").length,
  };

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <>
          <Badge tone="primary" iconLeft={<MessageCircle className="h-3 w-3" />}>
            {counters.total} mensajes
          </Badge>
          <Badge tone="success">{counters.sent} entregados</Badge>
          {counters.queued > 0 && <Badge tone="info">{counters.queued} en cola</Badge>}
          {counters.failed > 0 && <Badge tone="danger">{counters.failed} fallidos</Badge>}
        </>
      }
    >
      <WhatsappWorkspace
        messages={messages}
        templates={templates}
        audience={audience}
        operations={operations}
      />
    </PageShell>
  );
}
