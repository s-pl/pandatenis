import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  Brain,
  Brush,
  CalendarDays,
  Castle,
  Droplets,
  Dumbbell,
  Flower2,
  Languages,
  Medal,
  Snowflake,
  Sun,
  TreePine,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CONTACT, PANDA_IMAGES } from "@/components/web/content";
import { ContactBand } from "@/components/web/contact-band";
import { PageHero } from "@/components/web/page-hero";
import { SectionHeading } from "@/components/web/section-heading";
import { getPublishedCourses } from "@/lib/web/campus-data";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.camps" });
  return { title: t("title"), description: t("description") };
}

const ACTIVITY_KEYS = [
  "tennis",
  "tournament",
  "castle",
  "multisport",
  "crafts",
  "memory",
  "languages",
  "water",
] as const;
// Actividades destacadas: torneo de los viernes con medallas/premios y el
// castillo hinchable (acuático en verano). Se resaltan visualmente.
const FEATURED_ACTIVITIES = new Set<(typeof ACTIVITY_KEYS)[number]>(["tournament", "castle"]);
const ACTIVITY_TOKENS: Record<
  (typeof ACTIVITY_KEYS)[number],
  { Icon: LucideIcon; bg: string; ink: string; bar: string }
> = {
  tennis:     { Icon: Trophy,    bg: "var(--grass-soft)", ink: "var(--grass-deep)", bar: "var(--grass)" },
  tournament: { Icon: Medal,     bg: "var(--sun-soft)",   ink: "var(--sun-deep)",   bar: "var(--sun)" },
  castle:     { Icon: Castle,    bg: "var(--coral-soft)", ink: "var(--coral-deep)", bar: "var(--coral)" },
  multisport: { Icon: Dumbbell,  bg: "var(--coral-soft)", ink: "var(--coral-deep)", bar: "var(--coral)" },
  crafts:     { Icon: Brush,     bg: "var(--sun-soft)",   ink: "var(--sun-deep)",   bar: "var(--sun)" },
  memory:     { Icon: Brain,     bg: "var(--lilac-soft)", ink: "var(--lilac-deep)", bar: "var(--lilac)" },
  languages:  { Icon: Languages, bg: "var(--sky-soft)",   ink: "var(--sky-deep)",   bar: "var(--sky)" },
  water:      { Icon: Droplets,  bg: "var(--sky-soft)",   ink: "var(--sky-deep)",   bar: "var(--sky)" },
};

// Estado calculado de cada convocatoria → estilo del badge en la web.
const STATUS_TOKENS: Record<"upcoming" | "active" | "finished", { bg: string; ink: string }> = {
  upcoming: { bg: "var(--sun-soft)",   ink: "var(--sun-deep)" },
  active:   { bg: "var(--grass-soft)", ink: "var(--grass-deep)" },
  finished: { bg: "var(--cream-deep)", ink: "var(--forest-mute)" },
};

/** Icono representativo según el nombre de la convocatoria (con fallback). */
function seasonIconFor(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (/(verano|summer)/.test(l)) return Sun;
  if (/(navidad|christmas)/.test(l)) return TreePine;
  if (/(semana santa|pascua|easter)/.test(l)) return Flower2;
  if (/(semana blanca|blanca|nieve|snow|white week)/.test(l)) return Snowflake;
  return CalendarDays;
}

