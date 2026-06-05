import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { PromotionsManager } from "@/components/admin/promotions/promotions-manager";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = { title: "Promociones" };
export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const { supabase } = await requireAdmin();

  const [promosRes, studentsRes] = await Promise.all([
    supabase
      .from("promotions")
      .select("id, slug, title_es, title_en, poster_url, whatsapp_msg_es, whatsapp_msg_en, active, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("students")
      .select("id, first_name, last_name, comm_locale, active, guardians(phone)")
      .eq("active", true)
      .order("first_name"),
  ]);

  const promotions = (promosRes.data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    titleEs: row.title_es,
    titleEn: row.title_en,
    posterUrl: row.poster_url,
    whatsappMsgEs: row.whatsapp_msg_es ?? "",
    whatsappMsgEn: row.whatsapp_msg_en ?? "",
    active: row.active,
    createdAt: row.created_at,
  }));

  const students = (studentsRes.data ?? [])
    .map((row) => {
      const phone =
        (row.guardians as { phone: string | null }[] | null)?.[0]?.phone ?? null;
      return {
        id: row.id,
        fullName: `${row.first_name} ${row.last_name}`,
        commLocale: (row.comm_locale === "en" ? "en" : "es") as "es" | "en",
        phone,
      };
    })
    .filter((s) => s.phone);

  return (
    <PageShell
      variant="tinted"
      title="Promociones"
      description="Crea carteles y difúndelos por SMS. El cliente abre el cartel y reserva por WhatsApp."
      meta={
        <Badge tone="primary" iconLeft={<Megaphone className="h-3 w-3" />}>
          {promotions.length} promociones
        </Badge>
      }
    >
      <PromotionsManager promotions={promotions} students={students} />
    </PageShell>
  );
}
