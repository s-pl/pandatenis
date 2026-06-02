import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function includes(path, needle, message) {
  assert.ok(read(path).includes(needle), message ?? `${path} should include ${needle}`);
}

function excludes(path, needle, message) {
  assert.ok(!read(path).includes(needle), message ?? `${path} should not include ${needle}`);
}

function matches(path, pattern, message) {
  assert.match(read(path), pattern, message ?? `${path} should match ${pattern}`);
}

// Registration invite creation: trainer/admin only chooses type/language, no
// student/family form fields are required in the private-link modal.
includes(
  "src/lib/admin/actions/registrations.ts",
  'child_name: PENDING_CHILD_NAME',
  "invite rows keep the internal placeholder for DB compatibility",
);
includes(
  "src/lib/admin/actions/registrations.ts",
  "invite_locale: data.locale",
  "invite creation stores the selected public language",
);
includes(
  "src/lib/admin/actions/registrations.ts",
  "isMissingInviteLocaleColumn",
  "invite creation stays compatible while the locale migration is pending",
);
includes(
  "src/app/[locale]/admin/registrations/page.tsx",
  "REGISTRATION_SELECT_WITHOUT_INVITE_LOCALE",
  "registrations listing retries without invite_locale if the DB is not migrated yet",
);
includes(
  "src/lib/admin/registration-invite-locale.ts",
  "Idioma enlace:",
  "fallback invite locale is persisted in internal notes",
);
includes(
  "src/app/[locale]/admin/registrations/page.tsx",
  "enrolled:",
  "conversion UI receives group occupancy context",
);
includes(
  "src/lib/admin/actions/registrations.ts",
  ".is(\"student_id\", null)",
  "conversion is protected against double-create races",
);
includes(
  "src/components/admin/registrations/registration-invite-dialog.tsx",
  "Idioma de la ficha",
  "invite modal lets the admin choose Spanish or English",
);
includes(
  "src/lib/dal.ts",
  "export async function requireStaff()",
  "staff access primitive must exist for professor-safe admin workflows",
);
includes(
  "src/app/[locale]/admin/layout.tsx",
  "await requireStaff()",
  "admin shell must admit both admin and professor roles before page-level restrictions",
);
includes(
  "src/lib/admin/actions/registrations.ts",
  "await requireStaff()",
  "staff can create and copy private registration links",
);
includes(
  "src/lib/admin/actions/registrations.ts",
  "withInviteStaffNote",
  "staff-created private links store an internal owner marker",
);
includes(
  "src/lib/admin/actions/registrations.ts",
  "resolveInviteCourseSlug",
  "invite creation validates the selected course/campus on the server",
);
includes(
  "src/lib/admin/actions/registrations.ts",
  '.eq("is_public", true)',
  "campus invite creation only accepts published campus courses",
);
includes(
  "src/app/[locale]/admin/registrations/page.tsx",
  '.eq("is_public", true)',
  "registration invite modal only receives published campus options",
);
includes(
  "src/lib/admin/actions/registrations.ts",
  "inviteStaffFilter(session.profile.id)",
  "professors can only mark their own private links as sent",
);
includes(
  "src/lib/admin/actions/registrations.ts",
  '.select("id").maybeSingle()',
  "marking an invite as sent verifies that a row was actually updated",
);
includes(
  "src/components/admin/registrations/registrations-table.tsx",
  "Enlace copiado, pero no se marcó como enviado",
  "copy feedback warns when the sent marker could not be persisted",
);
includes(
  "src/app/[locale]/admin/registrations/page.tsx",
  "inviteStaffFilter(profile.id)",
  "professor registrations listing is restricted to links created by that professor",
);
includes(
  "src/app/[locale]/admin/registrations/page.tsx",
  "stripInviteInternalNotes",
  "internal invite ownership markers are hidden from admin-facing details",
);
includes(
  "src/lib/admin/actions/registrations.ts",
  "await requireAdmin()",
  "student conversion stays admin-only",
);
includes(
  "src/components/admin/registrations/registrations-table.tsx",
  "role: AdminRole",
  "registrations table renders admin/professor capabilities separately",
);
excludes(
  "src/components/admin/registrations/registration-invite-dialog.tsx",
  "Indica el nombre del alumno",
  "invite modal must not ask the trainer for the child name",
);

