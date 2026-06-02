import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localeDetection: true,
  // Always prefix the URL with the locale (e.g. /es/admin, /en/inscripcion).
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
