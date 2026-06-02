import { CalendarDays, Flower2, Snowflake, Sun, TreePine, type LucideIcon } from "lucide-react";

/** Icono representativo según el nombre de la convocatoria (con fallback). */
export function seasonIconFor(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (/(verano|summer)/.test(l)) return Sun;
  if (/(navidad|christmas)/.test(l)) return TreePine;
  if (/(semana santa|pascua|easter)/.test(l)) return Flower2;
  if (/(semana blanca|blanca|nieve|snow|white week)/.test(l)) return Snowflake;
  return CalendarDays;
}
