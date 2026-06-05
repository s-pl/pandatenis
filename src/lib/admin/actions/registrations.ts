"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAdminActivity } from "@/lib/admin/activity";
import { requireAdmin, requireStaff } from "@/lib/dal";
import { normalizeWhatsappNumber } from "@/lib/format";
import { appBaseUrl } from "@/lib/base-url";
import { sendAndLog } from "@/lib/sms/send-and-log";
import { welcomeSms } from "@/lib/sms/templates";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  isMissingInviteLocaleColumn,
  inviteStaffFilter,
  withInviteStaffNote,
  withInviteLocaleNote,
} from "@/lib/admin/registration-invite-locale";

const RegistrationInviteSchema = z.object({
  type: z.enum(["escuela", "campus"]),
  locale: z.enum(["es", "en"]).default("es"),
  guardianName: z.string().trim().max(160).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  courseSlug: z
    .string()
    .trim()
    .max(120)
    .regex(/^$|^[a-z0-9-]+$/, "La convocatoria seleccionada no es válida")
    .optional()
    .default(""),
});

const ConvertRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  level: z.enum(["Rojo", "Naranja", "Verde", "Amarillo"]).default("Rojo"),
  groupId: z.string().uuid().optional().nullable(),
});

type StudentLevel = z.output<typeof ConvertRegistrationSchema>["level"];

export type RegistrationInviteInput = z.input<typeof RegistrationInviteSchema>;
export type ConvertRegistrationInput = z.input<typeof ConvertRegistrationSchema>;
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Datos no validos" };
  }
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Error desconocido" };
}

