import type { CampusStatus } from "@/lib/web/campus-status";

export type CourseKind = "escuela" | "campus" | "ambos";

export type Course = {
  slug: string;
  label: string;
  kind: CourseKind;
  dates: string;
  intro: string;
  active: boolean;
  /** Fechas reales (ISO `YYYY-MM-DD`) que conducen el estado. */
  startsOn?: string | null;
  endsOn?: string | null;
  /** Estado calculado a partir de las fechas; null si no hay fechas. */
  status?: CampusStatus | null;
};

export const COURSES: Course[] = [
  {
    slug: "escuela-2025-2026",
    label: "Escuela de Tenis - Curso 2025/26",
    kind: "escuela",
    dates: "Septiembre 2025 - Junio 2026",
    intro:
      "Gracias por inscribirte a la **Escuela de Tenis Panda Tenis** (curso 2025/26). Con este breve formulario tendremos toda la informacion necesaria para empezar a trabajar juntos.",
    active: true,
  },
  {
    slug: "campus-semana-santa-2026",
    label: "Campus Semana Santa 2026",
    kind: "campus",
    dates: "30 marzo - 3 abril 2026",
    intro:
      "Gracias por inscribirte al **Campus Semana Santa 2026** (30 marzo - 3 abril). Con este breve formulario tendremos toda la informacion necesaria para empezar a trabajar juntos.",
    active: true,
  },
  {
    slug: "campus-verano-2026",
    label: "Campus Verano 2026",
    kind: "campus",
    dates: "Julio - Agosto 2026",
    intro:
      "Gracias por inscribirte al **Campus Verano 2026**. Con este breve formulario tendremos toda la informacion necesaria para empezar a trabajar juntos.",
    active: true,
  },
  {
    slug: "campus-navidad-2026",
    label: "Campus Navidad 2026",
    kind: "campus",
    dates: "Diciembre 2026",
    intro:
      "Gracias por inscribirte al **Campus Navidad 2026**. Con este breve formulario tendremos toda la informacion necesaria para empezar a trabajar juntos.",
    active: true,
  },
];

export function getCourseBySlug(slug: string): Course | null {
  return COURSES.find((c) => c.slug === slug) ?? null;
}

export function getActiveCourses(): Course[] {
  return COURSES.filter((c) => c.active);
}
