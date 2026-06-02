import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function AdminNotFound() {
  const t = await getTranslations("admin.notFound");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--surface-muted)] text-[var(--muted)]">
        <Compass className="h-7 w-7" />
      </span>
      <div className="max-w-sm">
        <h2 className="text-[18px] font-bold text-foreground">{t("title")}</h2>
        <p className="mt-1.5 text-[13.5px] leading-snug text-[var(--muted)]">{t("description")}</p>
      </div>
      <Link
        href="/admin"
        className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--primary)] px-5 text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5"
      >
        {t("back")}
      </Link>
    </div>
  );
}
