import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { COURSES as LEGACY_COURSES, type Course } from "@/lib/web/courses";
import { computeCampusStatus } from "@/lib/web/campus-status";

/**
 * Lee las convocatorias publicadas en la BD y devuelve el mismo shape `Course`
 * que el resto del código del sitio público ya espera. Si Supabase no está
 * configurado (entorno local de desarrollo sin .env) o si no hay filas
 * publicadas, cae al array hardcoded en `courses.ts` para no dejar la web
 * en blanco.
 */
export async function getPublishedCourses(): Promise<Course[]> {
  if (!isSupabaseConfigured()) {
    return LEGACY_COURSES.filter((c) => c.active);
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("campus_courses")
      .select("slug, title, kind, dates_label, intro, is_public, sort_order, starts_on, ends_on")
      .eq("is_public", true)
      .order("sort_order")
      .order("title");
    if (error || !data || data.length === 0) {
      return LEGACY_COURSES.filter((c) => c.active);
    }
    return data.map((row) => {
      const startsOn = (row.starts_on as string | null) ?? null;
      const endsOn = (row.ends_on as string | null) ?? null;
      return {
        slug: row.slug as string,
        label: row.title as string,
        kind: (row.kind as "campus" | "escuela") ?? "campus",
        dates: (row.dates_label as string) ?? "",
        intro: (row.intro as string) ?? "",
        active: true,
        startsOn,
        endsOn,
        status: computeCampusStatus(startsOn, endsOn),
      };
    });
  } catch {
    return LEGACY_COURSES.filter((c) => c.active);
  }
}

export async function getPublishedCourseBySlug(slug: string): Promise<Course | null> {
  const courses = await getPublishedCourses();
  return courses.find((c) => c.slug === slug) ?? null;
}