async function absoluteInviteUrl(token: string, locale: "es" | "en"): Promise<string> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto =
    headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/${locale}/inscripcion/${token}`;
}

function newInviteToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

const PENDING_CHILD_NAME = "Alumno pendiente";
const SCHOOL_COURSE_SLUG = "escuela-2025-2026";

/** Etiquetas legibles de "¿Cómo nos conociste?" (slug → texto). */
const REFERRAL_LABELS: Record<string, string> = {
  carteles: "Carteles",
  flyers: "Flyers",
  chapas: "Chapas promocionales",
  google_web: "Google / Página web",
  instagram: "Instagram",
  facebook: "Facebook",
  recomendacion: "Recomendación de un alumno",
  otro: "Otro",
};
const PENDING_CAMPUS_SLUG = "campus-pendiente";

type RegistrationRelation = {
  fullName?: string;
  relationship?: string;
  phone?: string;
  email?: string;
};

async function resolveInviteCourseSlug(
  supabase: SupabaseClient,
  input: { type: "escuela" | "campus"; courseSlug: string },
) {
  if (input.type === "escuela") return SCHOOL_COURSE_SLUG;

  const requested = input.courseSlug.trim();
  if (!requested || requested === PENDING_CAMPUS_SLUG) return PENDING_CAMPUS_SLUG;

  const { data: course, error } = await supabase
    .from("campus_courses")
    .select("slug")
    .eq("slug", requested)
    .eq("kind", "campus")
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw error;
  if (!course) {
    throw new Error("La convocatoria de campus seleccionada no existe o no está publicada.");
  }
  return course.slug as string;
}

function splitChildName(childName: string, childLastName: string | null) {
  const full = childName.trim();
  const explicitLastName = childLastName?.trim();
  if (explicitLastName && full.toLowerCase().endsWith(explicitLastName.toLowerCase())) {
    const firstName = full.slice(0, -explicitLastName.length).trim();
    return { firstName: firstName || full, lastName: explicitLastName };
  }
  const [firstName = "", ...rest] = full.split(/\s+/).filter(Boolean);
  return { firstName, lastName: explicitLastName || rest.join(" ") };
}

function relationRows(raw: unknown, fallback: { name: string; phone: string; email: string | null }) {
  const parsed = Array.isArray(raw) ? (raw as RegistrationRelation[]) : [];
  const rows = parsed
    .map((relation) => ({
      full_name: relation.fullName?.trim() || fallback.name,
      phone: relation.phone?.trim() || fallback.phone,
      email: relation.email?.trim() || fallback.email || null,
      relationship: relation.relationship?.trim() || "Tutor",
    }))
    .filter((relation) => relation.full_name && relation.phone);

  if (rows.length > 0) return rows;
  if (!fallback.name || !fallback.phone) return [];
  return [
    {
      full_name: fallback.name,
      phone: fallback.phone,
      email: fallback.email,
      relationship: "Tutor",
    },
  ];
}

function medicalInfo(row: {
  allergies: string | null;
  illnesses: string | null;
  injuries: string | null;
}) {
  return [
    row.allergies ? `Alergias: ${row.allergies}` : null,
    row.illnesses ? `Enfermedades: ${row.illnesses}` : null,
    row.injuries ? `Lesiones: ${row.injuries}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createRegistrationInviteAction(
  input: RegistrationInviteInput,
): Promise<ActionResult<{ id: string; url: string; token: string }>> {
  try {
    const data = RegistrationInviteSchema.parse(input);
    const session = await requireStaff();
    const { profile } = session;
    const supabase =
      profile.role === "admin" ? session.supabase : createServiceRoleClient();
    const token = newInviteToken();
    const phone = data.phone ? normalizeWhatsappNumber(data.phone) : "";
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString();
    const courseSlug = await resolveInviteCourseSlug(supabase, {
      type: data.type,
      courseSlug: data.courseSlug,
    });
    const contactContext =
      data.guardianName || phone
        ? `Contacto familia: ${[data.guardianName, phone ? `+${phone}` : ""].filter(Boolean).join(" · ")}`
        : null;

    const adminNotes = withInviteStaffNote(
      withInviteLocaleNote(contactContext, data.locale),
      profile.id,
    );

    const invitePayload = {
      type: data.type,
      full_name: data.guardianName || "",
      phone,
      child_name: PENDING_CHILD_NAME,
      child_age: null,
      course_slug: courseSlug,
      status: "pendiente",
      registration_source: "admin_link",
      invite_token: token,
      invite_status: "draft",
      invite_locale: data.locale,
      invite_created_at: nowIso,
      invite_expires_at: expiresAt,
      admin_notes: adminNotes,
    };

    let inserted = await supabase
      .from("registrations")
      .insert(invitePayload)
      .select("id")
      .single();
    if (isMissingInviteLocaleColumn(inserted.error)) {
      const { invite_locale: _inviteLocale, ...fallbackPayload } = invitePayload;
      void _inviteLocale;
      inserted = await supabase
        .from("registrations")
        .insert(fallbackPayload)
        .select("id")
        .single();
    }
    if (inserted.error) throw inserted.error;
    const row = inserted.data;

    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "registration_invite_created",
      entityType: "registration",
      entityId: row.id,
      summary: `Enlace de inscripción creado: ${data.type === "campus" ? "Campus" : "Clases normales"}`,
      metadata: {
        type: data.type,
        courseSlug,
        locale: data.locale,
        hasContactContext: Boolean(data.guardianName || phone),
      },
    });

    revalidatePath("/admin/registrations");
    revalidatePath("/admin/campus");
    return { ok: true, data: { id: row.id, token, url: await absoluteInviteUrl(token, data.locale) } };
  } catch (error) {
    return fail(error);
  }
}

