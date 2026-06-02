import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Gift, HeartHandshake, PartyPopper, Sparkles, Users, type LucideIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CONTACT, PANDA_IMAGES } from "@/components/web/content";
import { ContactBand } from "@/components/web/contact-band";
import { PageHero } from "@/components/web/page-hero";
import { SectionHeading } from "@/components/web/section-heading";
import { WhatsAppIcon } from "@/components/web/whatsapp-icon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.about" });
  return { title: t("title"), description: t("description") };
}

const GOAL_KEYS = ["promote", "values", "events", "help"] as const;
const GOAL_TOKENS: Record<
  (typeof GOAL_KEYS)[number],
  { Icon: LucideIcon; bg: string; bar: string }
> = {
  promote: { Icon: Users,          bg: "var(--grass-soft)", bar: "var(--grass)" },
  values:  { Icon: HeartHandshake, bg: "var(--coral-soft)", bar: "var(--coral)" },
  events:  { Icon: PartyPopper,    bg: "var(--sun-soft)",   bar: "var(--sun)" },
  help:    { Icon: Gift,           bg: "var(--sky-soft)",   bar: "var(--sky)" },
};

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const tags = t.raw("origin.tags") as string[];

  return (
    <>
      <PageHero
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        description={t("hero.description")}
        imageSrc={PANDA_IMAGES.asociacionBanner}
        imageAlt="Panda Tenis"
        actions={
          <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" className="btn btn-coral">
            {t("hero.cta")}
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
          </a>
        }
      />

      {/* ── Origen ── */}
      <section className="section">
        <div className="wrap grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--cream-soft)] shadow-[var(--shadow-md)]">
            <Image
              src={PANDA_IMAGES.grupo}
              alt="Panda Tenis"
              width={1020}
              height={765}
              className="h-full max-h-[520px] w-full object-cover"
              sizes="(min-width: 1024px) 40vw, 100vw"
            />
          </div>
          <div>
            <SectionHeading
              align="left"
              index="ORIGEN"
              eyebrow={t("origin.eyebrow")}
              title={t("origin.title")}
              description={t("origin.description")}
            />
            <div className="mt-8 grid gap-5 text-[15.5px] leading-[1.75] text-[var(--forest-soft)]">
              <p>{t("origin.p1")}</p>
              <p>{t("origin.p2")}</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--rule)] bg-[var(--sun-soft)] px-4 py-2 text-[13px] font-bold text-[var(--forest)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Asociación banner ── */}
      <section className="section">
        <div className="wrap grid gap-6 lg:grid-cols-[1fr_0.7fr] lg:items-stretch">
          <div className="overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--grass-soft)] shadow-[var(--shadow-md)]">
            <Image
              src={PANDA_IMAGES.laDiversiva}
              alt="Panda Tenis"
              width={768}
              height={512}
              className="h-full max-h-[460px] w-full object-cover"
              sizes="(min-width: 1024px) 55vw, 100vw"
            />
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--grass)] p-8 text-white shadow-[var(--shadow-md)]">
            <Sparkles className="h-9 w-9 text-[var(--sun)]" strokeWidth={2} />
            <h2 className="mt-5 headline text-[clamp(1.8rem,4vw,2.4rem)] text-white">
              {t("association.title")}
            </h2>
            <p className="mt-5 text-[14.5px] leading-[1.7] text-white/90">{t("association.description")}</p>
            <a
              href={CONTACT.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--sun)] px-5 text-[13px] font-extrabold text-[var(--forest)] shadow-[var(--shadow-card)] transition-transform duration-300 ease-out hover:-translate-y-0.5"
            >
              <WhatsAppIcon className="h-4 w-4" />
              {t("association.cta")}
            </a>
          </div>
        </div>
      </section>

      {/* ── Objetivos ── */}
      <section className="section">
        <div className="wrap">
          <SectionHeading
            index="OBJETIVOS"
            eyebrow={t("goals.eyebrow")}
            title={t("goals.title")}
            description={t("goals.description")}
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {GOAL_KEYS.map((gk) => {
              const v = GOAL_TOKENS[gk];
              const Icon = v.Icon;
              return (
                <article
                  key={gk}
                  className="lift flex flex-col gap-4 rounded-2xl border border-[var(--rule)] p-7 shadow-[var(--shadow-card)]"
                  style={{ background: v.bg }}
                >
                  <span
                    aria-hidden
                    className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)]"
                  >
                    <Icon className="h-5 w-5 text-[var(--forest)]" strokeWidth={2.2} />
                  </span>
                  <h2 className="font-display text-[19px] font-bold leading-tight text-[var(--forest)]">
                    {t(`goals.items.${gk}.title`)}
                  </h2>
                  <p className="text-[14px] leading-[1.6] text-[var(--forest-soft)]">
                    {t(`goals.items.${gk}.text`)}
                  </p>
                  <span className="mt-auto inline-block h-1 w-12 rounded-full" style={{ background: v.bar }} />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Participa ── */}
      <section className="section">
        <div className="wrap grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="grid grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--cream-soft)] shadow-[var(--shadow-card)]">
              <Image
                src={PANDA_IMAGES.bolasAlAire}
                alt="Panda Tenis"
                width={521}
                height={697}
                className="h-full max-h-[440px] w-full object-cover"
              />
            </div>
            <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--cream-soft)] shadow-[var(--shadow-card)]">
              <Image
                src={PANDA_IMAGES.clasePista}
                alt="Panda Tenis"
                width={544}
                height={726}
                className="h-full max-h-[440px] w-full object-cover"
              />
            </div>
          </div>
          <div>
            <SectionHeading
              align="left"
              index="PARTICIPA"
              eyebrow={t("participate.eyebrow")}
              title={t("participate.title")}
              description={t("participate.description")}
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" className="btn btn-coral">
                {t("participate.ctaSignUp")}
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </a>
              <Link href="/campamentos" className="btn btn-ghost">
                {t("participate.ctaCamps")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ContactBand />
    </>
  );
}
