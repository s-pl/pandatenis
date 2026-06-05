import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { SmsManager, type SmsHistoryItem, type SmsTemplate } from "@/components/admin/sms/sms-manager";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = { title: "SMS" };
export const dynamic = "force-dynamic";

export default async function SmsPage() {
  const { supabase } = await requireAdmin();

  const [templatesRes, historyRes] = await Promise.all([
    supabase
      .from("sms_templates")
      .select("id, name, body_es, body_en, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("sms_messages")
      .select("id, to_phone, body, kind, locale, status, created_at, sent_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const templates: SmsTemplate[] = (templatesRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    bodyEs: row.body_es,
    bodyEn: row.body_en,
  }));

  const history: SmsHistoryItem[] = (historyRes.data ?? []).map((row) => ({
    id: row.id,
    phone: row.to_phone,
    body: row.body,
    kind: row.kind,
    locale: row.locale === "en" ? "en" : "es",
    status: row.status,
    createdAt: row.created_at,
  }));

  return (
    <PageShell
      variant="tinted"
      title="SMS"
      description="Envía campañas por SMS a leads y alumnos (por idioma), gestiona plantillas y consulta el historial de envíos con su estado de entrega."
      meta={
        <Badge tone="primary" iconLeft={<MessageSquare className="h-3 w-3" />}>
          {history.length} envíos recientes
        </Badge>
      }
    >
      <SmsManager templates={templates} history={history} />
    </PageShell>
  );
}