export async function markRegistrationInviteSentAction(
  registrationId: string,
): Promise<ActionResult> {
  try {
    const id = z.string().uuid().parse(registrationId);
    const session = await requireStaff();
    const supabase =
      session.profile.role === "admin" ? session.supabase : createServiceRoleClient();
    let query = supabase
      .from("registrations")
      .update({ invite_status: "sent" })
      .eq("id", id)
      .eq("registration_source", "admin_link")
      .eq("invite_status", "draft");
    if (session.profile.role !== "admin") {
      query = query.ilike("admin_notes", `%${inviteStaffFilter(session.profile.id)}%`);
    }
    const { data: updated, error } = await query.select("id").maybeSingle();
    if (error) throw error;
    if (!updated) {
      return {
        ok: false,
        error: "No se ha podido marcar el enlace como enviado. Puede que ya no esté pendiente o no tengas permiso sobre esta ficha.",
      };
    }
    revalidatePath("/admin/registrations");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function convertRegistrationToStudentAction(
  input: ConvertRegistrationInput,
): Promise<ActionResult<{ studentId: string }>> {
  try {
    const data = ConvertRegistrationSchema.parse(input);
    const { supabase, profile } = await requireAdmin();

    const { data: registration, error } = await supabase
      .from("registrations")
      .select(
        "id, status, student_id, lead_id, child_name, child_last_name, child_birth_date, full_name, phone, email, family_relations, allergies, illnesses, injuries, consent_multimedia, preferred_days, preferred_time_blocks, course_slug, scheduling_notes, comm_locale, referral",
      )
      .eq("id", data.registrationId)
      .maybeSingle();
    if (error) throw error;
    if (!registration) return { ok: false, error: "Solicitud no encontrada" };
    if (registration.student_id) {
      return { ok: true, data: { studentId: registration.student_id } };
    }

    const childName = (registration.child_name ?? "").trim();
    if (!childName || childName === PENDING_CHILD_NAME) {
      return { ok: false, error: "La solicitud todavía no tiene datos del alumno." };
    }
    if (!registration.child_birth_date) {
      return { ok: false, error: "Falta la fecha de nacimiento del alumno." };
    }

    const { firstName, lastName } = splitChildName(childName, registration.child_last_name);
    if (!firstName || !lastName) {
      return { ok: false, error: "Faltan nombre o apellidos del alumno." };
    }

    const guardians = relationRows(registration.family_relations, {
      name: registration.full_name ?? "",
      phone: registration.phone ?? "",
      email: registration.email ?? null,
    });
    if (guardians.length === 0) {
      return { ok: false, error: "Falta al menos un tutor con teléfono." };
    }

    let assignedLevel: StudentLevel = data.level;
    let assignedGroupName: string | null = null;
    if (data.groupId) {
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("id, name, level, capacity")
        .eq("id", data.groupId)
        .maybeSingle();
      if (groupError) throw groupError;
      if (!group) {
        return { ok: false, error: "El grupo seleccionado ya no existe." };
      }

      const { count, error: countError } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("group_id", data.groupId)
        .eq("active", true);
      if (countError) throw countError;
      if ((count ?? 0) >= group.capacity) {
        return {
          ok: false,
          error: `El grupo ${group.name} está completo (${count}/${group.capacity}).`,
        };
      }

      assignedLevel = group.level as StudentLevel;
      assignedGroupName = group.name;
    }

    // Conserva el origen y la fecha de entrada del lead al pasar a alumno.
    let leadOriginNote: string | null = null;
    if (registration.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("created_at, lead_sources(name)")
        .eq("id", registration.lead_id)
        .maybeSingle();
      if (lead) {
        const source = Array.isArray(lead.lead_sources)
          ? lead.lead_sources[0]?.name
          : (lead.lead_sources as { name?: string } | null)?.name;
        const entryDate = lead.created_at ? String(lead.created_at).slice(0, 10) : null;
        leadOriginNote = [
          source ? `Origen: ${source}` : null,
          entryDate ? `captado el ${entryDate}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
      }
    }

    const notes = [
      leadOriginNote || null,
      registration.referral ? `¿Cómo nos conoció?: ${REFERRAL_LABELS[registration.referral] ?? registration.referral}` : null,
      registration.course_slug ? `Origen inscripción: ${registration.course_slug}` : null,
      assignedGroupName ? `Grupo asignado: ${assignedGroupName}` : null,
      registration.scheduling_notes ? `Preferencias: ${registration.scheduling_notes}` : null,
      `Convertido desde solicitud ${registration.id}`,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: student, error: studentError } = await supabase
      .from("students")
      .insert({
        first_name: firstName,
        last_name: lastName,
        birth_date: registration.child_birth_date,
        level: assignedLevel,
        dominant_hand: "Derecha",
        group_id: data.groupId ?? null,
        medical_info: medicalInfo(registration) || null,
        image_consent: Boolean(registration.consent_multimedia),
        coach_notes: notes,
        preferred_days: Array.isArray(registration.preferred_days)
          ? registration.preferred_days
          : [],
        preferred_time_blocks: Array.isArray(registration.preferred_time_blocks)
          ? registration.preferred_time_blocks
          : [],
        comm_locale: registration.comm_locale === "en" ? "en" : "es",
      })
      .select("id")
      .single();
    if (studentError) throw studentError;

    const { error: guardianError } = await supabase.from("guardians").insert(
      guardians.map((guardian) => ({
        student_id: student.id,
        ...guardian,
      })),
    );
    if (guardianError) {
      await supabase.from("students").delete().eq("id", student.id);
      throw guardianError;
    }

    const { data: updatedRegistration, error: registrationError } = await supabase
      .from("registrations")
      .update({ status: "convertida", student_id: student.id })
      .eq("id", registration.id)
      .is("student_id", null)
      .select("id")
      .maybeSingle();
    if (registrationError) {
      await supabase.from("students").delete().eq("id", student.id);
      throw registrationError;
    }
    if (!updatedRegistration) {
      await supabase.from("students").delete().eq("id", student.id);
      return {
        ok: false,
        error: "Esta solicitud ya fue convertida por otra persona.",
      };
    }

    if (registration.lead_id) {
      await supabase
        .from("leads")
        .update({ status: "convertido" })
        .eq("id", registration.lead_id);
    }

    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "registration_converted",
      entityType: "registration",
      entityId: registration.id,
      summary: `Solicitud convertida en alumno: ${firstName} ${lastName}`,
      metadata: { studentId: student.id, level: assignedLevel, groupId: data.groupId ?? null },
    });

    // SMS de bienvenida (opcional, configurable). No debe romper la conversión.
    try {
      const { data: settings } = await supabase
        .from("school_settings")
        .select("sms_welcome_enabled, sms_welcome_msg_es, sms_welcome_msg_en")
        .maybeSingle();
      const welcomePhone = guardians[0]?.phone;
      if (settings?.sms_welcome_enabled && welcomePhone) {
        const locale: "es" | "en" = registration.comm_locale === "en" ? "en" : "es";
        const custom = locale === "en" ? settings.sms_welcome_msg_en : settings.sms_welcome_msg_es;
        const body = (custom && custom.trim())
          ? custom.replace(/\{nombre\}|\{name\}/gi, firstName)
          : welcomeSms(firstName, locale);
        const base = await appBaseUrl();
        await sendAndLog(supabase, {
          to: welcomePhone,
          body,
          locale,
          kind: "welcome",
          studentId: student.id,
          statusCallbackUrl: `${base}/api/sms/status`,
        });
      }
    } catch {
      /* El SMS de bienvenida es best-effort. */
    }

    revalidatePath("/admin/registrations");
    revalidatePath("/admin/students");
    revalidatePath("/admin");
    return { ok: true, data: { studentId: student.id } };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Elimina una inscripción. No borra el alumno ni el lead ya creados: solo
 * descarta la solicitud (p. ej. duplicados o pruebas). Solo admin.
 */
export async function deleteRegistrationAction(
  registrationId: string,
): Promise<ActionResult> {
  try {
    const { supabase, profile } = await requireAdmin();

    const { data: existing } = await supabase
      .from("registrations")
      .select("id, full_name, child_name")
      .eq("id", registrationId)
      .maybeSingle();
    if (!existing) return { ok: false, error: "La inscripción ya no existe." };

    const { error } = await supabase.from("registrations").delete().eq("id", registrationId);
    if (error) throw error;

    await recordAdminActivity(supabase, {
      actorId: profile.id,
      eventType: "registration_deleted",
      entityType: "registration",
      entityId: registrationId,
      summary: `Inscripción eliminada: ${existing.child_name ?? existing.full_name ?? registrationId}`,
    });

    revalidatePath("/admin/registrations");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
