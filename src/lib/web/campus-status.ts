export type CampusStatus = "upcoming" | "active" | "finished";

/**
 * Calcula el estado de una convocatoria a partir de sus fechas reales.
 * Las fechas son strings ISO `YYYY-MM-DD` (columnas `date` de Postgres), por lo
 * que la comparación lexicográfica equivale a la cronológica.
 *
 *  - sin fechas            → null  (no se muestra badge)
 *  - hoy < inicio          → "upcoming"  (Próximamente)
 *  - inicio ≤ hoy ≤ fin    → "active"    (En curso)
 *  - hoy > fin             → "finished"  (Finalizado)
 */
export function computeCampusStatus(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
  today: string = new Date().toISOString().slice(0, 10),
): CampusStatus | null {
  if (!startsOn && !endsOn) return null;
  const start = startsOn || endsOn!;
  const end = endsOn || startsOn!;
  if (today < start) return "upcoming";
  if (today > end) return "finished";
  return "active";
}
