import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CONTACT } from "@/components/web/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.privacy" });
  return { title: t("title"), description: t("description") };
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");
  const sections = t.raw("sections") as Array<{ title: string; text: string }>;

  return (
    <section className="pt-32 pb-20 sm:pt-40 sm:pb-24">
      <div className="wrap max-w-[920px]">
        <span className="sticker text-[var(--coral-deep)]">
          <FileText aria-hidden className="h-4 w-4" strokeWidth={2} />
          {t("kicker")}
        </span>
        <h1 className="mt-5 headline text-[clamp(2.2rem,6vw,3.6rem)] text-[var(--forest)]">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-prose text-[15.5px] leading-[1.7] text-[var(--forest-soft)]">
          {t("updated")}
        </p>

        <ol className="mt-12 grid gap-4">
          {sections.map((section, i) => (
            <li key={section.title}>
              <article className="rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] p-6 shadow-[var(--shadow-card)] sm:p-7">
                <div className="flex items-baseline gap-4">
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--sun)] border border-[var(--rule)] text-[12px] font-extrabold text-[var(--forest)]"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="flex-1 font-display text-[19px] font-bold leading-tight text-[var(--forest)] sm:text-[21px]">
                    {section.title}
                  </h2>
                </div>
                <p className="mt-3 pl-12 text-[14.5px] leading-[1.7] text-[var(--forest-soft)]">
                  {section.text}
                </p>
              </article>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border border-[var(--rule)] bg-[var(--grass-soft)] p-7 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-[20px] font-bold text-[var(--forest)]">
            {t("contactTitle")}
          </h2>
          <p className="mt-4 text-[14.5px] leading-[1.7] text-[var(--forest-soft)]">
            <span className="font-extrabold uppercase tracking-wider text-[var(--grass-deep)]">
              {t("emailLabel")}
            </span>{" "}
            <a className="font-bold text-[var(--coral)] underline decoration-[var(--sun)] decoration-2 underline-offset-[4px] hover:text-[var(--coral-deep)]" href={CONTACT.emailHref}>
              {CONTACT.email}
            </a>
            {" · "}
            <span className="font-extrabold uppercase tracking-wider text-[var(--grass-deep)]">
              {t("phoneLabel")}
            </span>{" "}
            <a className="font-bold text-[var(--coral)] underline decoration-[var(--sun)] decoration-2 underline-offset-[4px] hover:text-[var(--coral-deep)]" href={CONTACT.phoneHref}>
              {CONTACT.phoneDisplay}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
