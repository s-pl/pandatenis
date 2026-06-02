"use client";

import {
  CheckCircle2,
  Copy,
  FilePlus2,
  Globe2,
  GraduationCap,
  Link as LinkIcon,
  Sparkles,
  Sun,
} from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  createRegistrationInviteAction,
  markRegistrationInviteSentAction,
} from "@/lib/admin/actions/registrations";
import { cn } from "@/lib/utils";

type CourseOption = {
  slug: string;
  label: string;
  kind: "escuela" | "campus";
};

type InviteType = "escuela" | "campus";
type InviteLocale = "es" | "en";

export function RegistrationInviteDialog({
  courses = [],
  defaultType = "escuela",
  defaultGuardianName = "",
  defaultPhone = "",
  triggerLabel = "Crear ficha",
  triggerVariant = "primary",
  triggerSize = "md",
  triggerClassName,
  renderTrigger,
  lockedCampus,
}: {
  courses?: CourseOption[];
  defaultType?: InviteType;
  defaultGuardianName?: string;
  defaultPhone?: string;
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary" | "ghost";
  triggerSize?: "sm" | "md";
  triggerClassName?: string;
  renderTrigger?: (open: () => void) => ReactNode;
  /**
   * Si se pasa, la ficha queda fijada a este campus: se ocultan el selector de
   * tipo (escuela/campus) y el de convocatoria, y siempre se crea para él.
   */
  lockedCampus?: { slug: string; label: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<InviteType>(lockedCampus ? "campus" : defaultType);
  const [locale, setLocale] = useState<InviteLocale>("es");
  const [courseSlug, setCourseSlug] = useState(lockedCampus?.slug ?? "");
  const [created, setCreated] = useState<{ id: string; url: string } | null>(null);

  const campusCourses = useMemo(
    () => courses.filter((course) => course.kind === "campus"),
    [courses],
  );
  const schoolCourse = courses.find((course) => course.kind === "escuela");
  const selectedCampus = campusCourses.find((course) => course.slug === courseSlug);
  const selectedLabel = lockedCampus
    ? lockedCampus.label
    : type === "campus"
      ? selectedCampus?.label ?? "Campus pendiente de concretar"
      : schoolCourse?.label ?? "Clases normales";

  function resetForm() {
    setType(lockedCampus ? "campus" : defaultType);
    setLocale("es");
    setCourseSlug(lockedCampus?.slug ?? "");
    setCreated(null);
  }

  function close() {
    setOpen(false);
    resetForm();
  }

  function createInvite() {
    startTransition(async () => {
      const result = await createRegistrationInviteAction({
        type,
        locale,
        guardianName: defaultGuardianName,
        phone: defaultPhone,
        courseSlug:
          type === "campus"
            ? courseSlug
            : schoolCourse?.slug ?? "escuela-2025-2026",
      });
      if (!result.ok) {
        toast.error("No se ha podido crear la ficha", { description: result.error });
        return;
      }
      if (!result.data) {
        toast.error("No se ha podido crear la ficha");
        return;
      }
      setCreated({ id: result.data.id, url: result.data.url });
      toast.success("Ficha creada");
      router.refresh();
    });
  }

  async function copyUrl() {
    if (!created) return;
    await navigator.clipboard.writeText(created.url);
    const result = await markRegistrationInviteSentAction(created.id);
    if (result.ok) {
      toast.success("Enlace copiado");
    } else {
      toast.warning("Enlace copiado, pero no se marcó como enviado", {
        description: result.error,
      });
    }
    router.refresh();
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <Button
          type="button"
          size={triggerSize}
          variant={triggerVariant === "primary" ? undefined : triggerVariant}
          className={triggerClassName}
          iconLeft={<FilePlus2 className="h-4 w-4" />}
          onClick={() => setOpen(true)}
        >
          {triggerLabel}
        </Button>
      )}

      <Modal
        open={open}
        onClose={close}
        title="Crear enlace de inscripción"
        description="Elige el tipo de ficha. La familia rellenará todos los datos del alumno desde el enlace privado."
        icon={<FilePlus2 className="h-5 w-5" />}
        tone={created ? "success" : "primary"}
        size="lg"
      >
        <div className="grid gap-5">
          {lockedCampus ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--primary)] bg-[var(--primary-soft)] p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[var(--primary)]">
                <Sun className="h-4 w-4" />
              </span>
              <p className="text-[13px] text-[var(--foreground)]">
                Ficha privada para <strong>{lockedCampus.label}</strong>
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <InviteTypeCard
                active={type === "escuela"}
                disabled={Boolean(created)}
                icon={<GraduationCap className="h-5 w-5" />}
                title="Clases normales"
                description={schoolCourse?.label ?? "Curso regular de Panda Tenis"}
                onClick={() => setType("escuela")}
              />
              <InviteTypeCard
                active={type === "campus"}
                disabled={Boolean(created)}
                icon={<Sun className="h-5 w-5" />}
                title="Campus"
                description="Enlace para campus genérico o convocatoria concreta."
                onClick={() => setType("campus")}
              />
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-[var(--forest)]">
              <Globe2 className="h-4 w-4" />
              Idioma de la ficha
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LanguageButton
                active={locale === "es"}
                disabled={Boolean(created)}
                label="Español"
                description="/es/inscripcion"
                onClick={() => setLocale("es")}
              />
              <LanguageButton
                active={locale === "en"}
                disabled={Boolean(created)}
                label="English"
                description="/en/inscripcion"
                onClick={() => setLocale("en")}
              />
            </div>
          </div>

          {!lockedCampus && type === "campus" && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <label className="grid gap-2">
                <span className="text-[13px] font-extrabold text-[var(--forest)]">
                  Convocatoria de campus
                </span>
                <Select
                  value={courseSlug}
                  onChange={(event) => setCourseSlug(event.target.value)}
                  disabled={Boolean(created)}
                >
                  <option value="">Campus pendiente de concretar</option>
                  {campusCourses.map((course) => (
                    <option key={course.slug} value={course.slug}>
                      {course.label}
                    </option>
                  ))}
                </Select>
                <span className="text-[12px] text-[var(--forest-mute)]">
                  Déjalo en pendiente si todavía no sabes fechas o convocatoria.
                </span>
              </label>
            </div>
          )}

          {!created && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--foreground)]">Listo para generar</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Se creará una ficha pendiente de {selectedLabel.toLowerCase()}. No hace falta
                    saber el nombre del niño ni ningún dato familiar.
                  </p>
                  {(defaultGuardianName || defaultPhone) && (
                    <p className="mt-2 text-xs font-medium text-[var(--muted)]">
                      Se conservará el contexto del chat para localizar este enlace después.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {created && (
            <div className="rounded-2xl border border-[var(--success)] bg-[var(--success-soft)] p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[var(--success)]">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--foreground)]">
                    Enlace creado para {selectedLabel}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Envíalo a la familia para que complete la ficha en {locale === "en" ? "inglés" : "español"}.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input
                      readOnly
                      value={created.url}
                      iconLeft={<LinkIcon className="h-4 w-4" />}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      iconLeft={<Copy className="h-4 w-4" />}
                      onClick={copyUrl}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              {created ? "Cerrar" : "Cancelar"}
            </Button>
            {!created && (
              <Button type="button" loading={pending} onClick={createInvite}>
                Crear enlace
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

function LanguageButton({
  active,
  disabled,
  label,
  description,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70",
        active
          ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--primary)]",
      )}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-0.5 block truncate text-[11px]">{description}</span>
    </button>
  );
}

function InviteTypeCard({
  active,
  disabled,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex min-h-[132px] flex-col items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70",
        active
          ? "border-[var(--primary)] bg-[var(--primary-soft)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]",
      )}
    >
      <span
        className={cn(
          "grid h-11 w-11 place-items-center rounded-xl border",
          active
            ? "border-[var(--primary)] bg-[var(--surface)] text-[var(--primary)]"
            : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] group-hover:text-[var(--primary)]",
        )}
      >
        {icon}
      </span>
      <span className="grid gap-1">
        <span className="font-semibold text-[var(--foreground)]">{title}</span>
        <span className="text-sm leading-relaxed text-[var(--muted)]">{description}</span>
      </span>
    </button>
  );
}
