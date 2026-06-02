"use client";

import { AdminErrorState } from "@/components/admin/error-state";

export default function WhatsappError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AdminErrorState error={error} reset={reset} />;
}
