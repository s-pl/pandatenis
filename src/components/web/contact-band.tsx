import { useTranslations } from "next-intl";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { BallMark } from "@/components/web/brand-marks";
import { CONTACT } from "@/components/web/content";
import { Reveal } from "@/components/web/reveal";
import { WhatsAppIcon } from "@/components/web/whatsapp-icon";

export function ContactBand() {
  const t = useTranslations("contactBand");
  return (
    <section
      id="contacto"
      className="relative overflow-hidden border-t-2 border-[var(--forest)] bg-[var(--forest)] text-white section"
    >
      {/* Polka pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, var(--cream-soft) 1.4px, transparent 1.4px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Floating ball — single quiet brand accent */}
      <BallMark className="absolute right-12 top-14 hidden h-12 w-12 opacity-70 float-slow sm:block" />

      <div className="wrap grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <Reveal>
          <span className="sticker bg-[var(--sun)] text-[var(--forest)]">
            <Phone aria-hidden className="h-4 w-4" strokeWidth={2.2} />
            {t("eyebrow")}
          </span>
          <h2 className="mt-5 headline text-[clamp(2rem,5vw,3.4rem)] text-white">
            {t("title")}
          </h2>
          <p className="mt-5 max-w-[52ch] text-[15.5px] leading-[1.7] text-white/85 sm:text-[17px]">
            {t("description")}
          </p>
        </Reveal>

        <Reveal className="grid gap-3" delay={0.08}>
          <a
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--grass)] px-5 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform duration-300 ease-out hover:-translate-y-0.5"
          >
            <WhatsAppIcon className="h-4 w-4" />
            {t("whatsapp")}
          </a>
          <a
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--sun)] px-5 text-[13.5px] font-extrabold text-[var(--forest)] shadow-[var(--shadow-card)] transition-transform duration-300 ease-out hover:-translate-y-0.5"
          >
            {t("form")}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </a>
        </Reveal>

        <Reveal
          className="grid gap-4 border-t-2 border-white/15 pt-8 sm:grid-cols-3 lg:col-span-2"
          delay={0.16}
        >
          {[
            { id: "phone", Icon: Phone, label: t("labelPhone"), href: CONTACT.phoneHref, value: CONTACT.phoneDisplay, color: "var(--sun)", external: false },
            { id: "email", Icon: Mail, label: t("labelEmail"), href: CONTACT.emailHref, value: CONTACT.email, color: "var(--coral)", external: false },
            { id: "location", Icon: MapPin, label: t("labelLocation"), href: CONTACT.mapsHref, value: CONTACT.addressLines.join(", "), color: "var(--sky)", external: true },
          ].map(({ id, Icon, label, href, value, color, external }) => (
            <a
              key={id}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              className="group flex items-start gap-3 text-white/90 transition-transform hover:-translate-y-0.5"
            >
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/15"
                style={{ background: color }}
              >
                <Icon className="h-4 w-4 text-[var(--forest)]" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-white/60">
                  {label}
                </span>
                <span className="mt-0.5 block text-[14.5px] font-bold leading-snug">{value}</span>
              </span>
            </a>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
