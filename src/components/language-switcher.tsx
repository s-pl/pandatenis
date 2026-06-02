"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";
import { routing, type Locale } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LocaleFlag } from "@/components/flags";
import { cn } from "@/lib/utils";

type Variant = "navbar" | "iconOnly" | "menu";

/**
 * Exported wrapper: keeps the inner component (which reads useSearchParams)
 * inside a Suspense boundary so it doesn't force the parent route into
 * client-side rendering. Anything outside the Suspense — including the
 * Suspense fallback — can still be statically prerendered.
 */
export function LanguageSwitcher(props: { variant?: Variant; className?: string }) {
  return (
    <Suspense fallback={null}>
      <LanguageSwitcherInner {...props} />
    </Suspense>
  );
}

/**
 * Switches the active locale while preserving the current pathname,
 * dynamic params, and search query.
 *
 *  - "navbar": short pill (ES | EN) for the public navbar.
 *  - "iconOnly": discreet globe button used in the admin topbar.
 *  - "menu": vertical list for mobile menus.
 */
function LanguageSwitcherInner({
  variant = "navbar",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("common");

  function switchTo(next: Locale) {
    if (next === locale || pending) return;
    const query = search.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      // Cast to `never` because router pathname is statically inferred from
      // the route tree; we know it's a string at runtime.
      router.replace(href as never, { locale: next });
    });
  }

  if (variant === "iconOnly") {
    const next: Locale = locale === "es" ? "en" : "es";
    return (
      <button
        type="button"
        onClick={() => switchTo(next)}
        disabled={pending}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-md transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50",
          className,
        )}
        aria-label={t("language")}
        title={t("language")}
      >
        <LocaleFlag locale={locale} className="h-5 w-5" />
      </button>
    );
  }

  if (variant === "menu") {
    return (
      <div className={cn("grid gap-2", className)}>
        {routing.locales.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => switchTo(l)}
            disabled={pending}
            className={cn(
              "flex items-center justify-between rounded-2xl border-2 border-[var(--forest)] px-4 py-3 text-[14px] font-extrabold transition-transform active:translate-y-[2px]",
              l === locale
                ? "bg-[var(--sun)] text-[var(--forest)] shadow-[0_4px_0_var(--forest)]"
                : "bg-[var(--cream-soft)] text-[var(--forest)] shadow-[0_4px_0_var(--forest)]",
            )}
          >
            <span className="flex items-center gap-2.5">
              <LocaleFlag locale={l} className="h-6 w-6" />
              {l === "es" ? t("spanish") : t("english")}
            </span>
            <span className="text-[11px] uppercase tracking-widest text-[var(--forest-mute)]">{l}</span>
          </button>
        ))}
      </div>
    );
  }

  // navbar — friendly segmented pill con banderas
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center gap-1 rounded-full border-2 border-[var(--forest)] bg-[var(--cream-soft)] p-[3px]",
        className,
      )}
      role="group"
      aria-label={t("language")}
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          disabled={pending}
          className={cn(
            "inline-grid h-7 w-7 place-items-center rounded-full transition-all",
            l === locale
              ? "ring-2 ring-[var(--forest)] ring-offset-1 ring-offset-[var(--cream-soft)]"
              : "opacity-50 hover:opacity-100",
          )}
          aria-pressed={l === locale}
        >
          <LocaleFlag locale={l} className="h-[22px] w-[22px]" />
          <span className="sr-only">{l === "es" ? t("spanish") : t("english")}</span>
        </button>
      ))}
    </div>
  );
}
