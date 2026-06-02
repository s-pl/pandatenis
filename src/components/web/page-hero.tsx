import type { ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { BallMark } from "@/components/web/brand-marks";

type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  imageSrc: string;
  imageAlt: string;
  actions?: ReactNode;
};

/**
 * Friendly cover for inner pages — copy left, polaroid photo right.
 * Sunny haloes, soft polka backdrop, rounded forms.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt,
  actions,
}: PageHeroProps) {
  const t = useTranslations("home.hero");
  return (
    <section data-gsap-hero className="relative overflow-hidden pt-28 sm:pt-36 lg:pt-44">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(242,179,60,0.14),transparent_55%),radial-gradient(ellipse_at_85%_85%,rgba(126,196,232,0.12),transparent_60%)]" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="polka-page" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="var(--forest)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#polka-page)" />
        </svg>
      </div>

      <div className="wrap grid w-full gap-12 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-20">
        <div data-gsap-copy className="relative">
          <span className="sticker text-[var(--grass-deep)]">
            <BallMark className="h-4 w-4" />
            {eyebrow}
          </span>
          <h1 className="mt-6 headline text-[clamp(2.4rem,7vw,5rem)] text-[var(--forest)]">
            {title}
          </h1>
          <p className="mt-6 max-w-[42ch] text-[16px] leading-[1.65] text-[var(--forest-soft)] sm:text-[18px]">
            {description}
          </p>
          {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>

        <div data-gsap-bg className="relative h-[320px] sm:h-[420px] lg:h-auto lg:min-h-[480px]">
          <div className="absolute inset-0 overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--cream-soft)] shadow-[var(--shadow-lg)]">
            <div className="absolute inset-2 overflow-hidden rounded-2xl">
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                priority
                className="object-cover"
                sizes="(min-width: 1024px) 540px, 100vw"
              />
            </div>
            <span
              aria-hidden
              className="absolute right-4 top-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--sun)] border border-[var(--rule)] px-3 text-[11px] font-extrabold text-[var(--forest)]"
            >
              {t("course")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
