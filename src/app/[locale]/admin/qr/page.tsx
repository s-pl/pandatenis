import type { Metadata } from "next";
import { QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { QrManager, type QrCampaign } from "@/components/admin/qr/qr-manager";
import { requireAdmin } from "@/lib/dal";
import { appBaseUrl } from "@/lib/base-url";

export const metadata: Metadata = { title: "Códigos QR" };
export const dynamic = "force-dynamic";

/** Campañas con QR físico. El slug coincide con el origen en lead_sources. */
const CAMPAIGN_SLUGS = ["carteles", "flyers", "chapas"] as const;

const CAMPAIGN_LABELS: Record<string, { name: string; hint: string }> = {
  carteles: { name: "Campus · Carteles", hint: "Para carteles en la calle y comercios." },
  flyers: { name: "Campus · Flyers", hint: "Para octavillas y reparto en mano." },
  chapas: { name: "Campus · Chapas", hint: "Para chapas promocionales y merchandising." },
};

export default async function QrCodesPage() {
  const { supabase } = await requireAdmin();
  const base = await appBaseUrl();

  const { data } = await supabase
    .from("lead_sources")
    .select("id, slug, name")
    .in("slug", CAMPAIGN_SLUGS as unknown as string[]);

  const bySlug = new Map((data ?? []).map((row) => [row.slug as string, row]));

  const campaigns: QrCampaign[] = CAMPAIGN_SLUGS.map((slug) => ({
    slug,
    name: CAMPAIGN_LABELS[slug]?.name ?? slug,
    hint: CAMPAIGN_LABELS[slug]?.hint ?? "",
    // El QR apunta a la landing con selección de idioma. Un único QR por campaña.
    url: `${base}/es/c/${slug}`,
    configured: bySlug.has(slug),
  }));

  const allConfigured = campaigns.every((c) => c.configured);

  return (
    <PageShell
      variant="tinted"
      title="Códigos QR del Campus"
      description="Un único QR por campaña. Al escanearlo, el visitante elige idioma, deja sus datos (se crea un Lead automáticamente) y se abre WhatsApp. Descarga el PNG e incorpóralo a tus materiales."
      meta={
        <Badge tone={allConfigured ? "primary" : "warning"} iconLeft={<QrCode className="h-3 w-3" />}>
          {campaigns.length} campañas
        </Badge>
      }
    >
      <QrManager campaigns={campaigns} />
    </PageShell>
  );
}
