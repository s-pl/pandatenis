import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseBrowserEnv } from "@/lib/supabase/config";
import { isAdminRole, type AdminRole } from "@/lib/admin/roles";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
};

/**
 * Token Bearer de la cabecera Authorization (lo usa la app móvil). La web SSR
 * nunca lo envía, así que el flujo por cookies queda intacto.
 */
async function bearerToken(): Promise<string | null> {
  try {
    const auth = (await headers()).get("authorization") ?? (await headers()).get("Authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  } catch {
    /* fuera de contexto de request */
  }
  return null;
}

/** Cliente Supabase autenticado con el JWT del usuario (RLS según su rol). */
function createBearerClient(token: string): SupabaseClient {
  const { url, anonKey } = getSupabaseBrowserEnv();
  return createSupabaseClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export const getSession = cache(async (): Promise<{
  supabase: SupabaseClient;
  user: User;
  profile: SessionUser;
} | null> => {
  const token = await bearerToken();
  const supabase = token ? createBearerClient(token) : await createClient();

  const { data: auth } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, email")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile || !isAdminRole(profile.role)) return null;

  return {
    supabase,
    user: auth.user,
    profile: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
    },
  };
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.role !== "admin") redirect("/sin-acceso");
  return session;
}

export async function requireStaff() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
