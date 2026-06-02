import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ContactBand } from "@/components/web/contact-band";
import { RegistrationWizard } from "@/components/web/registration-wizard/wizard";
import { CONTACT } from "@/components/web/content";
import { resolveInviteCourse, type RegistrationKind } from "@/lib/web/course-resolver";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Params = { locale: string; token: string };

export const dynamic = "force-dynamic";

const COPY = {
  es: {
    metaTitle: "Completar ficha de inscripción",
    metaDescription: "Ficha privada de Panda Tenis para completar los datos del alumno.",
    privateBadge: "Ficha privada",
    title: "Completar inscripción",
    description:
      "Ya hemos hablado por WhatsApp. Ahora solo falta completar los datos para dejar la ficha lista.",
    expiredTitle: "Enlace no disponible",
    expiredDescription:
      "Esta ficha ha caducado o ya no existe. Escríbenos por WhatsApp y te enviamos un enlace nuevo.",
    completedTitle: "Ficha ya completada",
    completedDescription:
      "Esta ficha ya está registrada. Si necesitas corregir algún dato, escríbenos por WhatsApp y te enviamos un enlace nuevo.",
    whatsapp: "Abrir WhatsApp",
  },
  en: {
    metaTitle: "Complete registration form",
    metaDescription: "Private Panda Tenis form to complete the student's details.",
    privateBadge: "Private form",
    title: "Complete registration",
    description:
      "We have already spoken on WhatsApp. Now we just need the details to finish the registration form.",
    expiredTitle: "Link unavailable",
    expiredDescription:
      "This form has expired or no longer exists. Message us on WhatsApp and we will send you a new link.",
    completedTitle: "Form already completed",
    completedDescription:
      "This form has already been registered. If you need to correct any details, message us on WhatsApp and we will send you a new link.",
    whatsapp: "Open WhatsApp",
  },
} as const;

function copyFor(locale: string) {
  return locale === "en" ? COPY.en : COPY.es;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = copyFor(locale);
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
  };
}

function UnavailableInvite({
  locale,
  reason,
}: {
  locale: string;
  reason: "expired" | "completed";
}) {
  const copy = copyFor(locale);
  const title = reason === "completed" ? copy.completedTitle : copy.expiredTitle;
  const description =
    reason === "completed" ? copy.completedDescription : copy.expiredDescription;

  return (
    <>
      <section className="relative overflow-hidden border-b-2 border-[var(--forest)] bg-[var(--coral)] px-5 pb-16 pt-32 text-white sm:px-8 sm:pt-40 lg:px-10">
        <div className="relative mx-auto max-w-[920px]">
          <h1 className="headline text-[clamp(2.3rem,7vw,4.6rem)] text-white">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] font-semibold leading-relaxed text-white/90">
            {description}
          </p>
          <a
            href={CONTACT.whatsappHref}
            className="mt-8 inline-flex h-12 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--sun)] px-6 text-[13.5px] font-extrabold text-[var(--forest)] shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
          >
            {copy.whatsapp}
          </a>
        </div>
      </section>
      <ContactBand />
    </>
  );
}

export default async function RegistrationInvitePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const copy = copyFor(locale);
  const requestTime = new Date().toISOString();

  if (!isSupabaseConfigured()) notFound();
  const supabase = createServiceRoleClient();
  const { data: invite, error } = await supabase
    .from("registrations")
    .select(
      "id, type, course_slug, invite_expires_at, invite_status",
    )
    .eq("invite_token", token)
    .maybeSingle();

  if (error) throw error;
  if (!invite) return <UnavailableInvite locale={locale} reason="expired" />;

  if (invite.invite_status === "completed") {
    return <UnavailableInvite locale={locale} reason="completed" />;
  }
  if (
    invite.invite_status === "expired" ||
    (invite.invite_expires_at && invite.invite_expires_at < requestTime)
  ) {
    return <UnavailableInvite locale={locale} reason="expired" />;
  }
  if (!["draft", "sent"].includes(String(invite.invite_status))) {
    return <UnavailableInvite locale={locale} reason="expired" />;
  }

  const type = invite.type as RegistrationKind;
  const course = await resolveInviteCourse(type, invite.course_slug);

  return (
    <>
      <section className="relative overflow-hidden border-b-2 border-[var(--forest)] bg-[var(--grass)] px-5 pb-16 pt-32 text-white sm:px-8 sm:pt-40 lg:px-10">
        <div className="relative mx-auto max-w-[1100px]">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--sun)] px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-wider text-[var(--forest)] shadow-[var(--shadow-card)]">
            {copy.privateBadge}
          </span>
          <h1 className="mt-5 max-w-4xl headline text-[clamp(2.4rem,7vw,5rem)] text-white">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] font-semibold leading-relaxed text-white/90">
            {copy.description}
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap max-w-[920px]">
          <RegistrationWizard
            inviteToken={token}
            initialCourse={course}
            availableCourses={[course]}
          />
        </div>
      </section>

      <ContactBand />
    </>
  );
}
