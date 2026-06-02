"use client";

import { AdminErrorState } from "@/components/admin/error-state";

export default function StudentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AdminErrorState error={error} reset={reset} />;
}
