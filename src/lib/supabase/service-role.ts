import "server-only";

import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Cliente Supabase con la service role key. Sólo debe usarse en code paths
 * server-side que no tienen sesión de usuario (por ejemplo webhooks externos).
 * Bypassea RLS — usar con cuidado.
 */
export function createServiceRoleClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Service role no configurado: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  cached = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
