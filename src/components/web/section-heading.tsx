import type { ReactNode } from "react";
import { Reveal } from "@/components/web/reveal";

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  /** Optional small tag pill — replaces the cold "01" of the editorial version. */
  index?: string;
};

/**
 * Friendly section heading.
 *
 * ─── 🎾 KICKER · GRASS — ALL CAPS ────────────────────────────
 *  Title in big rounded Sora display
 *  Description in warm Nunito body
 *
 * The `index` value, if passed, becomes a small green pill rather
 * than a cold magazine chapter number.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  index,
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <Reveal className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {(eyebrow || index) && (
        <div className={"mb-5 flex items-center gap-3 " + (centered ? "justify-center" : "")}>
          {index && (
            <span className="inline-flex h-6 items-center rounded-full bg-[var(--grass)] px-2.5 text-[11px] font-extrabold tracking-wider text-white">
              {index}
            </span>
          )}
          {eyebrow && (
            <span className="tag">{eyebrow}</span>
          )}
        </div>
      )}
      <h2
        className={
          "headline text-[clamp(2rem,5.6vw,3.6rem)] text-[var(--forest)] " +
          (centered ? "mx-auto" : "")
        }
      >
        {title}
      </h2>
      {description && (
        <p
          className={
            "mt-5 text-[15.5px] leading-[1.7] text-[var(--forest-soft)] sm:text-[17px] sm:leading-[1.65] " +
            (centered ? "mx-auto max-w-2xl" : "")
          }
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}
