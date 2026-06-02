"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { recordAdminActivity } from "@/lib/admin/activity";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const TaskKeySchema = z.string().trim().min(3).max(160);
const SnoozeSchema = z.object({
  taskKey: TaskKeySchema,
  hours: z.number().int().min(1).max(720).default(24),
});

const ActivitySchema = z.object({
  eventType: z.string().trim().min(1).max(80),
  entityType: z.string().trim().min(1).max(80),
  entityId: z.string().trim().max(120).optional().nullable(),
  summary: z.string().trim().min(1).max(300),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function fail<T>(error: unknown): ActionResult<T> {
  return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
}

export async function snoozeActionCenterItem(input: z.input<typeof SnoozeSchema>): Promise<ActionResult> {
  try {
    const data = SnoozeSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const snoozedUntil = new Date(Date.now() + data.hours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("admin_task_states").upsert(
      {
        task_key: data.taskKey,
        snoozed_until: snoozedUntil,
        dismissed_at: null,
        updated_by: profile.id,
      },
      { onConflict: "task_key" },
    );
    if (error) throw error;
    await recordAdminActivity(supabase, {
      eventType: "task_snoozed",
      entityType: "action_center",
      entityId: data.taskKey,
      summary: `Tarea pospuesta ${data.hours} h`,
      actorId: profile.id,
      metadata: { taskKey: data.taskKey, snoozedUntil },
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function dismissActionCenterItem(taskKey: string): Promise<ActionResult> {
  try {
    const parsed = TaskKeySchema.parse(taskKey);
    const { supabase, profile } = await requireAdmin();
    const { error } = await supabase.from("admin_task_states").upsert(
      {
        task_key: parsed,
        dismissed_at: new Date().toISOString(),
        snoozed_until: null,
        updated_by: profile.id,
      },
      { onConflict: "task_key" },
    );
    if (error) throw error;
    await recordAdminActivity(supabase, {
      eventType: "task_dismissed",
      entityType: "action_center",
      entityId: parsed,
      summary: "Tarea ocultada",
      actorId: profile.id,
      metadata: { taskKey: parsed },
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function logAdminActivity(input: z.input<typeof ActivitySchema>): Promise<ActionResult> {
  try {
    const data = ActivitySchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    await recordAdminActivity(supabase, {
      eventType: data.eventType,
      entityType: data.entityType,
      entityId: data.entityId,
      summary: data.summary,
      metadata: data.metadata,
      actorId: profile.id,
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
