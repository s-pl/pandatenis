import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { ChatsList } from "@/components/admin/whatsapp/chats-list";
import { requireAdmin } from "@/lib/dal";
import { normalizeWhatsappNumber } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("chats") };
}
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  direction: "inbound" | "outbound";
  recipient_name: string;
  recipient_phone: string;
  body_text: string | null;
  template_name: string;
  status: string;
  read_at: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
};

export default async function ChatsListPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.whatsappChats");

  // Cargamos los últimos 200 mensajes y agrupamos en server por teléfono.
  // Para escuelas pequeñas (≤100 familias activas) esto cubre el listado de
  // conversaciones recientes. Si el admin abre un chat antiguo por URL
  // directa, su histórico se carga en /chats/[phone].
  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select(
      "id, direction, recipient_name, recipient_phone, body_text, template_name, status, read_at, created_at, payload",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  type Conversation = {
    phone: string;
    contactName: string;
    lastMessage: string;
    lastMessageAt: string;
    lastDirection: "inbound" | "outbound";
    lastStatus: string;
    unread: number;
    total: number;
    needsReply: boolean;
    isKnownContact: boolean;
    tags: string[];
    internalNote: string | null;
    marketingOptOut: boolean;
  };

  const byPhone = new Map<string, Conversation>();

  for (const row of (messages ?? []) as Row[]) {
    const phone = row.recipient_phone;
    if (!phone) continue;
    const existing = byPhone.get(phone);
    const text =
      row.body_text ??
      ((row.payload as { body?: string } | null)?.body ?? "") ??
      "";
    if (!existing) {
      byPhone.set(phone, {
        phone,
        contactName: row.recipient_name || `+${phone}`,
        lastMessage: text || (row.direction === "inbound" ? "[Mensaje]" : `Plantilla ${row.template_name}`),
        lastMessageAt: row.created_at,
        lastDirection: row.direction,
        lastStatus: row.status,
        unread: row.direction === "inbound" && !row.read_at ? 1 : 0,
        total: 1,
        needsReply: row.direction === "inbound",
        isKnownContact: false,
        tags: [],
        internalNote: null,
        marketingOptOut: false,
      });
    } else {
      existing.total++;
      if (row.direction === "inbound" && !row.read_at) existing.unread++;
      // Si el nombre actual es genérico y este row tiene uno mejor, lo usamos
      if ((existing.contactName.startsWith("+") || existing.contactName === phone) && row.recipient_name && !row.recipient_name.startsWith("+")) {
        existing.contactName = row.recipient_name;
      }
    }
  }

  // Cargamos datos de tutores en una sola query usando últimos 9 dígitos para hacer match
  const phones = Array.from(byPhone.keys());
  if (phones.length > 0) {
    const last9List = phones.map((p) => p.slice(-9));
    const orFilters = last9List.map((d) => `phone.ilike.%${d}%`).join(",");
    const [guardiansRes, conversationsRes] = await Promise.all([
      supabase
        .from("guardians")
        .select("full_name, phone, students(first_name, last_name)")
        .or(orFilters)
        .limit(phones.length * 4),
      supabase
        .from("whatsapp_conversations")
        .select("phone, display_name, tags, internal_note, marketing_opt_out")
        .in("phone", phones),
    ]);

    for (const conversation of conversationsRes.data ?? []) {
      const conv = byPhone.get(conversation.phone);
      if (!conv) continue;
      conv.tags = Array.isArray(conversation.tags) ? conversation.tags : [];
      conv.internalNote = conversation.internal_note;
      conv.marketingOptOut = Boolean(conversation.marketing_opt_out);
      if (conversation.display_name && conv.contactName.startsWith("+")) {
        conv.contactName = conversation.display_name;
      }
    }

    for (const guardian of guardiansRes.data ?? []) {
      const normalized = normalizeWhatsappNumber(guardian.phone);
      if (!normalized) continue;
      const conv = byPhone.get(normalized);
      if (conv) {
        conv.contactName = guardian.full_name;
        conv.isKnownContact = true;
      }
    }
  }

  const conversations = Array.from(byPhone.values()).sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );

  const totalUnread = conversations.reduce((acc, c) => acc + c.unread, 0);

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <>
          <Badge tone="primary" iconLeft={<MessageCircle className="h-3 w-3" />}>
            {conversations.length} chats
          </Badge>
          {totalUnread > 0 && <Badge tone="danger">{totalUnread} sin leer</Badge>}
        </>
      }
    >
      <ChatsList conversations={conversations} />
    </PageShell>
  );
}
