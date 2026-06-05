"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { log, logError } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { normalizeWhatsappNumber } from "@/lib/format";

/**
 * Captura de leads desde la landing del QR del Campus (/c/[source]).
 *
 * Flujo: el visitante elige idioma, deja nombre + teléfono y se crea un lead
 * con su origen e idioma. La acción devuelve el enlace de WhatsApp ya preparado
 * para que el cliente lo abra (no hacemos redirect server-side para no perder el
 * gesto del usuario, imprescindible para abrir la app de WhatsApp en móvil).
 *
 * Igual que la inscripción pública, esto corre con el service role y un rate
 * limit propio (sin RLS anónima).
 */

// Número de WhatsApp del negocio por defecto (mismo que la web pública).
const FALLBACK_WA_NUMBER = "34633739312";

// Mensajes exactos del briefing del Campus.
const WA_PREFILL = {
  es: "Hola, me gustaría recibir información sobre el Campus Panda Tenis.",
  en: "Hello, I would like to receive information about Panda Tennis Camp.",
} as const;

const CaptureSchema = z.object({
  sourceSlug: z.string().trim().min(2).max(40),
  locale: z.enum(["es", "en"]),
  fullName: z.string().trim().min(2, "Indica tu nombre").max(120),
  phone: z.string().trim().min(6, "Indica un teléfono válido").max(30),
  // Honeypot: debe llegar vacío.
  company: z.string().trim().max(0).optional().default(""),
});

export type LeadCaptureInput = z.input<typeof CaptureSchema>;
export type LeadCaptureResult =
  | { ok: true; whatsappUrl: string }
  | { ok: false; error: string };

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;
const memoryStore = globalThis as typeof globalThis & {
  __pandaLeadCaptureRateLimit?: Map<string, { count: number; resetAt: number }>;
};

function checkMemoryRateLimit(key: string) {
  if (!memoryStore.__pandaLeadCaptureRateLimit) {
    memoryStore.__pandaLeadCaptureRateLimit = new Map();
  }
  const store = memoryStore.__pandaLeadCaptureRateLimit;
  const now = Date.now();
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT_MAX) return false;
  current.count += 1;
  return true;
}

function rateLimitHash(scope: string, key: string) {
  return crypto.createHash("sha256").update(`${scope}:${key}`).digest("hex");
}

async function checkRateLimit(key: string) {
  if (!isSupabaseConfigured()) return checkMemoryRateLimit(`lead_capture:${key}`);
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("check_registration_rate_limit", {
      p_scope: "lead_capture",
      p_key_hash: rateLimitHash("lead_capture", key),
      p_max: RATE_LIMIT_MAX,
      p_window_seconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    logError("lead_capture_rate_limit_failed", error);
    return checkMemoryRateLimit(`lead_capture:${key}`);
  }
}

async function requestKey() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerList.get("x-real-ip")?.trim();
  const ua = headerList.get("user-agent")?.slice(0, 120) ?? "unknown";
  return `${forwarded || realIp || "unknown"}:${ua}`;
}

function buildWhatsappUrl(number: string, locale: "es" | "en") {
  const digits = (number || FALLBACK_WA_NUMBER).replace(/\D/g, "") || FALLBACK_WA_NUMBER;
  return `https://wa.me/${digits}?text=${encodeURIComponent(WA_PREFILL[locale])}`;
}

export async function captureCampusLeadAction(
  input: LeadCaptureInput,
): Promise<LeadCaptureResult> {
  try {
    const data = CaptureSchema.parse(input);

    if (data.company) {
      return { ok: false, error: "Solicitud rechazada." };
    }

    const key = await requestKey();
    if (!(await checkRateLimit(key))) {
      log("warn", "lead_capture_rate_limited", { source: data.sourceSlug });
      return { ok: false, error: "Demasiados intentos. Prueba en unos minutos." };
    }

    const phone = normalizeWhatsappNumber(data.phone);
    if (!/^\d{8,15}$/.test(phone)) {
      return {
        ok: false,
        error: "Teléfono no válido. Usa un móvil español o con prefijo internacional.",
      };
    }

    // Sin Supabase (entorno de desarrollo) seguimos abriendo WhatsApp.
    if (!isSupabaseConfigured()) {
      log("info", "lead_capture_dev_fallback", { source: data.sourceSlug, locale: data.locale });
      return { ok: true, whatsappUrl: buildWhatsappUrl(FALLBACK_WA_NUMBER, data.locale) };
    }

    const supabase = createServiceRoleClient();

    const [{ data: source }, { data: settings }] = await Promise.all([
      supabase.from("lead_sources").select("id").eq("slug", data.sourceSlug).maybeSingle(),
      supabase
        .from("school_settings")
        .select("whatsapp_booking_number")
        .maybeSingle(),
    ]);

    const { error: leadError } = await supabase.from("leads").insert({
      full_name: data.fullName,
      phone,
      interest: "campus",
      source_id: source?.id ?? null,
      comm_locale: data.locale,
      status: "nuevo",
      observations: `Lead automático desde QR (${data.sourceSlug}).`,
    });
    if (leadError) throw leadError;

    return {
      ok: true,
      whatsappUrl: buildWhatsappUrl(settings?.whatsapp_booking_number ?? FALLBACK_WA_NUMBER, data.locale),
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues[0]?.message ?? "Datos no válidos" };
    }
    logError("lead_capture_failed", err);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
}
