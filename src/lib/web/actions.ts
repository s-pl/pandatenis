"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log, logError } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { normalizeWhatsappNumber } from "@/lib/format";
import {
  resolveInviteCourse,
  resolvePublicCourse,
  type RegistrationKind,
} from "@/lib/web/course-resolver";

const RelationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(60),
  phone: z.string().trim().min(6).max(30),
  email: z.string().trim().email().optional().or(z.literal("")),
});

const RegistrationSchema = z.object({
  inviteToken: z.string().trim().min(16).max(160).optional().default(""),
  courseSlug: z.string().trim().min(2).max(80),
  courseLabel: z.string().trim().min(2).max(120),
  interest: z.enum(["escuela", "campus", "ambos"]),

  email: z.string().trim().email("Email no valido"),

  childFirstName: z.string().trim().min(2, "Indica el nombre del alumno"),
  childLastName: z.string().trim().min(2, "Indica los apellidos"),
  childPhone: z.string().trim().min(6, "Indica un teléfono de contacto del alumno").max(30),
  childBirthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida"),
  childGender: z.enum(["masculino", "femenino", "otro"]),
  relations: z.array(RelationSchema).min(1, "Anade al menos un familiar").max(3),

  allergies: z.string().trim().max(800).optional().default(""),
  illnesses: z.string().trim().max(800).optional().default(""),
  injuries: z.string().trim().max(800).optional().default(""),

  // Sólo se rellena cuando el curso es de escuela; en campus se ignora.
  preferredDays: z
    .array(z.enum(["L", "M", "X", "J", "V", "S", "D"]))
    .max(7)
    .optional()
    .default([]),
  preferredTimeBlocks: z
    .array(z.enum(["tarde-temprano", "tarde-media", "tarde-tardia", "sabado-manana"]))
    .max(4)
    .optional()
    .default([]),
  schedulingNotes: z.string().trim().max(500).optional().default(""),

  signerFirstName: z.string().trim().min(2, "Indica el nombre del firmante"),
  signerLastName: z.string().trim().min(2, "Indica el apellido del firmante"),
  signatureData: z
    .string()
    .trim()
    .startsWith("data:image/", "Firma invalida")
    .max(500_000, "Firma demasiado grande"),
  consentMultimedia: z.boolean(),

  company: z.string().trim().max(0).optional().default(""),
});

export type RegistrationInput = z.input<typeof RegistrationSchema>;
export type ActionResult = { ok: true } | { ok: false; error: string };

const EmailCheckSchema = z.object({
  email: z.string().trim().email(),
});

export type EmailCheckResult =
  | {
      ok: true;
      exists: boolean;
    }
  | { ok: false; error: string };

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 6;
const rateLimitStore = globalThis as typeof globalThis & {
  __pandaInscripcionRateLimit?: Map<string, { count: number; resetAt: number }>;
};

class PublicRegistrationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicRegistrationInputError";
  }
}

function getStore() {
  if (!rateLimitStore.__pandaInscripcionRateLimit) {
    rateLimitStore.__pandaInscripcionRateLimit = new Map();
  }
  return rateLimitStore.__pandaInscripcionRateLimit;
}

function checkMemoryRateLimit(key: string) {
  const store = getStore();
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

async function checkRateLimit(scope: string, key: string) {
  if (!isSupabaseConfigured()) {
    return checkMemoryRateLimit(`${scope}:${key}`);
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("check_registration_rate_limit", {
      p_scope: scope,
      p_key_hash: rateLimitHash(scope, key),
      p_max: RATE_LIMIT_MAX,
      p_window_seconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    logError("registration_rate_limit_persistent_failed", error, { scope });
    return checkMemoryRateLimit(`${scope}:${key}`);
  }
}

async function requestKey() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerList.get("x-real-ip")?.trim();
  const ua = headerList.get("user-agent")?.slice(0, 120) ?? "unknown";
  return `${forwarded || realIp || "unknown"}:${ua}`;
}

function ageFromBirthDate(birthDate: string): number {
  const d = new Date(birthDate + "T00:00:00Z");
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

function normalizePublicPhone(phone: string, label: string) {
  const normalized = normalizeWhatsappNumber(phone);
  if (!/^\d{8,15}$/.test(normalized)) {
    throw new PublicRegistrationInputError(
      `${label} no válido. Usa un teléfono con prefijo internacional o un móvil español.`,
    );
  }
  return normalized;
}

function signatureFileFromDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Firma invalida");
  const mimeType = match[1];
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength === 0 || buffer.byteLength > 500_000) {
    throw new Error("Firma invalida");
  }
  return { buffer, mimeType, extension };
}

async function cleanupPartialRegistration(
  supabase: SupabaseClient,
  input: { leadId?: string | null; signatureStoragePath?: string | null },
) {
  const failures: string[] = [];
  if (input.signatureStoragePath) {
    const { error } = await supabase.storage
      .from("registration-signatures")
      .remove([input.signatureStoragePath]);
    if (error) failures.push(`signature:${error.message}`);
  }
  if (input.leadId) {
    const { error } = await supabase.from("leads").delete().eq("id", input.leadId);
    if (error) failures.push(`lead:${error.message}`);
  }
  if (failures.length > 0) {
    log("warn", "registration_partial_cleanup_failed", { failures });
  }
}

export async function checkRegistrationEmailAction(
  input: { email: string },
): Promise<EmailCheckResult> {
  try {
    EmailCheckSchema.parse(input);
    const key = await requestKey();
    if (!(await checkRateLimit("email", key))) {
      return { ok: false, error: "Demasiados intentos. Prueba en unos minutos." };
    }

    // No devolvemos si el email existe ni datos previos del alumno: en un
    // formulario publico eso permitiria enumerar informacion de menores.
    return { ok: true, exists: false };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: "Email no valido" };
    }
    logError("registration_email_check_failed", err);
    return { ok: false, error: "No se pudo verificar el email." };
  }
}

