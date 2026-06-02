import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { requireAdmin } from "@/lib/dal";
import {
  CampusCardsGrid,
  type CampusCardRow,
} from "@/components/admin/campus/campus-cards-grid";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("campus") };
}
export const dynamic = "force-dynamic";

export default async function CampusPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.campus");

  const [coursesRes, registrationsRes] = await Promise.all([
    supabase
      .from("campus_courses")
      .select("id, slug, title, dates_label, starts_on, ends_on, is_public, sort_order")
      .eq("kind", "campus")
      .order("sort_order")
      .order("title"),
    supabase
      .from("registrations")
      .select("course_slug")
      .in("type", ["campus", "ambos"]),
  ]);

  // Conteo de inscripciones por slug de campus (agregación en memoria).
  const countBySlug = new Map<string, number>();
  for (const row of registrationsRes.data ?? []) {
    if (!row.course_slug) continue;
    countBySlug.set(row.course_slug, (countBySlug.get(row.course_slug) ?? 0) + 1);
  }

  const courses: CampusCardRow[] = (coursesRes.data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    datesLabel: (row.dates_label as string) ?? "",
    startsOn: (row.starts_on as string | null) ?? null,
    endsOn: (row.ends_on as string | null) ?? null,
    isPublic: Boolean(row.is_public),
    registrationCount: countBySlug.get(row.slug as string) ?? 0,
  }));

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <Badge tone="warning" iconLeft={<Sun className="h-3 w-3" />}>
          {courses.length} campus
        </Badge>
      }
    >
      <CampusCardsGrid courses={courses} />
    </PageShell>
  );
}
