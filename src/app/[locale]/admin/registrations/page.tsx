import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { RegistrationsTable } from "@/components/admin/registrations/registrations-table";
import { requireStaff } from "@/lib/dal";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  inviteLocaleFromRow,
  inviteStaffFilter,
  isMissingInviteLocaleColumn,
  stripInviteInternalNotes,
} from "@/lib/admin/registration-invite-locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("registrations") };
}
export const dynamic = "force-dynamic";

type SearchParams = { type?: string };
type RegistrationRow = {
  id: string;
  type: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  child_name: string;
  child_last_name: string | null;
  child_age: number | null;
  child_birth_date: string | null;
  child_gender: string | null;
  course_slug: string | null;
  family_relations: unknown;
  allergies: string | null;
  illnesses: string | null;
  injuries: string | null;
  signer_first_name: string | null;
  signer_last_name: string | null;
  consent_multimedia: boolean | null;
  terms_accepted_at: string | null;
  preferred_days: unknown;
  preferred_time_blocks: unknown;
  scheduling_notes: string | null;
  admin_notes: string | null;
  submitted_at: string;
  status: string;
  student_id: string | null;
  registration_source: string | null;
  invite_token: string | null;
  invite_status: string | null;
  invite_locale?: string | null;
  invite_created_at: string | null;
  invite_expires_at: string | null;
  invite_completed_at: string | null;
};

const REGISTRATION_SELECT =
  "id, type, full_name, phone, email, child_name, child_last_name, child_age, child_birth_date, child_gender, course_slug, family_relations, allergies, illnesses, injuries, signer_first_name, signer_last_name, consent_multimedia, terms_accepted_at, preferred_days, preferred_time_blocks, scheduling_notes, admin_notes, submitted_at, status, student_id, registration_source, invite_token, invite_status, invite_locale, invite_created_at, invite_expires_at, invite_completed_at";