export async function submitRegistrationAction(
  input: RegistrationInput,
): Promise<ActionResult> {
  try {
    const data = RegistrationSchema.parse(input);

    if (data.company) {
      return { ok: false, error: "Solicitud rechazada." };
    }

    const key = await requestKey();
    if (!(await checkRateLimit("submit", key))) {
      log("warn", "registration_rate_limited", { scope: "submit" });
      return {
        ok: false,
        error: "Hemos recibido demasiados intentos. Prueba en unos minutos.",
      };
    }

    const age = ageFromBirthDate(data.childBirthDate);
    if (age < 3 || age > 80) {
      return { ok: false, error: "Fecha de nacimiento fuera de rango" };
    }

    const normalizedRelations = data.relations.map((relation) => ({
      ...relation,
      phone: normalizePublicPhone(relation.phone, `Teléfono de ${relation.fullName}`),
    }));
    const normalizedChildPhone = normalizePublicPhone(data.childPhone, "Teléfono del alumno");
    const normalizedPrimaryRelation = normalizedRelations[0];
    if (!normalizedPrimaryRelation) {
      return { ok: false, error: "Añade al menos un familiar de contacto." };
    }
    const fullChildName = `${data.childFirstName} ${data.childLastName}`.trim();

    if (!isSupabaseConfigured()) {
      log("info", "registration_dev_fallback", {
        courseSlug: data.courseSlug,
        childAge: age,
        interest: data.interest,
      });
      return { ok: true };
    }

    const supabase = createServiceRoleClient();
    let inviteId: string | null = null;
    let registrationType: RegistrationKind = data.interest;
    let courseSlug = data.courseSlug;
    let courseLabel = data.courseLabel;
    let signatureStoragePath: string | null = null;
    let leadId: string | null = null;

    if (data.inviteToken) {
      const { data: invite, error: inviteError } = await supabase
        .from("registrations")
        .select("id, type, course_slug, invite_expires_at, invite_status")
        .eq("invite_token", data.inviteToken)
        .maybeSingle();
      if (inviteError) throw inviteError;
      if (!invite) {
        return { ok: false, error: "Este enlace de inscripción no existe o ya no está disponible." };
      }
      if (!["draft", "sent"].includes(String(invite.invite_status))) {
        return {
          ok: false,
          error: "Esta ficha ya ha sido completada o ya no admite cambios. Pide un enlace nuevo por WhatsApp.",
        };
      }
      if (invite.invite_expires_at && new Date(invite.invite_expires_at).getTime() < Date.now()) {
        await supabase
          .from("registrations")
          .update({ invite_status: "expired" })
          .eq("id", invite.id)
          .neq("invite_status", "completed");
        return { ok: false, error: "Este enlace de inscripción ha caducado. Pide uno nuevo por WhatsApp." };
      }
      inviteId = invite.id;
      registrationType = invite.type as RegistrationKind;
      const inviteCourse = await resolveInviteCourse(registrationType, invite.course_slug);
      courseSlug = inviteCourse.slug;
      courseLabel = inviteCourse.label;
    } else {
      const publicCourse = await resolvePublicCourse(data.courseSlug);
      if (!publicCourse) {
        return {
          ok: false,
          error: "El curso seleccionado ya no está disponible. Actualiza la página y elige otro.",
        };
      }
      registrationType = publicCourse.kind;
      courseSlug = publicCourse.slug;
      courseLabel = publicCourse.label;
    }

    const observations = [
      `Curso: ${courseLabel}`,
      `Alumno: ${fullChildName}`,
      `Email: ${data.email}`,
      normalizedChildPhone ? `Teléfono alumno: +${normalizedChildPhone}` : null,
      data.allergies ? `Alergias: ${data.allergies}` : null,
      data.illnesses ? `Enfermedades: ${data.illnesses}` : null,
      data.injuries ? `Lesiones: ${data.injuries}` : null,
      `Firmante: ${data.signerFirstName} ${data.signerLastName}`,
      `Consentimiento imagenes: ${data.consentMultimedia ? "si" : "no"}`,
    ]
      .filter(Boolean)
      .join(" | ");

    const { data: source, error: sourceError } = await supabase
      .from("lead_sources")
      .upsert({ name: data.inviteToken ? "WhatsApp" : "Web" }, { onConflict: "name" })
      .select("id")
      .single();
    if (sourceError) throw sourceError;

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        full_name: normalizedPrimaryRelation.fullName,
        phone: normalizedPrimaryRelation.phone,
        email: data.email,
        child_age: Math.min(Math.max(age, 1), 18),
        interest: registrationType,
        source_id: source.id,
        course_slug: courseSlug,
        observations,
        status: "nuevo",
      })
      .select("id")
      .single();
    if (leadError) throw leadError;
    leadId = lead.id;

    try {
      const signatureFile = signatureFileFromDataUrl(data.signatureData);
      signatureStoragePath = `signatures/${crypto.randomUUID()}.${signatureFile.extension}`;
      const { error: signatureError } = await supabase.storage
        .from("registration-signatures")
        .upload(signatureStoragePath, signatureFile.buffer, {
          contentType: signatureFile.mimeType,
          upsert: false,
        });
      if (signatureError) throw signatureError;
    } catch (error) {
      await cleanupPartialRegistration(supabase, { leadId });
      throw error;
    }

    const registrationPayload = {
        type: registrationType,
        full_name: normalizedPrimaryRelation.fullName,
        phone: normalizedPrimaryRelation.phone,
        email: data.email,
        child_name: fullChildName,
        child_last_name: data.childLastName,
        child_age: Math.min(Math.max(age, 1), 18),
        child_birth_date: data.childBirthDate,
        child_gender: data.childGender,
        course_slug: courseSlug,
        family_relations: normalizedRelations,
        allergies: data.allergies || null,
        illnesses: data.illnesses || null,
        injuries: data.injuries || null,
        signer_first_name: data.signerFirstName,
        signer_last_name: data.signerLastName,
        signature_data: null,
        signature_storage_path: signatureStoragePath,
        consent_multimedia: data.consentMultimedia,
        terms_accepted_at: new Date().toISOString(),
        status: "pendiente",
        lead_id: lead.id,
        preferred_days: registrationType === "campus" ? [] : data.preferredDays,
        preferred_time_blocks:
          registrationType === "campus" ? [] : data.preferredTimeBlocks,
        scheduling_notes: data.schedulingNotes || null,
    };

    if (inviteId) {
      const { data: updatedInvite, error: registrationError } = await supabase
        .from("registrations")
        .update({
          ...registrationPayload,
          registration_source: "admin_link",
          invite_status: "completed",
          invite_completed_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
        })
        .eq("id", inviteId)
        .in("invite_status", ["draft", "sent"])
        .select("id")
        .maybeSingle();
      if (registrationError) {
        await cleanupPartialRegistration(supabase, { leadId, signatureStoragePath });
        throw registrationError;
      }
      if (!updatedInvite) {
        await cleanupPartialRegistration(supabase, { leadId, signatureStoragePath });
        return {
          ok: false,
          error: "Esta ficha ya no está disponible. Pide un enlace nuevo por WhatsApp.",
        };
      }
    } else {
      const { error: registrationError } = await supabase
        .from("registrations")
        .insert(registrationPayload);
      if (registrationError) {
        await cleanupPartialRegistration(supabase, { leadId, signatureStoragePath });
        throw registrationError;
      }
    }

    log("info", "registration_created", {
      leadId: lead.id,
      courseSlug,
      interest: registrationType,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues =
        err.issues ??
        (err as unknown as { errors: Array<{ message: string }> }).errors;
      return { ok: false, error: issues?.[0]?.message ?? "Datos incorrectos" };
    }
    if (err instanceof PublicRegistrationInputError) {
      return { ok: false, error: err.message };
    }
    logError("registration_submit_failed", err);
    return {
      ok: false,
      error: "No se pudo enviar el formulario. Intentalo de nuevo.",
    };
  }
}
