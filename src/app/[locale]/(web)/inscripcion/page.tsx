import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactBand } from "@/components/web/contact-band";
import { CONTACT } from "@/components/web/content";
import { WhatsAppIcon } from "@/components/web/whatsapp-icon";
import { BallMark } from "@/components/web/brand-marks";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.inscription" });
  return { title: t("title"), description: t("description") };
}

export default async function InscripcionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("inscription");

  return (
    <>
      <section className="relative overflow-hidden border-b border-[var(--rule)] bg-[var(--grass)] px-5 pb-16 pt-32 text-white sm:px-8 sm:pt-40 lg:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage: "radial-gradient(circle, var(--cream-soft) 1.4px, transparent 1.4px)",
            backgroundSize: "28px 28px",
          }}
        />
        <BallMark className="absolute right-10 top-28 hidden h-14 w-14 opacity-60 float-slow sm:block" />
        <div className="relative mx-auto max-w-[1300px]">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--sun)] px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-wider text-[var(--forest)] shadow-[var(--shadow-card)]">
            <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--coral)] pulse-ring" />
            {t("openBadge")}
          </span>
          <h1 className="mt-5 max-w-4xl headline text-[clamp(2.6rem,8vw,5.6rem)] text-white">
            {t("title")}
          </h1>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap max-w-[920px]">
          <div className="rounded-3xl border border-[var(--rule)] bg-[var(--cream-soft)] p-8 shadow-[var(--shadow-md)] sm:p-12">
            <p className="text-[12px] font-extrabold uppercase tracking-wider text-[var(--coral-deep)]">
              Inscripción por WhatsApp
            </p>
            <h2 className="mt-3 headline text-[clamp(1.9rem,5vw,3.2rem)] text-[var(--forest)]">
              Primero hablamos y después te paso tu ficha privada.
            </h2>
            <p className="mt-5 max-w-2xl text-[15.5px] leading-[1.8] text-[var(--forest-soft)]">
              Para clases normales o campus, escríbeme por WhatsApp. Cuando confirmemos plaza, horario o convocatoria,
              crearé una ficha básica desde el panel y te enviaré un enlace para completar todos los datos del alumno.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <a
                href="https://wa.me/34633739312?text=Hola%2C%20quiero%20informaci%C3%B3n%20para%20clases%20normales%20de%20Panda%20Tenis."
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--grass)] px-5 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Clases normales
              </a>
              <a
                href="https://wa.me/34633739312?text=Hola%2C%20quiero%20informaci%C3%B3n%20para%20el%20campus%20de%20Panda%20Tenis."
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--coral)] px-5 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Campus
              </a>
            </div>

            <p className="mt-5 text-sm font-semibold text-[var(--forest)]">
              También puedes llamar al{" "}
              <a href={CONTACT.phoneHref} className="underline decoration-[var(--sun)] decoration-2 underline-offset-4">
                +34 {CONTACT.phoneDisplay}
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <ContactBand />
    </>
  );
}
