import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

type PromoRow = {
  title_es: string;
  title_en: string;
  poster_url: string | null;
  whatsapp_msg_es: string | null;
  whatsapp_msg_en: string | null;
  active: boolean;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("promotions")
    .select("title_es, title_en")
    .eq("slug", slug)
    .maybeSingle();
  const title = data ? (locale === "en" ? data.title_en : data.title_es) : "Panda Tenis";
  return { title, robots: { index: false, follow: false } };
}

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export default async function PromotionPosterPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale: "es" | "en" = rawLocale === "en" ? "en" : "es";

  const supabase = createServiceRoleClient();
  const [{ data: promo }, { data: settings }] = await Promise.all([
    supabase
      .from("promotions")
      .select("title_es, title_en, poster_url, whatsapp_msg_es, whatsapp_msg_en, active")
      .eq("slug", slug)
      .maybeSingle<PromoRow>(),
    supabase
      .from("school_settings")
      .select("whatsapp_booking_number, whatsapp_booking_msg_es, whatsapp_booking_msg_en")
      .maybeSingle(),
  ]);

  if (!promo || !promo.active) notFound();

  const title = locale === "en" ? promo.title_en : promo.title_es;
  const buttonLabel = locale === "en" ? "Book now" : "Reserva tu plaza";

  const waNumber = digitsOnly(settings?.whatsapp_booking_number);
  const prefill =
    (locale === "en" ? promo.whatsapp_msg_en : promo.whatsapp_msg_es) ||
    (locale === "en" ? settings?.whatsapp_booking_msg_en : settings?.whatsapp_booking_msg_es) ||
    (locale === "en"
      ? `Hi! I'm interested in: ${promo.title_en}`
      : `¡Hola! Me interesa: ${promo.title_es}`);

  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(prefill)}`
    : null;

  return (
    <div className="promo-page">
      <div className="promo-inner">
        {promo.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="promo-poster" src={promo.poster_url} alt={title} />
        ) : (
          <div className="promo-poster promo-poster--placeholder">
            <span>{title}</span>
          </div>
        )}

        {waHref ? (
          <a className="promo-cta" href={waHref} target="_blank" rel="noopener noreferrer">
            {buttonLabel}
          </a>
        ) : (
          <p className="promo-cta promo-cta--disabled">
            {locale === "en"
              ? "Booking number not configured yet."
              : "Número de reservas no configurado todavía."}
          </p>
        )}
      </div>
    </div>
  );
}