// Public private-link submission: server derives course/type from token,
// blocks completed/expired links, and never stores the signature blob inline.
includes(
  "src/lib/web/actions.ts",
  "resolveInviteCourse(registrationType, invite.course_slug)",
  "invite submission derives course server-side from the token row",
);
includes(
  "src/lib/web/actions.ts",
  "normalizePublicPhone",
  "public registration submission normalizes contact phones before storing them",
);
includes(
  "src/lib/web/actions.ts",
  "normalizedRelations",
  "public registration stores normalized family relation phones",
);
includes(
  "src/lib/web/actions.ts",
  "PublicRegistrationInputError",
  "public registration returns clear validation errors for invalid phone input",
);
includes(
  "src/lib/web/actions.ts",
  '.in("invite_status", ["draft", "sent"])',
  "invite completion must be conditional on an unused link",
);
includes(
  "src/lib/web/actions.ts",
  "cleanupPartialRegistration",
  "partial lead/signature cleanup must exist for failed submissions",
);
includes(
  "src/lib/web/actions.ts",
  "signature_storage_path: signatureStoragePath",
  "registration stores a private signature storage path",
);
excludes(
  "src/lib/web/actions.ts",
  "signature_data: data.signatureData",
  "registration must not persist the full signature data URL in the row",
);
includes(
  "src/app/[locale]/(web)/inscripcion/[token]/page.tsx",
  "Link unavailable",
  "expired/completed private links must render a non-wizard state",
);

// Admin request lifecycle: a row cannot be marked converted unless a student
// was really created, and converted rows cannot be downgraded manually.
includes(
  "src/app/[locale]/admin/registrations/api/update/route.ts",
  "Para convertir una solicitud, usa el botón Crear alumno.",
  "manual status update cannot fake a conversion",
);
includes(
  "src/components/admin/registrations/registrations-table.tsx",
  "Crear alumno",
  "admin table exposes the real conversion action",
);
includes(
  "src/components/admin/registrations/registrations-table.tsx",
  "disabled={pending || Boolean(r.studentId)}",
  "converted rows are locked in the status selector",
);

// WhatsApp media templates: Meta-approved headers need a local file, and the
// quick-send composer must block bad media states before the send action.
includes(
  "src/lib/admin/actions/whatsapp.ts",
  "Meta confirma que esta plantilla tiene cabecera",
  "server send path must fail loudly when a Meta media header lacks a local file",
);
includes(
  "src/components/admin/whatsapp/templates.tsx",
  "Plantillas con cabecera multimedia pendiente",
  "templates UI surfaces media-header action items",
);
includes(
  "src/components/admin/whatsapp/template-composer.tsx",
  "templateMediaIssue",
  "quick-send composer blocks incomplete media templates",
);
includes(
  "src/components/admin/whatsapp/meta-connection.tsx",
  "Cuenta WABA y plantillas",
  "connection page surfaces the WABA/template diagnostic that explains Meta template sync issues",
);
includes(
  "src/components/admin/whatsapp/meta-connection.tsx",
  "Checklist de credenciales",
  "connection page shows non-secret credential readiness for WhatsApp setup",
);
includes(
  "src/components/admin/whatsapp/whatsapp-workspace.tsx",
  "Procesar cola",
  "WhatsApp operations center exposes queue processing from the main health panel",
);
includes(
  "src/components/admin/whatsapp/whatsapp-workspace.tsx",
  "processWhatsappQueue({ limit: 25 })",
  "WhatsApp operations center drains a bounded batch through the admin server action",
);
includes(
  "src/app/api/admin/whatsapp/templates/approved/route.ts",
  "raw?: unknown",
  "approved templates API must include raw Meta components for media validation",
);
includes(
  "src/lib/admin/actions/whatsapp.ts",
  "phone: WhatsappPhoneSchema",
  "WhatsApp server actions normalize and reject invalid phone numbers before queueing",
);
includes(
  "src/components/admin/whatsapp/bulk-sender.tsx",
  "normalizeValidWhatsappPhone",
  "bulk sender filters invalid phones with the same 8-15 digit WhatsApp rule",
);
includes(
  "src/app/api/whatsapp/inbound/route.ts",
  "nextOptInTags",
  "WhatsApp opt-in/out preserves conversation tags while toggling sin-promos",
);
includes(
  "src/lib/admin/actions/whatsapp.ts",
  "markConversationAsLead",
  "creating a lead from a WhatsApp conversation preserves existing conversation metadata",
);
includes(
  "src/lib/admin/actions/whatsapp.ts",
  '.in("phone", [data.phone, `+${data.phone}`])',
  "WhatsApp lead creation deduplicates existing leads with normalized or +prefixed phone storage",
);

