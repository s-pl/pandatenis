import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { WebNavbar } from "@/components/web/navbar";
import { WebFooter } from "@/components/web/footer";
import { WebMotionLayer } from "@/components/web/site-motion";
import HomeContent, { generateHomeMetadata } from "@/components/web/home-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateHomeMetadata(locale);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <WebNavbar />
      <WebMotionLayer />
      <main>
        <HomeContent />
      </main>
      <WebFooter />
    </>
  );
}
