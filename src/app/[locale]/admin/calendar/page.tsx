import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { CalendarBoard } from "@/components/admin/calendar/calendar-board";
import { requireAdmin } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("calendar") };
}
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.pages.calendar");

  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  start.setDate(1);
  const end = new Date();
  end.setMonth(end.getMonth() + 3);

  const { data } = await supabase
    .from("calendar_events")
    .select("id, title, type, starts_at, ends_at, description, color")
    .gte("starts_at", start.toISOString())
    .lte("starts_at", end.toISOString())
    .order("starts_at");

  const events = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type as "campamento" | "torneo" | "clase_especial" | "reunion" | "otro",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    description: row.description ?? "",
    color: row.color,
  }));

  return (
    <PageShell
      variant="tinted"
      title={t("title")}
      description={t("description")}
      meta={<Badge tone="primary" iconLeft={<CalendarDays className="h-3 w-3" />}>{t("eventsVisible", { count: events.length })}</Badge>}
    >
      <CalendarBoard events={events} />
    </PageShell>
  );
}
