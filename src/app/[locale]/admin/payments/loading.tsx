import { AdminPageSkeleton } from "@/components/admin/page-skeleton";

export default function Loading() {
  return <AdminPageSkeleton kpis={4} table tableRows={10} />;
}
