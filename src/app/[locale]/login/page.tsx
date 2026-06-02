import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.login" });
  return { title: t("title") };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("login");

  return (
    <main className="relative grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Aside — grass green stage with sunny decorations */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[var(--grass)] p-12 text-white lg:flex">
        {/* Soft polka background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, var(--cream-soft) 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Floating decorations */}
        <span aria-hidden className="float-slow absolute right-10 top-20 text-[60px]">🎾</span>
        <span aria-hidden className="float-mid absolute left-8 bottom-32 text-[44px]">🐼</span>

        <div className="relative">
          <div className="inline-flex items-center gap-3 rounded-full border-2 border-[var(--cream-soft)] bg-white/15 px-4 py-2 text-[13px] font-extrabold backdrop-blur-sm">
            <span className="relative h-7 w-7 overflow-hidden rounded-full border-2 border-[var(--cream-soft)] bg-[var(--sun)]">
              <Image src="/panda/logo.png" alt="" fill sizes="28px" className="object-contain" />
            </span>
            {t("asideTag")}
          </div>
          <h1 className="mt-12 headline text-[clamp(2.6rem,5vw,3.6rem)] text-white">
            {t("asideTitleLine1")}
            <br />
            <span className="text-[var(--sun)]">{t("asideTitleLine2")}</span>
          </h1>
          <p className="mt-6 max-w-md text-[15.5px] leading-[1.7] text-white/85">
            {t("asideDescription")}
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-3">
          {[
            { value: "+120", label: t("stats.students"), bg: "var(--sun)", ink: "var(--forest)" },
            { value: "98%", label: t("stats.attendance"), bg: "var(--coral)", ink: "white" },
            { value: "0", label: t("stats.receipts"), bg: "var(--sky)", ink: "var(--forest)" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border-2 border-[var(--cream-soft)] p-4 shadow-[0_4px_0_var(--cream-soft)]"
              style={{ background: stat.bg }}
            >
              <p className="score text-[28px]" style={{ color: stat.ink }}>{stat.value}</p>
              <p className="mt-1.5 text-[10.5px] font-extrabold uppercase leading-tight tracking-wider" style={{ color: stat.ink, opacity: 0.85 }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center bg-[var(--cream)] p-6 lg:p-12">
        <Suspense fallback={null}>
          <LoginForm supabaseReady={isSupabaseConfigured()} />
        </Suspense>
      </section>
    </main>
  );
}