// Media gallery safety: storage paths are resolved server-side from the asset
// row, not trusted from client props.
includes(
  "src/lib/admin/actions/media.ts",
  'select("id, student_id, storage_path")',
  "media deletion loads the authoritative storage path from the database",
);
includes(
  "src/components/admin/gallery/gallery-manager.tsx",
  "deleteMediaAsset(target.id)",
  "gallery delete action does not pass a client-controlled storage path",
);
includes(
  "src/lib/admin/actions/media.ts",
  'data.storagePath.startsWith("http") || !data.storagePath.startsWith(`${data.studentId}/`)',
  "media registration rejects storage paths outside the selected student folder",
);
includes(
  "src/components/admin/gallery/gallery-manager.tsx",
  "let uploadedPath: string | null = null",
  "gallery upload tracks the Storage object until the database row is created",
);
includes(
  "src/components/admin/gallery/gallery-manager.tsx",
  'remove([uploadedPath])',
  "gallery upload cleans up the Storage object if registration fails",
);
includes(
  "src/lib/admin/actions/media.ts",
  "!/^\\d{8,15}$/.test(phone)",
  "gallery WhatsApp sharing rejects tutor phones outside the WhatsApp digit range",
);
includes(
  "src/lib/admin/actions/media.ts",
  "signedError || !signed?.signedUrl",
  "gallery WhatsApp sharing fails clearly if a private media link cannot be signed",
);

// First-party security hardening. No OTP or external service: rate limiting
// and queue execution are Supabase-owned and service-role scoped.
includes(
  "supabase/migrations/20260601090000_whatsapp_admin_security.sql",
  "revoke execute on function public.claim_whatsapp_queue(integer, text, text) from public;",
  "WhatsApp queue RPC is not public",
);
includes(
  "supabase/migrations/20260601090000_whatsapp_admin_security.sql",
  "grant execute on function public.claim_whatsapp_queue(integer, text, text) to service_role;",
  "WhatsApp queue RPC is service-role scoped",
);
includes(
  "supabase/migrations/20260601093000_public_registration_rate_limits.sql",
  "create table if not exists public.registration_rate_limits",
  "public registration rate limits are stored in first-party Supabase",
);
includes(
  "supabase/migrations/20260601093000_public_registration_rate_limits.sql",
  "grant execute on function public.check_registration_rate_limit(text, text, integer, integer) to service_role;",
  "rate-limit function is service-role scoped",
);
includes(
  "supabase/migrations/20260601100000_registration_signature_storage.sql",
  "'registration-signatures'",
  "registration signatures use a private storage bucket",
);
matches(
  "supabase/migrations/20260601100000_registration_signature_storage.sql",
  /'registration-signatures'[\s\S]*false/,
  "registration signatures bucket is private",
);

console.log("Critical flow tests passed");
