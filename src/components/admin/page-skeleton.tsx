import {
  SkeletonCard,
  SkeletonChart,
  SkeletonKpiGrid,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/skeleton";

/**
 * Esqueleto genérico de página de admin para los `loading.tsx`. Combina cabecera
 * + KPIs + (gráficas) + (tarjetas) + tabla según la forma de cada pantalla, dando
 * feedback inmediato en cada navegación mientras el server renderiza los datos.
 */
export function AdminPageSkeleton({
  kpis = 4,
  charts = 0,
  cards = 0,
  table = true,
  tableRows = 8,
}: {
  kpis?: number;
  charts?: number;
  /** Rejilla de tarjetas (para boards, detalle, formularios o galerías). */
  cards?: number;
  table?: boolean;
  tableRows?: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonPageHeader />
      {kpis > 0 && <SkeletonKpiGrid count={kpis} />}
      {charts > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: charts }).map((_, i) => (
            <SkeletonChart key={i} />
          ))}
        </div>
      )}
      {cards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cards }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}
      {table && <SkeletonTable rows={tableRows} />}
    </div>
  );
}
