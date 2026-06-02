"use client";

import { Link } from "@/i18n/navigation";
import { MessageCircle, ChevronRight } from "lucide-react";

/**
 * Yellow CTA banner at the top of the dashboard — Badgie's "¿Qué quieres
 * comunicar?" pattern. Mobile-first: icon + input fill the row, the
 * "Expandir" text is hidden on small screens (chevron is enough).
 */
export function CommunicateBanner() {
  return (
    <Link
      href="/admin/whatsapp"
      className="flex items-center gap-2 rounded-xl bg-[var(--accent)] p-2 shadow-[var(--shadow-sm)] active:opacity-90 sm:gap-3 sm:p-3"
    >
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-foreground text-[var(--accent)]">
        <MessageCircle className="h-4 w-4" />
      </span>

      <span className="flex-1 truncate rounded-lg bg-[var(--surface)] px-3 py-2.5 text-[13.5px] text-foreground/70">
        ¿Qué quieres comunicar?
      </span>

      <span className="hidden items-center gap-1 px-2 text-[12.5px] font-bold text-foreground sm:inline-flex">
        Expandir
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
      <ChevronRight className="h-5 w-5 text-foreground sm:hidden" />
    </Link>
  );
}
