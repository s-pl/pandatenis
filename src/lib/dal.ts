import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, type AdminRole } from "@/lib/admin/roles";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
};

export const getSession = cache(async (): Promise<{
  supabase: SupabaseClient;
  user: User;
  profile: SessionUser;
} | null> => {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: auth } = await supabase.auth.getUser();
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
