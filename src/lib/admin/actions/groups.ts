"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const GroupSchema = z.object({
  name: z.string().trim().min(1),
  level: z.enum(["Rojo", "Naranja", "Verde", "Amarillo"]),
  professorId: z.string().uuid().optional().nullable(),
  schedule: z.string().trim().min(1),
  capacity: z.coerce.number().min(1),
  location: z.string().trim().optional().default(""),
  weekdays: z
    .array(z.enum(["L", "M", "X", "J", "V", "S", "D"]))
    .max(7)
    .optional()
    .default([]),
  startTime: z
    .string()
    .trim()
    .regex(TIME_REGEX, "Hora inicio inválida (HH:MM)")
    .optional()
    .or(z.literal("")),
  endTime: z
    .string()
    .trim()
    .regex(TIME_REGEX, "Hora fin inválida (HH:MM)")
    .optional()
    .or(z.literal("")),
});

export type GroupInput = z.output<typeof GroupSchema>;
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function fail<T>(error: unknown): ActionResult<T> {
  return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
}

export async function createGroupAction(input: GroupInput): Promise<ActionResult> {
  try {
    const data = GroupSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("groups").insert({
      name: data.name,
      level: data.level,
      professor_id: data.professorId ?? null,
      schedule: data.schedule,
      capacity: data.capacity,
      location: data.location || null,
      weekdays: data.weekdays ?? [],
      start_time: data.startTime || null,
      end_time: data.endTime || null,
    });
    if (error) throw error;
    revalidatePath("/admin/groups");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateGroupAction(groupId: string, input: GroupInput): Promise<ActionResult> {
  try {
    const data = GroupSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("groups")
      .update({
        name: data.name,
        level: data.level,
        professor_id: data.professorId ?? null,
        schedule: data.schedule,
        capacity: data.capacity,
        location: data.location || null,
      })
      .eq("id", groupId);
    if (error) throw error;
    revalidatePath("/admin/groups");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteGroupAction(groupId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (error) throw error;
    revalidatePath("/admin/groups");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
