import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Brain,
  CalendarCheck,
  ChevronDown,
  Globe,
  Heart,
  HeartHandshake,
  Medal,
  MessageCircle,
  PersonStanding,
  Shield,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CONTACT, PANDA_IMAGES } from "@/components/web/content";
import { ContactBand } from "@/components/web/contact-band";
import { SectionHeading } from "@/components/web/section-heading";
import { WhatsAppIcon } from "@/components/web/whatsapp-icon";
import { LevelFinder } from "@/components/web/level-finder";
import { RegistrationPaths } from "@/components/web/registration-paths";
import { FloatingCallout } from "@/components/web/floating-callout";
import { BallMark } from "@/components/web/brand-marks";

export async function generateHomeMetadata(locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "metadata.home" });
  return { title: t("title"), description: t("description") };
}

export const homeMetadata: Metadata = {};

const REASON_KEYS = ["technique", "pandaGame", "psicomotor", "fun"] as const;
const REASON_TOKENS: Record<
  (typeof REASON_KEYS)[number],
  { Icon: LucideIcon; bg: string; bar: string; ink: string }
> = {
  technique:  { Icon: Target,         bg: "var(--grass-soft)",  bar: "var(--grass)",  ink: "var(--grass-deep)" },
  pandaGame:  { Icon: Brain,          bg: "var(--coral-soft)",  bar: "var(--coral)",  ink: "var(--coral-deep)" },
  psicomotor: { Icon: PersonStanding, bg: "var(--sky-soft)",    bar: "var(--sky)",    ink: "var(--sky-deep)" },
  fun:        { Icon: HeartHandshake, bg: "var(--sun-soft)",    bar: "var(--sun)",    ink: "var(--sun-deep)" },
};

const STEP_KEYS = ["write", "places", "start"] as const;
const STEP_SCORE = { write: "15", places: "30", start: "40" } as const;
const STEP_ICON: Record<(typeof STEP_KEYS)[number], LucideIcon> = {
  write: MessageCircle,
  places: CalendarCheck,
  start: Target,
};

const LEVEL_KEYS = ["red", "orange", "green", "yellow"] as const;
const LEVEL_COLOR: Record<(typeof LEVEL_KEYS)[number], string> = {
  red: "#F26B5E",
  orange: "#F39B3E",
  green: "#25924F",
  yellow: "#F1B934",
};

const VALUE_KEYS = ["environment", "sports", "community", "allCount"] as const;
const VALUE_ICON = {
  environment: Shield,
  sports: Heart,
  community: Users,
  allCount: Medal,
} as const;
const VALUE_TINT: Record<(typeof VALUE_KEYS)[number], { bg: string; ink: string }> = {
  environment: { bg: "var(--grass-soft)", ink: "var(--grass-deep)" },
  sports:      { bg: "var(--coral-soft)", ink: "var(--coral-deep)" },
  community:   { bg: "var(--sky-soft)",   ink: "var(--sky-deep)" },
  allCount:    { bg: "var(--sun-soft)",   ink: "var(--sun-deep)" },
};

const GALLERY = [
  { src: PANDA_IMAGES.ninoDerecha,             tagKey: "court",      span: "lg:col-span-7 lg:row-span-2" },
  { src: PANDA_IMAGES.ninoPelotaRoja,          tagKey: "start",      span: "lg:col-span-5" },
  { src: PANDA_IMAGES.ninaVolea,               tagKey: "technique",  span: "lg:col-span-3" },
  { src: PANDA_IMAGES.ninaCestaPelotas,        tagKey: "material",   span: "lg:col-span-2" },
  { src: PANDA_IMAGES.psicomotricidadCircuito, tagKey: "psicomotor", span: "lg:col-span-7" },
  { src: PANDA_IMAGES.pistaAtardecer,          tagKey: "riviera",    span: "lg:col-span-5" },
] as const;

