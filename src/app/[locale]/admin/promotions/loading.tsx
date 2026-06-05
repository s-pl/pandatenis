import { AdminPageSkeleton } from "@/components/admin/page-skeleton";

export default function Loading() {
  return <AdminPageSkeleton kpis={0} cards={6} table={false} />;
}
