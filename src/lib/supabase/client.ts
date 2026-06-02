"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "@/lib/supabase/config";

export function createClient() {
  const { url, anonKey } = getSupabaseBrowserEnv();
  return createBrowserClient(url, anonKey);
}
