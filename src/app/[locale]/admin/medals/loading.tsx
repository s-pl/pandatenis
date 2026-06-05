import { AdminPageSkeleton } from "@/components/admin/page-skeleton";

export default function Loading() {
  return <AdminPageSkeleton kpis={0} cards={8} table={false} />;
}
