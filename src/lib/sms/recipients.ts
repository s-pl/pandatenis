import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeWhatsappNumber } from "@/lib/format";
import { normalizeLocale, type CommLocale } from "@/lib/sms/templates";

export type SmsAudience = "none" | "students" | "leads" | "both";
export type SmsLocaleFilter = "all" | "es" | "en";
export type SmsRecipient = { phone: string; locale: CommLocale; studentId: string | null };

export type BuildRecipientsInput = {
  audience?: SmsAudience;
  localeFilter?: SmsLocaleFilter;
  /** Alumnos elegidos a mano (se usa su idioma guardado y el teléfono del tutor). */
  studentIds?: string[];
  /** Contactos manuales (teléfono + idioma). */
  manualRecipients?: Array<{ phone: string; locale: CommLocale }>;
};

/**
 * Construye la lista de destinatarios de un envío SMS combinando: alumnos
 * elegidos a mano, campaña masiva (todos los alumnos y/o leads activos filtrados
 * por idioma) y contactos manuales. Deduplica por teléfono normalizado para no
 * enviar dos veces al mismo número (p. ej. un lead que ya es alumno).
 */
export async function buildSmsRecipients(
  supabase: SupabaseClient,
  input: BuildRecipientsInput,
): Promise<SmsRecipient[]> {
  const audience = input.audience ?? "none";
  const localeFilter = input.localeFilter ?? "all";
  const studentIds = input.studentIds ?? [];
  const manualRecipients = input.manualRecipients ?? [];

  const recipients: SmsRecipient[] = [];
  const seen = new Set<string>();
  const localeMatches = (loc: CommLocale) => localeFilter === "all" || localeFilter === loc;
  const add = (r: SmsRecipient) => {
    const key = normalizeWhatsappNumber(r.phone);
    if (!key || seen.has(key)) return;
    seen.add(key);
    recipients.push(r);
  };

  // 1) Alumnos seleccionados a mano.
  if (studentIds.length > 0) {
    const { data } = await supabase
      .from("students")
      .select("id, comm_locale, guardians(phone)")
      .in("id", studentIds);
    for (const s of data ?? []) {
      const phone = (s.guardians as { phone: string | null }[] | null)?.[0]?.phone ?? null;
      if (phone) add({ phone, locale: normalizeLocale(s.comm_locale), studentId: s.id });
    }
  }

  // 2) Campaña masiva por lista.
  const includeStudents = audience === "students" || audience === "both";
  const includeLeads = audience === "leads" || audience === "both";

  if (includeStudents) {
    const { data } = await supabase
      .from("students")
      .select("id, comm_locale, active, guardians(phone)")
      .eq("active", true);
    for (const s of data ?? []) {
      const locale = normalizeLocale(s.comm_locale);
      if (!localeMatches(locale)) continue;
      const phone = (s.guardians as { phone: string | null }[] | null)?.[0]?.phone ?? null;
      if (phone) add({ phone, locale, studentId: s.id });
    }
  }

  if (includeLeads) {
    const { data } = await supabase
      .from("leads")
      .select("phone, comm_locale, status")
      .not("status", "in", "(convertido,perdido)");
    for (const l of data ?? []) {
      const locale = normalizeLocale(l.comm_locale);
      if (!localeMatches(locale)) continue;
      if (l.phone) add({ phone: l.phone, locale, studentId: null });
    }
  }

  // 3) Contactos manuales (respetan el filtro de idioma).
  for (const manual of manualRecipients) {
    if (localeMatches(manual.locale)) add({ phone: manual.phone, locale: manual.locale, studentId: null });
  }

  return recipients;
}
