import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CampusLeadCapture } from "@/components/web/campus-lead-capture";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string; source: string }> };

export const metadata: Metadata = {
  title: "Panda Tenis · Campus",
  robots: { index: false, follow: false },
};

/** Etiqueta legible por defecto cuando no hay sesión/Supabase configurado. */
const FALLBACK_LABELS: Record<string, string> = {
  carteles: "Campus Panda Tenis",
  flyers: "Campus Panda Tenis",
  chapas: "Campus Panda Tenis",
};

export default async function CampusLandingPage({ params }: PageProps) {
  const { source } = await params;
  const slug = source.toLowerCase();

  let campaignLabel = FALLBACK_LABELS[slug] ?? "Campus Panda Tenis";

  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("lead_sources")
      .select("name")
      .eq("slug", slug)
      .maybeSingle<{ name: string }>();
    // Sólo aceptamos slugs de origen conocidos: evita crear leads basura.
    if (!data) notFound();
    campaignLabel = "Campus Panda Tenis";
  }

  return (
    <div className="campus-landing">
      <div className="campus-landing-inner">
        <CampusLeadCapture sourceSlug={slug} campaignLabel={campaignLabel} />
      </div>
    </div>
  );
}
