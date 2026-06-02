import { cn } from "@/lib/utils";

/**
 * Banderas SVG inline para el selector de idioma.
 *
 * Se usan SVG (no emoji 🇪🇸/🇬🇧) porque los emoji de bandera no renderizan en
 * Windows desktop. Cada bandera rellena su contenedor con `slice` para poder
 * recortarse en un círculo (`rounded-full overflow-hidden`).
 */

type FlagProps = { className?: string };

/** Bandera de España (franjas roja · amarilla · roja, ratio 1:2:1). */
export function FlagES({ className }: FlagProps) {
  return (
    <svg
      viewBox="0 0 640 480"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", className)}
      aria-hidden
      focusable="false"
    >
      <rect width="640" height="480" fill="#AA151B" />
      <rect width="640" height="240" y="120" fill="#F1BF00" />
    </svg>
  );
}

/** Bandera del Reino Unido (Union Jack, versión compacta). */
export function FlagGB({ className }: FlagProps) {
  return (
    <svg
      viewBox="0 0 60 30"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", className)}
      aria-hidden
      focusable="false"
    >
      <clipPath id="flag-gb-clip">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        clipPath="url(#flag-gb-clip)"
        stroke="#C8102E"
        strokeWidth="4"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

/** Devuelve la bandera correspondiente al locale, recortada en círculo. */
export function LocaleFlag({
  locale,
  className,
}: {
  locale: string;
  className?: string;
}) {
  const Flag = locale === "en" ? FlagGB : FlagES;
  return (
    <span
      className={cn(
        "inline-block overflow-hidden rounded-full border border-[var(--rule)] bg-[var(--cream-soft)]",
        className,
      )}
      aria-hidden
    >
      <Flag />
    </span>
  );
}
