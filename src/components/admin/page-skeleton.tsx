import {
  SkeletonChart,
  SkeletonKpiGrid,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/skeleton";

/**
 * Esqueleto genérico de página de admin para los `loading.tsx`. Combina cabecera
 * + KPIs + (gráficas) + tabla según la forma de cada pantalla, dando feedback
 * inmediato en cada navegación mientras el server renderiza los datos.
 */
export function AdminPageSkeleton({
  kpis = 4,
  charts = 0,
  table = true,
  tableRows = 8,
}: {
  kpis?: number;
  charts?: number;
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
      {table && <SkeletonTable rows={tableRows} />}
    </div>
  );
}