export default async function CampsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("camps");

  const allCourses = await getPublishedCourses();
  const campusCourses = allCourses.filter((c) => c.kind === "campus");

  return (
    <>
      <PageHero
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        description={t("hero.description")}
        imageSrc={PANDA_IMAGES.laDiversiva}
        imageAlt="Panda Tenis"
        actions={
          <>
            <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" className="btn btn-coral">
              {t("hero.ctaSignUp")}
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </a>
            <a href="#programa" className="btn btn-ghost">
              {t("hero.ctaActivities")}
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </a>
          </>
        }
      />

      {/* ── Programa ── */}
      <section id="programa" className="section">
        <div className="wrap">
          <SectionHeading
            index="PROGRAMA"
            eyebrow={t("program.eyebrow")}
            title={t("program.title")}
            description={t("program.description")}
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIVITY_KEYS.map((ak) => {
              const v = ACTIVITY_TOKENS[ak];
              const Icon = v.Icon;
              const featured = FEATURED_ACTIVITIES.has(ak);
              return (
                <article
                  key={ak}
                  className={`lift relative flex flex-col gap-4 rounded-2xl p-7 shadow-[var(--shadow-card)] ${
                    featured
                      ? "border-2 border-[var(--sun)] ring-2 ring-[var(--sun-soft)]"
                      : "border border-[var(--rule)]"
                  }`}
                  style={{ background: v.bg }}
                >
                  {featured && (
                    <span className="absolute right-4 top-4 inline-flex items-center rounded-full bg-[var(--sun)] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--forest)]">
                      {t("program.featured")}
                    </span>
                  )}
                  <span aria-hidden className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--rule)] bg-[var(--cream-soft)]">
                    <Icon className="h-5 w-5" style={{ color: v.ink }} strokeWidth={2} />
                  </span>
                  <h2 className="font-display text-[20px] font-bold leading-tight text-[var(--forest)]">
                    {t(`program.activities.${ak}.title`)}
                  </h2>
                  <p className="text-[14.5px] leading-[1.65] text-[var(--forest-soft)]">
                    {t(`program.activities.${ak}.text`)}
                  </p>
                  <span className="mt-auto inline-block h-1 w-12 rounded-full" style={{ background: v.bar }} />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Temporadas ── */}
      <section className="section">
        <div className="wrap grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <SectionHeading
              align="left"
              index="TEMPORADAS"
              eyebrow={t("seasons.eyebrow")}
              title={t("seasons.title")}
              description={t("seasons.description")}
            />
            {campusCourses.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] p-6 text-center shadow-[var(--shadow-card)]">
                <span className="inline-flex rounded-full bg-[var(--cream-deep)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
                  {t("seasons.comingSoon")}
                </span>
              </div>
            ) : (
              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {campusCourses.map((course) => {
                  const SeasonIcon = seasonIconFor(course.label);
                  const status = course.status ?? null;
                  const isFinished = status === "finished";
                  return (
                    <article
                      key={course.slug}
                      className="lift flex flex-col gap-3 rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] p-6 shadow-[var(--shadow-card)]"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          aria-hidden
                          className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--rule)] bg-[var(--sun-soft)]"
                        >
                          <SeasonIcon className="h-5 w-5 text-[var(--sun-deep)]" strokeWidth={2} />
                        </span>
                        {status && (
                          <span
                            className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider"
                            style={{ background: STATUS_TOKENS[status].bg, color: STATUS_TOKENS[status].ink }}
                          >
                            {t(`status.${status}`)}
                          </span>
                        )}
                      </div>
                      <p className="font-display text-[20px] font-bold leading-tight text-[var(--forest)]">
                        {course.label}
                      </p>
                      {course.dates && (
                        <p className="text-[12.5px] font-bold text-[var(--forest-mute)]">{course.dates}</p>
                      )}
                      {!isFinished && (
                        <a
                          href={CONTACT.whatsappHref}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-full border border-[var(--rule)] bg-[var(--coral)] px-4 text-[12px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
                        >
                          {t("seasons.register")}
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--grass-soft)] shadow-[var(--shadow-md)]">
            <Image
              src={PANDA_IMAGES.grupo}
              alt="Panda Tenis"
              width={1020}
              height={765}
              className="h-full max-h-[560px] w-full object-cover"
              sizes="(min-width: 1024px) 42vw, 100vw"
            />
          </div>
        </div>
      </section>

      {/* ── Trofeos ── */}
      <section className="section">
        <div className="wrap grid gap-5 lg:grid-cols-3">
          <article className="lift rounded-3xl border border-[var(--rule)] bg-[var(--cream-soft)] p-8 shadow-[var(--shadow-card)] lg:col-span-2">
            <span className="sticker text-[var(--coral-deep)]">
              <Trophy aria-hidden className="h-4 w-4" strokeWidth={2} />
              {t("trophies.kicker")}
            </span>
            <h2 className="mt-5 headline text-[clamp(1.8rem,4vw,2.6rem)] text-[var(--forest)]">
              {t("trophies.title")}
            </h2>
            <p className="mt-5 max-w-2xl text-[15.5px] leading-[1.7] text-[var(--forest-soft)]">
              {t("trophies.description")}
            </p>
          </article>
          <article className="relative overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--coral)] p-8 text-white shadow-[var(--shadow-card)]">
            <span className="inline-flex rounded-full bg-[var(--sun)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest)]">
              {t("trophies.ageLabel")}
            </span>
            <p className="mt-5 score text-[80px] text-white">{t("trophies.ageRange")}</p>
            <p className="mt-5 text-[14px] leading-[1.6] text-white/90">
              {t("trophies.ageNote")}
            </p>
          </article>
        </div>
      </section>

      <ContactBand />
    </>
  );
}
