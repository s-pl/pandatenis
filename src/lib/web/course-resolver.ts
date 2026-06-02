import "server-only";

import { getPublishedCourseBySlug, getPublishedCourses } from "@/lib/web/campus-data";
import { COURSES, type Course } from "@/lib/web/courses";

export type RegistrationKind = "escuela" | "campus" | "ambos";

const SCHOOL_FALLBACK: Course = {
  slug: "escuela-2025-2026",
  label: "Clases normales Panda Tenis",
  kind: "escuela",
  dates: "Curso regular",
  intro:
    "Completa esta ficha para confirmar los datos del alumno para las **clases normales de Panda Tenis**.",
  active: true,
};

export function pendingCampusCourse(slug = "campus-pendiente"): Course {
  return {
    slug,
    label: "Campus Panda Tenis",
    kind: "campus",
    dates: "Fechas acordadas por WhatsApp",
    intro:
      "Completa esta ficha para confirmar los datos del alumno para el **Campus Panda Tenis**.",
    active: true,
  };
}

export async function resolveInviteCourse(
  type: RegistrationKind,
  slug: string | null | undefined,
): Promise<Course> {
  if (slug) {
    const published = await getPublishedCourseBySlug(slug);
    if (published) return published;
    const legacy = COURSES.find((course) => course.slug === slug);
    if (legacy) return legacy;
  }

  if (type === "campus") return pendingCampusCourse(slug || undefined);

  return COURSES.find((course) => course.kind === "escuela") ?? SCHOOL_FALLBACK;
}

export async function resolvePublicCourse(slug: string): Promise<Course | null> {
  const published = await getPublishedCourseBySlug(slug);
  if (published?.active) return published;

  const courses = await getPublishedCourses();
  const fromPublishedList = courses.find((course) => course.slug === slug && course.active);
  if (fromPublishedList) return fromPublishedList;

  return COURSES.find((course) => course.slug === slug && course.active) ?? null;
}
