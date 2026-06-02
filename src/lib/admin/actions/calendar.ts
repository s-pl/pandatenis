"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const EventSchema = z.object({
  title: z.string().trim().min(1),
  type: z.enum(["campamento", "torneo", "clase_especial", "reunion", "otro"]),
  startsAt: z.string(),
  endsAt: z.string(),
  description: z.string().trim().optional().default(""),
  color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/),
});

export type EventInput = z.output<typeof EventSchema>;
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCalendarEvent(input: EventInput): Promise<ActionResult> {
  try {
    const data = EventSchema.parse(input);
    const { supabase, profile } = await requireAdmin();
    const { error } = await supabase.from("calendar_events").insert({
      title: data.title,
      type: data.type,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      description: data.description || null,
      color: data.color,
      created_by: profile.id,
    });
    if (error) throw error;
    revalidatePath("/admin/calendar");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("calendar_events").delete().eq("id", eventId);
    if (error) throw error;
    revalidatePath("/admin/calendar");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}
