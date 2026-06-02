import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Globe, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/admin/page-shell";
import { LeadsManager } from "@/components/admin/leads/leads-manager";
import type { ApprovedTemplate } from "@/components/admin/whatsapp/template-composer";
import { requireAdmin } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("leads") };
}
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.leads");

  const [leadsRes, sourcesRes, profilesRes, approvedTemplatesRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, full_name, phone, child_age, interest, source_id, observations, status, next_action_at, assigned_to, lost_reason, whatsapp_consent, marketing_consent, consent_source, consent_text, consent_at, created_at, lead_sources(name)")
      .order("created_at", { ascending: false })
      .limit(3000),
    supabase.from("lead_sources").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase
      .from("message_templates")
      .select("id, name, body, language, category, components_schema")
      .eq("meta_status", "approved")
      .order("name"),
  ]);

  const leads = (leadsRes.data ?? []).map((row) => {
    const source = Array.isArray(row.lead_sources) ? row.lead_sources[0] : row.lead_sources;
    return {
      id: row.id,
      fullName: row.full_name,
      phone: row.phone,
      childAge: row.child_age,
      interest: row.interest as "escuela" | "campus" | "ambos",
      sourceId: row.source_id,
      sourceName: source?.name ?? "Sin clasificar",
      observations: row.observations ?? "",
      status: row.status as
        | "nuevo"
        | "contactado"
        | "interesado"
        | "prueba_agendada"
        | "convertido"
        | "perdido",
      nextActionAt: row.next_action_at ?? null,
      assignedTo: row.assigned_to ?? null,
      lostReason: row.lost_reason ?? null,
      whatsappConsent: Boolean(row.whatsapp_consent),
      marketingConsent: Boolean(row.marketing_consent),
      consentSource: row.consent_source ?? null,
      consentText: row.consent_text ?? null,
      consentAt: row.consent_at ?? null,
      createdAt: row.created_at,
    };
  });

  const sources = (sourcesRes.data ?? []).map((row) => ({ id: row.id, name: row.name }));
  const profiles = (profilesRes.data ?? []).map((row) => ({ id: row.id, fullName: row.full_name }));
  const approvedTemplates: ApprovedTemplate[] = (approvedTemplatesRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    body: row.body,
    language: row.language ?? "es",
    category: row.category,
    componentsSchema: (row.components_schema ?? null) as
      | { body?: { variables?: string[] } }
      | null,
  }));
  const newCount = leads.filter((lead) => lead.status === "nuevo").length;
  const webCount = leads.filter((lead) => lead.sourceName.toLowerCase() === "web").length;

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <>
          <Badge tone="primary" iconLeft={<PhoneCall className="h-3 w-3" />}>
            {leads.length} contactos
          </Badge>
          {newCount > 0 && <Badge tone="warning">{newCount} pendientes de llamar</Badge>}
          {webCount > 0 && (
            <Badge tone="info" iconLeft={<Globe className="h-3 w-3" />}>
              {webCount} desde la web
            </Badge>
          )}
        </>
      }
      actions={
        <Link href="/" target="_blank">
          <Button variant="secondary" size="sm" iconLeft={<Globe className="h-4 w-4" />}>
            Ver web pública
          </Button>
        </Link>
      }
    >
      <LeadsManager
        leads={leads}
        sources={sources}
        profiles={profiles}
        approvedTemplates={approvedTemplates}
        referenceNow={new Date().toISOString()}
      />
    </PageShell>
  );
}
