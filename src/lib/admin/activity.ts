import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordAdminActivity(
  supabase: SupabaseClient,
  input: {
    eventType: string;
    entityType: string;
    entityId?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
    actorId?: string | null;
  },
) {
  await supabase.from("admin_activity_log").insert({
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
    metadata: input.metadata ?? {},
    actor_id: input.actorId ?? null,
  });
}
