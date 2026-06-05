import { AdminPageSkeleton } from "@/components/admin/page-skeleton";

export default function Loading() {
  return <AdminPageSkeleton kpis={3} cards={6} table={false} />;
}
