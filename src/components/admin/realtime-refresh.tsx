"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Refresca la ruta actual cuando cambian ciertas tablas en Supabase (realtime).
 * Reutiliza el patrón de la lista de chats: debounce + solo si la pestaña está
 * visible. Útil para que el dashboard refleje cobros/altas sin recargar.
 */
export function RealtimeRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  const tablesKey = tables.join(",");

  useEffect(() => {
    const list = tablesKey.split(",").filter(Boolean);
    if (list.length === 0) return;
    const supabase = createClient();
    let debounce: ReturnType<typeof setTimeout> | null = null;

    function bump() {
      if (document.visibilityState !== "visible") return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        try {
          router.refresh();
        } catch {
          /* ignore */
        }
      }, 700);
    }

    const channel = supabase.channel("admin-realtime-refresh");
    for (const table of list) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, bump);
    }
    channel.subscribe();

    return () => {
      if (debounce) clearTimeout(debounce);
      void supabase.removeChannel(channel);
    };
  }, [router, tablesKey]);

  return null;
}
