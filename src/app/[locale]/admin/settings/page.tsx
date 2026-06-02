import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { requireAdmin } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("settings") };
}
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.settings");

  const { data } = await supabase
    .from("school_settings")
    .select(
      "student_goal, absence_alert_threshold, school_name, receipt_prefix, fiscal_name, fiscal_address, demo_seed_active",
    )
    .maybeSingle();

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={<Badge tone="primary" iconLeft={<Settings className="h-3 w-3" />}>Configuración global</Badge>}
    >
      <SettingsForm
        initial={{
          studentGoal: data?.student_goal ?? 120,
          absenceAlertThreshold: data?.absence_alert_threshold ?? 75,
          schoolName: data?.school_name ?? "Asociación Panda Tenis",
          receiptPrefix: data?.receipt_prefix ?? "PT",
          fiscalName: data?.fiscal_name ?? "",
          fiscalAddress: data?.fiscal_address ?? "",
        }}
        demoSeedActive={data?.demo_seed_active ?? false}
      />
    </PageShell>
  );
}
