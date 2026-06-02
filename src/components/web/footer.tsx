import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CONTACT, PANDA_IMAGES } from "@/components/web/content";
import { WhatsAppIcon } from "@/components/web/whatsapp-icon";
import { BallMark } from "@/components/web/brand-marks";

const NAV_HREFS = [
  { href: "/", labelKey: "school" },
  { href: "/campamentos", labelKey: "camps" },
  { href: "/quienes-somos", labelKey: "about" },
  { href: "/inscripcion", labelKey: "inscription" },
] as const;

/**
 * Sunny footer — giant wordmark, four warm columns, friendly final strip.
 * Keeps the masthead structure of the editorial version but in the
 * family-first palette and friendly typography.
 */
export function WebFooter() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-[var(--rule)] bg-[var(--cream-deep)] text-[var(--forest)]">
      {/* Giant masthead */}
      <div className="border-b border-[var(--rule)]">
        <div className="wrap flex flex-wrap items-center justify-between gap-4 py-12 sm:py-14">
          <div className="flex items-center gap-4">
            <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] shadow-[var(--shadow-card)] sm:h-20 sm:w-20">
              <Image
                src={PANDA_IMAGES.logo}
                alt="Panda Tenis"
                width={80}
                height={80}
                className="h-full w-full object-contain p-1.5"
              />
            </span>
            <h2 className="headline text-[clamp(2.6rem,11vw,8.4rem)] leading-none text-[var(--forest)]">
              Panda<span className="text-[var(--coral)]">·</span>Tenis
            </h2>
          </div>
          <span className="font-script text-[26px] text-[var(--grass-deep)] sm:text-[32px]">
            ¡Hasta pronto en pista!
          </span>
        </div>
      </div>

      <div className="wrap grid gap-10 py-14 sm:py-16 lg:grid-cols-[1.1fr_0.9fr_1fr_0.7fr] lg:gap-14">
        {/* Brand column */}
        <div>
          <span className="sticker text-[var(--coral-deep)]">
            <BallMark className="h-4 w-4" />
            {t("brandTagline")}
          </span>
          <p className="mt-5 max-w-sm text-[14.5px] leading-[1.7] text-[var(--forest-soft)]">
            {t("brandBlurb")}
          </p>
          <a
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--grass)] px-5 text-[13px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
          >
            <WhatsAppIcon className="h-4 w-4" />
            {t("writeWhatsapp")}
          </a>
        </div>

        {/* Pages */}
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
            {t("pages")}
          </p>
          <ul className="mt-5 grid gap-3">
            {NAV_HREFS.map((link, i) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="group inline-flex items-baseline gap-3 font-display text-[19px] font-bold text-[var(--forest)] transition-colors hover:text-[var(--coral)]"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--sun-soft)] text-[10px] font-extrabold text-[var(--forest)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {tNav(link.labelKey)}
                  <ArrowRight
                    className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                    strokeWidth={2.4}
                  />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/privacy-policy"
                className="inline-flex items-center gap-2 text-[12px] font-bold text-[var(--forest-mute)] hover:text-[var(--forest)]"
              >
                {tNav("privacyPolicy")}
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
            {t("contact")}
          </p>
          <ul className="mt-5 grid gap-5">
            <li>
              <a
                href={CONTACT.phoneHref}
                className="group flex items-start gap-3 text-[14.5px] text-[var(--forest)] transition-colors hover:text-[var(--coral)]"
              >
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--rule)] bg-[var(--sun)]"
                >
                  <Phone className="h-4 w-4 text-[var(--forest)]" strokeWidth={2.2} />
                </span>
                <span>
                  <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
                    {t("labelPhone")}
                  </span>
                  <span className="mt-0.5 block font-display text-[17px] font-bold leading-tight">
                    {CONTACT.phoneDisplay}
                  </span>
                </span>
              </a>
            </li>
            <li>
              <a
                href={CONTACT.emailHref}
                className="group flex items-start gap-3 text-[14.5px] text-[var(--forest)] transition-colors hover:text-[var(--coral)]"
              >
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--rule)] bg-[var(--coral)]"
                >
                  <Mail className="h-4 w-4 text-white" strokeWidth={2.2} />
                </span>
                <span>
                  <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
                    {t("labelEmail")}
                  </span>
                  <span className="mt-0.5 block text-[14px] leading-tight">{CONTACT.email}</span>
                </span>
              </a>
            </li>
            <li>
              <a
                href={CONTACT.mapsHref}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-3 text-[14.5px] text-[var(--forest)] transition-colors hover:text-[var(--coral)]"
              >
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--rule)] bg-[var(--sky)]"
                >
                  <MapPin className="h-4 w-4 text-[var(--forest)]" strokeWidth={2.2} />
                </span>
                <span>
                  <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
                    {t("labelLocation")}
                  </span>
                  <span className="mt-0.5 block text-[13.5px] leading-snug">
                    {CONTACT.addressLines.join(", ")}
                  </span>
                </span>
              </a>
            </li>
          </ul>
        </div>

        {/* Admin */}
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
            {t("management")}
          </p>
          <Link
            href="/admin"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--cream-soft)] px-4 text-[12px] font-extrabold text-[var(--forest)] shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
          >
            {t("adminPanel")}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-[var(--rule)] bg-[var(--forest)] text-[var(--cream-soft)]">
        <div className="wrap flex flex-col items-start gap-2 py-5 text-[11.5px] font-bold uppercase tracking-wider sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year })}</p>
          <p className="flex items-center gap-2 text-[var(--sun)]">
            <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--sun)]" />
            {t("courseOpen")}
          </p>
        </div>
      </div>
    </footer>
  );
}
