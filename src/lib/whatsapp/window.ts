import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Devuelve true si hay algún mensaje entrante de este teléfono dentro de las
 * últimas 24 horas. Esa es la "ventana de servicio" que abre Meta para que
 * podamos enviar texto libre / media; fuera de ella sólo se permiten plantillas
 * aprobadas.
 */
export async function hasOpen24hWindow(
  supabase: SupabaseClient,
  phone: string,
): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("created_at")
    .eq("recipient_phone", phone)
    .eq("direction", "inbound")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function lastInboundAt(
  supabase: SupabaseClient,
  phone: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("created_at")
    .eq("recipient_phone", phone)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.created_at;
}

export function isWithin24h(timestamp: string | null): boolean {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < WINDOW_MS;
}
