import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, Check, GraduationCap, Sun } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPublishedCourses } from "@/lib/web/campus-data";
import { CONTACT } from "@/components/web/content";

/**
 * Two friendly paths — clases regulares (green) y campus (coral).
 * Same two-card structure as before, dressed in the sunny system.
 */
export async function RegistrationPaths() {
  const t = await getTranslations("registrationPaths");
  const all = await getPublishedCourses();
  const activeCampuses = all.filter((c) => c.kind === "campus");
  const schoolCourse = all.find((c) => c.kind === "escuela");
  const nextCampus = activeCampuses[0] ?? null;
  const count = activeCampuses.length;

  const schoolBullets = t.raw("school.bullets") as string[];
  const campsBullets = t.raw("camps.bullets") as string[];

  return (
    <section className="section">
      <div className="wrap">
        <div className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="tag">{t("kicker")}</span>
            <h2 className="mt-4 headline text-[clamp(2rem,5vw,3.4rem)] text-[var(--forest)]">
              {t("title")}
            </h2>
          </div>
          <p className="max-w-[44ch] text-[14.5px] leading-[1.65] text-[var(--forest-soft)] sm:text-right">
            {t("description")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ─── SCHOOL (grass) ─── */}
          <article className="card-friendly relative flex flex-col p-7 sm:p-10" style={{ background: "var(--grass-soft)" }}>
            <header className="flex items-start justify-between gap-3">
              <span
                aria-hidden
                className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--grass)] border border-[var(--rule)] text-white shadow-[inset_0_-4px_10px_rgba(0,0,0,0.14)]"
              >
                <GraduationCap className="h-7 w-7" strokeWidth={2.2} />
              </span>
              <span className="sticker text-[var(--grass-deep)]">
                {t("school.badge")}
              </span>
            </header>
            <h3 className="mt-6 headline text-[clamp(1.8rem,4.2vw,2.5rem)] text-[var(--forest)]">
              {t("school.title")}
            </h3>
            <p className="mt-2 font-script text-[24px] text-[var(--grass-deep)]">
              {schoolCourse?.label ?? t("school.fallbackLabel")}
            </p>

            <ul className="mt-7 grid gap-2.5">
              {schoolBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--grass)] text-white"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span
                    className="text-[14.5px] leading-[1.6] text-[var(--forest)]"
                    dangerouslySetInnerHTML={{ __html: bullet }}
                  />
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" className="btn btn-primary">
                {t("school.cta")}
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </a>
              <a
                href="#niveles"
                className="inline-flex items-center gap-1 rounded-full bg-[var(--cream-soft)] border border-[var(--rule)] px-4 py-2 text-[13px] font-bold text-[var(--forest)] hover:bg-[var(--sun-soft)]"
              >
                {t("school.secondary")}
              </a>
            </div>
          </article>

          {/* ─── CAMPS (sun/coral) ─── */}
          <article className="card-friendly relative flex flex-col p-7 sm:p-10" style={{ background: "var(--sun-soft)" }}>
            <header className="flex items-start justify-between gap-3">
              <span
                aria-hidden
                className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--coral)] border border-[var(--rule)] text-white shadow-[inset_0_-4px_10px_rgba(0,0,0,0.14)]"
              >
                <Sun className="h-7 w-7" strokeWidth={2.2} />
              </span>
              <span className="sticker text-[var(--coral-deep)]">
                {count === 1 ? t("camps.badgeOne", { count }) : t("camps.badgeMany", { count })}
              </span>
            </header>
            <h3 className="mt-6 headline text-[clamp(1.8rem,4.2vw,2.5rem)] text-[var(--forest)]">
              {t("camps.title")}
            </h3>
            <p className="mt-2 font-script text-[22px] text-[var(--coral-deep)]">
              {t("camps.seasons")}
            </p>

            <ul className="mt-7 grid gap-2.5">
              {campsBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--coral)] text-white"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-[14.5px] leading-[1.6] text-[var(--forest)]">{bullet}</span>
                </li>
              ))}
            </ul>

            {nextCampus && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] px-4 py-3">
                <CalendarDays className="h-5 w-5 shrink-0 text-[var(--coral)]" strokeWidth={2.2} />
                <span className="text-[13px] text-[var(--forest)]">
                  <span className="font-extrabold uppercase tracking-wider text-[var(--coral-deep)]">
                    {t("camps.nextLabel")}
                  </span>{" "}
                  <span className="font-extrabold">{nextCampus.label}</span> · {nextCampus.dates}
                </span>
              </div>
            )}

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" className="btn btn-coral">
                {count === 1 ? t("camps.ctaSingle") : t("camps.ctaMany")}
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </a>
              <Link
                href="/campamentos"
                className="inline-flex items-center gap-1 rounded-full bg-[var(--cream-soft)] border border-[var(--rule)] px-4 py-2 text-[13px] font-bold text-[var(--forest)] hover:bg-[var(--coral-soft)]"
              >
                {t("camps.secondary")}
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
