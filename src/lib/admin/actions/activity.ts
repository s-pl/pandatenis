"use server";

import { requireAdmin } from "@/lib/dal";

export type ActivityItem = {
  id: string;
  summary: string;
  eventType: string;
  createdAt: string;
};

/** Últimos eventos del registro de actividad del panel (para la campana). */
export async function getRecentActivity(): Promise<ActivityItem[]> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("admin_activity_log")
    .select("id, summary, event_type, created_at")
    .order("created_at", { ascending: false })
    .limit(15);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    summary: (r.summary as string) ?? "",
    eventType: (r.event_type as string) ?? "",
    createdAt: r.created_at as string,
  }));
}
