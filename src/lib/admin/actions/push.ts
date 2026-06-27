"use server";

import { requireAdmin } from "@/lib/dal";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound?: "default";
  data?: Record<string, unknown>;
};

/**
 * Envía mensajes a la Expo Push API en lotes de 100 (límite de Expo). Devuelve
 * cuántos se aceptaron. Tolerante a fallos: no lanza, solo informa.
 */
export async function sendExpoPush(messages: ExpoMessage[]): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      const json = (await res.json().catch(() => null)) as { data?: { status: string }[] } | null;
      for (const ticket of json?.data ?? []) {
        if (ticket.status === "ok") sent += 1;
        else errors += 1;
      }
    } catch {
      errors += chunk.length;
    }
  }
  return { sent, errors };
}

/**
 * Envía una notificación a TODO el equipo (todos los tokens registrados). Usa
 * el service role para leer todos los tokens. Pensado para crons / avisos
 * automáticos (pagos pendientes, recordatorios de campus…).
 */
export async function sendPushToAllStaff(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<{ sent: number; errors: number }> {
  const supabase = createServiceRoleClient();
  const { data: tokens } = await supabase.from("device_push_tokens").select("token");
  const messages: ExpoMessage[] = (tokens ?? []).map((t) => ({
    to: t.token as string,
    title,
    body,
    sound: "default",
    data,
  }));
  if (messages.length === 0) return { sent: 0, errors: 0 };
  return sendExpoPush(messages);
}

/** Envía una notificación de prueba a los dispositivos del usuario actual. */
export async function sendTestPushAction(): Promise<ActionResult<{ sent: number }>> {
  try {
    const { supabase, profile } = await requireAdmin();
    const { data: tokens, error } = await supabase
      .from("device_push_tokens")
      .select("token")
      .eq("user_id", profile.id);
    if (error) throw error;
    if (!tokens || tokens.length === 0) {
      return { ok: false, error: "Este dispositivo aún no está registrado para push. Abre la app en una development build y acepta el permiso." };
    }
    const result = await sendExpoPush(
      tokens.map((t) => ({
        to: t.token as string,
        title: "🐼 Panda Tenis",
        body: "¡Las notificaciones push funcionan!",
        sound: "default",
        data: { type: "test" },
      })),
    );
    return { ok: true, data: { sent: result.sent } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}