const REGISTRATION_SELECT_WITHOUT_INVITE_LOCALE =
  "id, type, full_name, phone, email, child_name, child_last_name, child_age, child_birth_date, child_gender, course_slug, family_relations, allergies, illnesses, injuries, signer_first_name, signer_last_name, consent_multimedia, terms_accepted_at, preferred_days, preferred_time_blocks, scheduling_notes, admin_notes, submitted_at, status, student_id, registration_source, invite_token, invite_status, invite_created_at, invite_expires_at, invite_completed_at";

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";
  const dataClient = isAdmin ? supabase : createServiceRoleClient();
  const params = await searchParams;
  const typeFilter =
    params.type === "campus" || params.type === "escuela" || params.type === "ambos"
      ? params.type
      : null;

  const coursesPromise = dataClient
      .from("campus_courses")
      .select("slug, title, kind")
      .eq("is_public", true)
      .order("sort_order")
      .order("title");
  const groupsPromise = isAdmin
    ? supabase
        .from("groups")
        .select("id, name, level, capacity, weekdays, start_time, end_time, location")
        .order("level")
        .order("name")
    : Promise.resolve({ data: [], error: null });
  const studentsPromise = isAdmin
    ? supabase.from("students").select("id, group_id, active")
    : Promise.resolve({ data: [], error: null });

  const [coursesRes, groupsRes, studentsRes] = await Promise.all([
    coursesPromise,
    groupsPromise,
    studentsPromise,
  ]);
  if (coursesRes.error) {
    throw new Error(`No se pudieron cargar los cursos: ${coursesRes.error.message}`);
  }
  if (groupsRes.error) {
    throw new Error(`No se pudieron cargar los grupos: ${groupsRes.error.message}`);
  }
  if (studentsRes.error) {
    throw new Error(`No se pudo calcular ocupación de grupos: ${studentsRes.error.message}`);
  }

  function registrationsQuery(select: string) {
    let query = dataClient
      .from("registrations")
      .select(select)
      .order("submitted_at", { ascending: false })
      .limit(4000);
    if (!isAdmin) {
      query = query
        .eq("registration_source", "admin_link")
        .in("invite_status", ["draft", "sent", "expired"])
        .is("invite_completed_at", null)
        .ilike("admin_notes", `%${inviteStaffFilter(profile.id)}%`);
    }
    if (typeFilter === "campus") {
      query = query.in("type", ["campus", "ambos"]);
    } else if (typeFilter === "escuela") {
      query = query.in("type", ["escuela", "ambos"]);
    }
    return query;
  }

  let { data, error } = await registrationsQuery(REGISTRATION_SELECT);
  if (isMissingInviteLocaleColumn(error)) {
    const fallback = await registrationsQuery(REGISTRATION_SELECT_WITHOUT_INVITE_LOCALE);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    throw new Error(`No se pudieron cargar las inscripciones: ${error.message}`);
  }

  const registrations = ((data ?? []) as unknown as RegistrationRow[]).map((row) => ({
    id: row.id,
    type: row.type as "escuela" | "campus" | "ambos",
    fullName: isAdmin ? row.full_name || "Familia pendiente" : "Familia pendiente",
    phone: isAdmin ? row.phone : "",
    email: isAdmin ? row.email ?? null : null,
    childName: isAdmin ? row.child_name : "Alumno pendiente",
    childLastName: isAdmin ? row.child_last_name ?? null : null,
    childAge: isAdmin ? row.child_age : null,
    childBirthDate: isAdmin ? row.child_birth_date ?? null : null,
    childGender: isAdmin ? row.child_gender ?? null : null,
    courseSlug: row.course_slug ?? null,
    familyRelations: isAdmin && Array.isArray(row.family_relations) ? row.family_relations : [],
    allergies: isAdmin ? row.allergies ?? null : null,
    illnesses: isAdmin ? row.illnesses ?? null : null,
    injuries: isAdmin ? row.injuries ?? null : null,
    signerFirstName: isAdmin ? row.signer_first_name ?? null : null,
    signerLastName: isAdmin ? row.signer_last_name ?? null : null,
    consentMultimedia: isAdmin ? Boolean(row.consent_multimedia) : false,
    termsAcceptedAt: isAdmin ? row.terms_accepted_at ?? null : null,
    preferredDays: isAdmin && Array.isArray(row.preferred_days) ? row.preferred_days : [],
    preferredTimeBlocks: isAdmin && Array.isArray(row.preferred_time_blocks) ? row.preferred_time_blocks : [],
    schedulingNotes: isAdmin ? row.scheduling_notes ?? null : null,
    adminNotes: isAdmin ? stripInviteInternalNotes(row.admin_notes) || null : null,
    submittedAt: row.submitted_at,
    status: row.status as "pendiente" | "confirmada" | "convertida",
    studentId: row.student_id,
    registrationSource: (row.registration_source ?? "public_web") as "public_web" | "admin_link",
    inviteToken: row.invite_token,
    inviteStatus: row.invite_status as "draft" | "sent" | "completed" | "expired" | null,
    inviteLocale: inviteLocaleFromRow(row),
    inviteCreatedAt: row.invite_created_at ?? null,
    inviteExpiresAt: row.invite_expires_at ?? null,
    inviteCompletedAt: row.invite_completed_at,
  }));

  const courses = [
    { slug: "escuela-2025-2026", label: "Clases normales", kind: "escuela" as const },
    ...(coursesRes.data ?? []).map((row) => ({
      slug: row.slug,
      label: row.title,
      kind: ((row.kind as "campus" | "escuela") ?? "campus") as "campus" | "escuela",
    })),
  ];
  const groups = (groupsRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level as "Rojo" | "Naranja" | "Verde" | "Amarillo",
    capacity: row.capacity,
    enrolled: (studentsRes.data ?? []).filter(
      (student) => student.group_id === row.id && student.active,
    ).length,
    weekdays: (row.weekdays ?? []) as string[],
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : "",
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : "",
    location: row.location ?? "",
  }));

  const pending = registrations.filter((row) => row.status === "pendiente").length;
  const escuelaCount = registrations.filter((row) => row.type === "escuela").length;
  const campusCount = registrations.filter((row) => row.type === "campus").length;
  const ambosCount = registrations.filter((row) => row.type === "ambos").length;

  return (
    <PageShell
      variant="tinted"
      title={
        typeFilter === "campus"
          ? "Inscripciones · Campus"
          : typeFilter === "escuela"
            ? "Inscripciones · Escuela"
            : "Inscripciones"
      }
      description={
        !isAdmin
          ? "Genera fichas privadas y copia el enlace para que la familia complete todos los datos."
          : typeFilter === "campus"
            ? "Fichas de campus creadas desde el panel o completadas por las familias."
            : typeFilter === "escuela"
              ? "Fichas de clases normales creadas desde el panel o completadas por las familias."
              : "Crea una ficha básica, comparte el enlace con la familia y revisa aquí los datos completos cuando lo rellene."
      }
      meta={
        <>
          <Badge tone="primary" iconLeft={<UserPlus className="h-3 w-3" />}>
            {registrations.length} inscripciones
          </Badge>
          <Badge tone="info">{escuelaCount} escuela</Badge>
          <Badge tone="accent">{campusCount} campus</Badge>
          {ambosCount > 0 && <Badge tone="success">{ambosCount} ambos</Badge>}
          {pending > 0 && <Badge tone="warning">{pending} por revisar</Badge>}
        </>
      }
    >
      {/* Histórico — direct DataTable (no wrapper card) */}
      <RegistrationsTable rows={registrations} courses={courses} groups={groups} role={profile.role} />
    </PageShell>
  );
}
