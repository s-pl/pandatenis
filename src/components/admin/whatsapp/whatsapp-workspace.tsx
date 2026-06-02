"use client";

import { FileSpreadsheet, Inbox, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { StatsPanel } from "@/components/admin/stats-panel";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { WhatsappInbox } from "@/components/admin/whatsapp/inbox";
import { WhatsappTemplates } from "@/components/admin/whatsapp/templates";
import { WhatsappBulkSender } from "@/components/admin/whatsapp/bulk-sender";

export type Message = {
  id: string;
  recipientName: string;
  recipientPhone: string;
  templateName: string;
  status: "queued" | "sent" | "failed" | "delivered" | "read";
  relatedType: "recibo" | "promocion" | "evento" | "inscripcion" | "galeria";
  payload: Record<string, unknown>;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  attemptCount?: number | null;
  maxAttempts?: number | null;
  nextAttemptAt?: string | null;
  lockedAt?: string | null;
  deadLetterAt?: string | null;
  errorCode?: string | null;
  fbtraceId?: string | null;
};

export type Template = {
  id: string;
  name: string;
  category: "recibo" | "promocion" | "evento" | "inscripcion" | "galeria";
  body: string;
  metaTemplateName: string;
  language: string;
  metaStatus: "pending" | "approved" | "rejected";
  metaTemplateId: string | null;
  metaReviewStatus: string | null;
  metaRejectionReason: string | null;
  metaQualityScore: string | null;
  metaSyncedAt: string | null;
  componentsSchema: {
    body?: { variables?: string[] };
    header?: {
      type: "DOCUMENT" | "IMAGE" | "VIDEO";
      storagePath: string;
      filename: string;
      mimeType: string;
    } | null;
    raw?: unknown;
  } | null;
};

export type AudienceContact = {
  name: string;
  phone: string;
  studentName: string | null;
  level: string | null;
};

export type WhatsappOperations = {
  configured: boolean;
  approvedTemplates: number;
  pendingTemplates: number;
  rejectedTemplates: number;
  queued: number;
  dueQueued: number;
  locked: number;
  dead: number;
  failed: number;
  inbound24h: number;
  unreadInbound: number;
  lastInboundAt: string | null;
  oldestQueuedAt: string | null;
  recentErrors: Array<{
    id: string;
    recipientName: string;
    recipientPhone: string;
    templateName: string;
    errorMessage: string | null;
    errorCode: string | null;
    createdAt: string;
  }>;
};

const TAB_ITEMS: TabItem[] = [
  { value: "inbox", label: "Bandeja", icon: <Inbox className="h-4 w-4" /> },
  { value: "templates", label: "Plantillas", icon: <MessageSquareText className="h-4 w-4" /> },
  { value: "bulk", label: "Envío masivo", icon: <FileSpreadsheet className="h-4 w-4" /> },
];

export function WhatsappWorkspace({
  messages,
  templates,
  audience,
}: {
  messages: Message[];
  templates: Template[];
  audience: AudienceContact[];
  operations: WhatsappOperations;
}) {
  const [tab, setTab] = useState<string>("inbox");

  const queueStats = {
    queued: messages.filter((m) => m.status === "queued" && !m.deadLetterAt).length,
    locked: messages.filter((m) => m.lockedAt && m.status === "queued").length,
    dead: messages.filter((m) => m.deadLetterAt).length,
    failed: messages.filter((m) => m.status === "failed").length,
  };

  return (
    <>
      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {/* Resumen de cola (solo escritorio). */}
      <div className="hidden sm:block">
        <StatsPanel
          columns={4}
          stats={[
            { label: "En cola", value: queueStats.queued, tone: "info" },
            { label: "Procesando", value: queueStats.locked, tone: "warning" },
            { label: "Dead letter", value: queueStats.dead, tone: "danger" },
            { label: "Fallidos", value: queueStats.failed, tone: "danger" },
          ]}
        />
      </div>

      {tab === "inbox" && <WhatsappInbox messages={messages} />}
      {tab === "templates" && <WhatsappTemplates templates={templates} />}
      {tab === "bulk" && <WhatsappBulkSender templates={templates} audience={audience} />}
    </>
  );
}
