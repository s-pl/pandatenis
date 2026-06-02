import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { MetaConnection } from "@/components/admin/whatsapp/meta-connection";
import { requireAdmin } from "@/lib/dal";
import { isWhatsappConfigured } from "@/lib/whatsapp";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("connection") };
}
export const dynamic = "force-dynamic";

export default async function WhatsappConnectionPage() {
  await requireAdmin();
  const tPage = await getTranslations("admin.pages.whatsappConnection");
  const configured = isWhatsappConfigured();

  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <Badge tone={configured ? "primary" : "warning"} iconLeft={<Megaphone className="h-3 w-3" />}>
          {configured ? "Meta configurado" : "Meta sin configurar"}
        </Badge>
      }
    >
      <MetaConnection initialOrigin={origin} />
    </PageShell>
  );
}
