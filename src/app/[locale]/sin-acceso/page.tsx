import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.noAccess" });
  return { title: t("title") };
}

export default async function SinAccesoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("noAccess");

  return (
    <main className="relative grid min-h-screen place-items-center px-6">
      {/* Decorative haloes */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--forest) 1.4px, transparent 1.4px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative w-full max-w-md text-center">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl border-2 border-[var(--forest)] bg-[var(--coral-soft)] shadow-[0_5px_0_var(--forest)]">
          <ShieldOff className="h-9 w-9 text-[var(--coral-deep)]" strokeWidth={2.2} />
        </div>
        <h1 className="headline text-[clamp(2rem,6vw,3rem)] text-[var(--forest)]">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-prose text-[15px] leading-[1.7] text-[var(--forest-soft)]">
          {t("description")}
        </p>
        <Link href="/login" className="mt-8 inline-block">
          <Button variant="secondary" size="lg">
            {t("backHome")}
          </Button>
        </Link>
      </div>
    </main>
  );
}
