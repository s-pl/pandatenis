import type { Metadata, Viewport } from "next";
import { Sora, Nunito, Caveat } from "next/font/google";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { themeNoFlashScript } from "@/components/theme-provider";
import "../globals.css";

/* ============================================================
   Sunny type stack — three voices.
   • Sora ............ display (variable, friendly, distinctive)
   • Nunito .......... body  (rounded, warm, family-friendly)
   • Caveat .......... hand-drawn accents
   ============================================================ */

const fontDisplay = Sora({
  subsets: ["latin"],
  variable: "--font-display-loaded",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const fontUI = Nunito({
  subsets: ["latin"],
  variable: "--font-ui-loaded",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const fontScript = Caveat({
  subsets: ["latin"],
  variable: "--font-script-loaded",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "metadata.root" });
  return {
    title: {
      default: t("titleDefault"),
      template: t("titleTemplate"),
    },
    description: t("description"),
    applicationName: "Panda Tenis",
  };
}

export const viewport: Viewport = {
  themeColor: "#25924F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${fontDisplay.variable} ${fontUI.variable} ${fontScript.variable} h-full antialiased`}
      style={{
        // Wire next/font CSS vars into the canonical names in globals.css.
        ["--font-display" as string]: `var(--font-display-loaded), ui-sans-serif, system-ui, sans-serif`,
        ["--font-ui" as string]: `var(--font-ui-loaded), ui-sans-serif, system-ui, sans-serif`,
        ["--font-mono" as string]: `var(--font-ui-loaded), ui-monospace, monospace`,
        ["--font-script" as string]: `var(--font-script-loaded), "Bradley Hand", cursive`,
      }}
    >
      <body className="min-h-full text-foreground">
        <script
          dangerouslySetInnerHTML={{ __html: themeNoFlashScript }}
          suppressHydrationWarning
        />
        <NextIntlClientProvider>
          {children}
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            expand={false}
            gap={10}
            offset={{ bottom: 24, right: 24 }}
            mobileOffset={{ bottom: 96, left: 16, right: 16 }}
            toastOptions={{
              classNames: {
                toast:
                  "!rounded-2xl !border !border-[var(--rule)] !bg-[var(--cream-soft)] !text-[var(--forest)] !shadow-[0_10px_30px_-12px_rgba(14,42,31,0.25)]",
                title: "!font-bold !text-[14px] !leading-snug",
                description: "!text-[var(--forest-mute)] !text-[12.5px] !leading-snug",
                actionButton:
                  "!bg-[var(--grass)] !text-white !rounded-full !px-3 !py-1 !text-[12px] !font-bold",
                cancelButton:
                  "!bg-[var(--cream-deep)] !text-[var(--forest-mute)] !rounded-full !px-3 !py-1 !text-[12px] !font-bold",
                closeButton:
                  "!bg-[var(--cream-soft)] !border !border-[var(--rule)] !text-[var(--forest)] hover:!bg-[var(--sun-soft)]",
              },
              duration: 4500,
            }}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
