"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

export function InvoiceToolbar({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div className="no-print mx-auto flex w-[210mm] max-w-full items-center justify-between gap-3 px-2 py-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--rule,#d9e2dc)] bg-white px-4 py-2 text-sm font-bold text-[#0e2a1f] shadow-sm transition-colors hover:bg-[#f1f6f3]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>
      <span className="hidden text-sm font-semibold text-[#5b6b63] sm:inline">{title}</span>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full bg-[#25924F] px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1f7d43]"
      >
        <Printer className="h-4 w-4" />
        Imprimir / Guardar PDF
      </button>
    </div>
  );
}