export default function HomeContent() {
  const t = useTranslations("home");
  const faqs = (t.raw("faq.items") as Array<{ question: string; answer: string }>) ?? [];

  return (
    <>
      {/* ────────────────────────────────────────────────────────────
          1. HERO — copy + polaroid collage
          ──────────────────────────────────────────────────────────── */}
      <section data-gsap-hero className="relative isolate overflow-hidden pt-28 sm:pt-32 lg:pt-36">
        {/* Friendly haloes */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(242,179,60,0.16),transparent_55%),radial-gradient(ellipse_at_85%_85%,rgba(126,196,232,0.14),transparent_60%)]" />
          {/* Dotted court polka */}
          <svg className="absolute inset-0 h-full w-full opacity-[0.08]" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="polka" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="var(--forest)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#polka)" />
          </svg>
        </div>

        <div className="wrap grid w-full gap-12 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-24">
          {/* Copy */}
          <div className="relative">
            <div className="rise-1 mb-6 flex flex-wrap items-center gap-3">
              <span className="sticker text-[var(--grass-deep)]">
                <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--coral)] pulse-ring" />
                {t("hero.badge")}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--lilac-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--lilac-deep)]">
                <BallMark className="h-3.5 w-3.5" />
                {t("hero.ngoPill")}
              </span>
            </div>

            <h1 className="rise-2 headline text-[clamp(2.6rem,8vw,5.6rem)] text-[var(--forest)]">
              {t("hero.titleStart")}{" "}
              <span className="relative inline-block">
                <span className="wave-underline relative z-10 text-[var(--coral)]">
                  {t("hero.titleHighlight")}
                </span>
              </span>
            </h1>

            <p className="rise-3 mt-7 max-w-[40ch] text-[16px] leading-[1.65] text-[var(--forest-soft)] sm:text-[18px]">
              {t("hero.subtitle")}
            </p>

            <div className="rise-4 mt-9 flex flex-wrap items-center gap-3">
              <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" className="btn btn-coral">
                {t("hero.ctaClasses")}
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </a>
              <Link href="/campamentos" className="btn btn-ghost">
                {t("hero.ctaCamps")}
              </Link>
              <a
                href={CONTACT.whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--grass-soft)] px-4 py-2 text-[13px] font-bold text-[var(--grass-deep)] hover:bg-[var(--grass)] hover:text-white"
              >
                <WhatsAppIcon className="h-4 w-4" />
                {CONTACT.phoneDisplay}
              </a>
            </div>

            {/* Stat card — three friendly tiles */}
            <div className="rise-5 mt-10 grid grid-cols-3 gap-3 sm:max-w-md">
              {[
                { value: "90%", label: t("hero.stats.retention"), bg: "var(--grass-soft)", ink: "var(--grass-deep)" },
                { value: "3+",  label: t("hero.stats.fromAge"),   bg: "var(--coral-soft)", ink: "var(--coral-deep)" },
                { value: "1h",  label: t("hero.stats.duration"),  bg: "var(--sky-soft)",   ink: "var(--sky-deep)" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="lift rounded-2xl border border-[var(--rule)] px-3.5 py-4 text-left shadow-[var(--shadow-card)] sm:px-4 sm:py-5"
                  style={{ background: s.bg }}
                >
                  <p className="score text-[32px] sm:text-[36px]" style={{ color: s.ink }}>{s.value}</p>
                  <p className="mt-2 text-[11px] font-bold leading-[1.3] text-[var(--forest)] sm:text-[11.5px]">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Polaroid collage */}
          <div className="relative h-[420px] w-full sm:h-[560px] lg:h-auto lg:min-h-[600px]">
            <div className="wobble-in absolute inset-x-2 top-0 h-[82%] overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] shadow-[var(--shadow-lg)] sm:h-[78%]">
              <div className="absolute inset-2 overflow-hidden rounded-xl">
                <Image
                  src={PANDA_IMAGES.pistaAtardecer}
                  alt="Panda Tenis"
                  fill
                  priority
                  className="object-cover"
                  sizes="(min-width: 1024px) 560px, 100vw"
                />
              </div>
              <div className="absolute inset-x-2 bottom-2 rounded-xl bg-[var(--cream-soft)]/0">
                <p className="font-script text-[22px] text-[var(--forest)] drop-shadow-[0_2px_0_rgba(255,255,255,0.8)] sm:text-[26px]">
                  ¡{t("hero.stats.location")}!
                </p>
              </div>
            </div>

            <div className="rise-6 absolute -right-2 bottom-0 hidden h-[42%] w-[58%] overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] shadow-[var(--shadow-lg)] sm:block">
              <div className="absolute inset-2 overflow-hidden rounded-xl">
                <Image
                  src={PANDA_IMAGES.ninaCestaPelotas}
                  alt="Panda Tenis"
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              </div>
              <span className="absolute right-3 top-3 rounded-full bg-[var(--sun)] border border-[var(--rule)] px-2.5 py-0.5 text-[11px] font-extrabold text-[var(--forest)]">
                {t("hero.course")}
              </span>
            </div>

            {/* Bouncing tennis ball */}
            <div aria-hidden className="ball-bounce absolute -left-4 top-[58%] hidden h-16 w-16 sm:block lg:left-auto lg:right-12 lg:top-[8%] lg:h-20 lg:w-20">
              <div className="relative h-full w-full rounded-full border border-[var(--sun-deep)]/25 bg-[var(--sun)] shadow-[inset_0_-6px_12px_rgba(0,0,0,0.12)]">
                <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full">
                  <path d="M5 40 C 20 20, 60 20, 75 40" stroke="white" strokeWidth="2.4" fill="none" opacity="0.95" />
                  <path d="M5 40 C 20 60, 60 60, 75 40" stroke="white" strokeWidth="2.4" fill="none" opacity="0.95" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="pb-6 text-center">
          <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--forest-mute)]">
            scroll
            <ChevronDown className="h-3.5 w-3.5 animate-bounce" strokeWidth={2.4} />
          </span>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          2. REGISTRATION PATHS
          ──────────────────────────────────────────────────────────── */}
      <RegistrationPaths />

      {/* ────────────────────────────────────────────────────────────
          4. STEPS — three steps · 15·30·40 tennis scoring
          ──────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <SectionHeading
              align="left"
              index="PASOS"
              eyebrow={t("steps.eyebrow")}
              title={t("steps.title")}
              description={t("steps.description")}
            />
            <div className="grid gap-5 sm:grid-cols-3">
              {STEP_KEYS.map((stepKey, i) => {
                const StepIcon = STEP_ICON[stepKey];
                return (
                <article key={stepKey} className="card-friendly relative flex h-full flex-col p-6">
                  <div className="flex items-center justify-between">
                    <span className="score text-[56px] text-[var(--coral)] sm:text-[64px]">
                      {STEP_SCORE[stepKey]}
                    </span>
                    {stepKey === "start" ? (
                      <BallMark className="h-9 w-9" />
                    ) : (
                      <span
                        aria-hidden
                        className="grid h-11 w-11 place-items-center rounded-full border border-[var(--rule)] bg-[var(--cream-soft)]"
                      >
                        <StepIcon className="h-5 w-5 text-[var(--coral-deep)]" strokeWidth={2.2} />
                      </span>
                    )}
                  </div>
                  <span className="mt-2 inline-flex w-fit rounded-full bg-[var(--coral-soft)] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--coral-deep)]">
                    {t("steps.stepLabel")} {i + 1}
                  </span>
                  <h3 className="mt-4 font-display text-[20px] font-bold leading-tight text-[var(--forest)]">
                    {t(`steps.items.${stepKey}.title`)}
                  </h3>
                  <p className="mt-2 text-[14.5px] leading-[1.65] text-[var(--forest-soft)]">
                    {t(`steps.items.${stepKey}.description`)}
                  </p>
                </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          5. METHOD — four pillars with emoji + tinted cards
          ──────────────────────────────────────────────────────────── */}
      <section className="relative section">
        <BallMark className="section-ornament float-slow right-[6%] top-12 h-11 w-11" />
        <div className="wrap">
          <SectionHeading
            index="MÉTODO"
            eyebrow={t("method.eyebrow")}
            title={t("method.title")}
            description={t("method.description")}
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REASON_KEYS.map((rk) => {
              const v = REASON_TOKENS[rk];
              const Icon = v.Icon;
              return (
                <article
                  key={rk}
                  className="lift flex flex-col gap-4 rounded-2xl border border-[var(--rule)] p-7 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]"
                  style={{ background: v.bg }}
                >
                  <span aria-hidden className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)]">
                    <Icon className="h-5 w-5" style={{ color: v.ink }} strokeWidth={2.2} />
                  </span>
                  <h3 className="font-display text-[20px] font-bold leading-[1.15] text-[var(--forest)]">
                    {t(`method.reasons.${rk}.title`)}
                  </h3>
                  <p className="text-[14.5px] leading-[1.65] text-[var(--forest-soft)]">
                    {t(`method.reasons.${rk}.description`)}
                  </p>
                  <span className="mt-auto inline-block h-1 w-12 rounded-full" style={{ background: v.bar }} />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          6. LEVELS — interactive finder + colour cards
          ──────────────────────────────────────────────────────────── */}
      <section id="niveles" className="section">
        <div className="wrap">
          <SectionHeading
            index="NIVELES"
            eyebrow={t("levels.eyebrow")}
            title={t("levels.title")}
            description={t("levels.description")}
          />

          <div className="mt-14">
            <LevelFinder />
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {LEVEL_KEYS.map((lk) => {
              const color = LEVEL_COLOR[lk];
              const name = t(`levels.items.${lk}.name`);
              return (
                <article
                  key={lk}
                  className="card-friendly relative flex flex-col gap-3 overflow-hidden p-6"
                >
                  {/* Coloured top stripe */}
                  <span aria-hidden className="absolute inset-x-0 top-0 h-2.5" style={{ background: color }} />
                  <div className="mt-4 flex items-center justify-between">
                    <span
                      aria-hidden
                      className="grid h-12 w-12 place-items-center rounded-full text-[20px] font-extrabold text-white shadow-[inset_0_-4px_10px_rgba(0,0,0,0.12)]"
                      style={{ background: color }}
                    >
                      {name[0]}
                    </span>
                  </div>
                  <h3 className="font-display text-[24px] font-bold leading-none" style={{ color }}>
                    {name}
                  </h3>
                  <p className="text-[12px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
                    {t(`levels.items.${lk}.ages`)}
                  </p>
                  <p className="mt-1 text-[14px] leading-[1.65] text-[var(--forest-soft)]">
                    {t(`levels.items.${lk}.text`)}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" className="btn btn-primary">
              {t("levels.ctaReserve")}
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </a>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          MARQUEE — friendly ribbon
          ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-y border-[var(--rule)] bg-[var(--grass)] py-4">
        <div className="marquee-track flex whitespace-nowrap" style={{ animation: "marquee 38s linear infinite" }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="mx-7 inline-flex items-center gap-7 font-display text-[24px] font-extrabold tracking-tight text-[var(--cream-soft)] sm:text-[30px]"
            >
              {t("marquee")}
              <BallMark className="h-6 w-6" />
            </span>
          ))}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          9. SAHARA — NGO heart of the project
          ──────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--rule)] shadow-[var(--shadow-md)]">
            <Image
              src={PANDA_IMAGES.saharaGrupo}
              alt="Sahara"
              width={1100}
              height={760}
              className="h-full max-h-[520px] w-full object-cover"
              sizes="(min-width: 1024px) 700px, 100vw"
            />
            <span className="absolute left-5 top-5 sticker bg-[var(--cream-soft)] text-[var(--forest)]">
              <Globe aria-hidden className="h-4 w-4" strokeWidth={2.2} />
              {t("sahara.badge")}
            </span>
          </div>
          <div className="relative flex flex-col justify-between rounded-3xl border border-[var(--rule)] bg-[var(--grass)] p-8 text-white shadow-[var(--shadow-md)] sm:p-10">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sun)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest)]">
                <Heart aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
                {t("hero.ngoPill")}
              </span>
              <h2 className="mt-5 headline text-[clamp(1.8rem,4vw,2.6rem)] text-white">
                {t("sahara.title")}
              </h2>
              <p className="mt-5 max-w-prose text-[15px] leading-[1.7] text-white/90">
                {t("sahara.description")}
              </p>
            </div>
            <Link
              href="/quienes-somos"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-[var(--sun)] px-5 py-3 text-[13.5px] font-extrabold text-[var(--forest)] border border-[var(--rule)] shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
            >
              {t("sahara.cta")}
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          10. VALUES — 4 friendly cards
          ──────────────────────────────────────────────────────────── */}
      <section className="relative section">
        <BallMark className="section-ornament float-mid left-[5%] top-16 h-9 w-9 opacity-70" />
        <div className="wrap">
          <SectionHeading
            index="VALORES"
            eyebrow={t("values.eyebrow")}
            title={t("values.title")}
            description={t("values.description")}
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_KEYS.map((vk) => {
              const v = VALUE_TINT[vk];
              const Icon = VALUE_ICON[vk];
              return (
                <article
                  key={vk}
                  className="lift relative flex flex-col gap-4 rounded-3xl border border-[var(--rule)] p-7 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]"
                  style={{ background: v.bg }}
                >
                  <span
                    aria-hidden
                    className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--cream-soft)] border border-[var(--rule)]"
                  >
                    <Icon className="h-5 w-5" style={{ color: v.ink }} strokeWidth={2.2} />
                  </span>
                  <h3 className="font-display text-[20px] font-bold leading-[1.15] text-[var(--forest)]">
                    {t(`values.items.${vk}.title`)}
                  </h3>
                  <p className="text-[14px] leading-[1.6] text-[var(--forest-soft)]">
                    {t(`values.items.${vk}.text`)}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          11. GALLERY — bento with hover labels
          ──────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <SectionHeading
            index="GALERÍA"
            eyebrow={t("gallery.eyebrow")}
            title={t("gallery.title")}
            description={t("gallery.description")}
          />
          <div className="mt-14 grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:gap-4 lg:auto-rows-[200px] lg:grid-cols-12">
            {GALLERY.map((item) => {
              const tag = t(`gallery.tags.${item.tagKey}`);
              return (
                <figure
                  key={item.src}
                  className={
                    "group relative col-span-1 row-span-1 overflow-hidden rounded-2xl border border-[var(--rule)] shadow-[var(--shadow-card)] " +
                    item.span
                  }
                >
                  <Image
                    src={item.src}
                    alt={tag}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                    sizes="(min-width: 1024px) 40vw, 50vw"
                  />
                  <figcaption className="absolute left-3 bottom-3 rounded-full bg-[var(--cream-soft)] border border-[var(--rule)] px-3 py-1 text-[11.5px] font-extrabold text-[var(--forest)]">
                    {tag}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          12. FAQ — friendly numbered Q&A
          ──────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="mx-auto max-w-[920px]">
          <SectionHeading
            index="DUDAS"
            eyebrow={t("faq.eyebrow")}
            title={t("faq.title")}
          />
          <ul className="mt-12 grid gap-3">
            {faqs.map((faq, i) => (
              <li key={faq.question}>
                <details className="group/q rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] shadow-[var(--shadow-card)] open:bg-[var(--sun-soft)] open:shadow-[var(--shadow-card)] transition-shadow">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--rule)] bg-[var(--sun)] text-[12.5px] font-extrabold text-[var(--forest)] transition-transform group-open/q:rotate-12"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 font-display text-[15.5px] font-bold leading-snug text-[var(--forest)] sm:text-[18px]">
                      {faq.question}
                    </span>
                    <span
                      aria-hidden
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--rule)] bg-[var(--cream-soft)] transition-transform duration-300 group-open/q:rotate-180 group-open/q:bg-[var(--coral)]"
                    >
                      <ChevronDown
                        className="h-4 w-4 text-[var(--forest)] group-open/q:text-white"
                        strokeWidth={2.4}
                      />
                    </span>
                  </summary>
                  <p className="px-4 pb-5 pl-[60px] text-[14.5px] leading-[1.7] text-[var(--forest-soft)] sm:px-6 sm:pl-[76px]">
                    {faq.answer}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          13. CTA — friendly poster
          ──────────────────────────────────────────────────────────── */}
      <section className="pb-20 sm:pb-24 lg:pb-28">
        <div className="wrap">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--coral)] px-7 py-16 text-white shadow-[var(--shadow-md)] sm:px-14 sm:py-20">
          {/* Polka background */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--cream-soft) 1.5px, transparent 1.5px)",
              backgroundSize: "32px 32px",
            }}
          />
          {/* Floating ball — single quiet accent */}
          <BallMark className="float-slow absolute right-6 top-8 h-12 w-12 opacity-80 sm:right-14 sm:h-16 sm:w-16" />
          <BallMark className="float-mid absolute bottom-6 left-6 hidden h-10 w-10 opacity-60 sm:left-14 sm:block sm:h-12 sm:w-12" />

          <div className="relative z-10 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--sun)] border border-[var(--rule)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest)]">
              {t("cta.kicker")}
            </span>
            <h2 className="mx-auto mt-5 max-w-[18ch] headline text-[clamp(2.2rem,6vw,4rem)] text-white">
              {t("cta.title")}
            </h2>
            <p className="mx-auto mt-5 max-w-[52ch] text-[15.5px] leading-[1.7] text-white/90 sm:text-[17px]">
              {t("cta.description")}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href={CONTACT.whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--sun)] px-6 text-[13.5px] font-extrabold text-[var(--forest)] shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                {t("hero.ctaClasses")}
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </a>
              <Link
                href="/campamentos"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--cream-soft)] px-6 text-[13.5px] font-extrabold text-[var(--forest)] shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                {t("hero.ctaCamps")}
              </Link>
              <a
                href={CONTACT.whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--grass)] px-6 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                <WhatsAppIcon className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
        </div>
      </section>

      <ContactBand />
      <FloatingCallout />
    </>
  );
}
