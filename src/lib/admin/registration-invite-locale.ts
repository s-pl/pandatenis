export type InviteLocale = "es" | "en";

const LOCALE_NOTE_PREFIX = "Idioma enlace:";
const LOCALE_NOTE_RE = /Idioma enlace:\s*(es|en)\b/i;
const STAFF_NOTE_PREFIX = "Creado por staff:";
const STAFF_NOTE_RE = /Creado por staff:\s*([0-9a-f-]{36})\b/i;

export function inviteLocaleFromNotes(notes: string | null | undefined): InviteLocale {
  const match = LOCALE_NOTE_RE.exec(notes ?? "");
  return match?.[1]?.toLowerCase() === "en" ? "en" : "es";
}

export function inviteLocaleFromRow(row: {
  admin_notes?: string | null;
  invite_locale?: string | null;
}): InviteLocale {
  if (row.invite_locale === "en") return "en";
  if (row.invite_locale === "es") return "es";
  return inviteLocaleFromNotes(row.admin_notes);
}

export function withInviteLocaleNote(
  notes: string | null | undefined,
  locale: InviteLocale,
) {
  const current = notes?.trim() ?? "";
  const localeNote = `${LOCALE_NOTE_PREFIX} ${locale}`;
  if (!current) return localeNote;
  if (LOCALE_NOTE_RE.test(current)) return current.replace(LOCALE_NOTE_RE, localeNote);
  return `${localeNote}\n${current}`;
}

export function withInviteStaffNote(
  notes: string | null | undefined,
  staffId: string,
) {
  const current = notes?.trim() ?? "";
  const staffNote = `${STAFF_NOTE_PREFIX} ${staffId}`;
  if (!current) return staffNote;
  if (STAFF_NOTE_RE.test(current)) return current.replace(STAFF_NOTE_RE, staffNote);
  return `${staffNote}\n${current}`;
}

export function inviteStaffFilter(staffId: string) {
  return `${STAFF_NOTE_PREFIX} ${staffId}`;
}

export function stripInviteInternalNotes(notes: string | null | undefined) {
  return (notes ?? "")
    .split(/\r?\n/)
    .filter((line) => !STAFF_NOTE_RE.test(line))
    .join("\n")
    .trim();
}

export function isMissingInviteLocaleColumn(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return code === "42703" || (message.includes("invite_locale") && message.includes("does not exist"));
}
