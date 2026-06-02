import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Medal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/admin/page-shell";
import { requireAdmin } from "@/lib/dal";
import { formatShortDate } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("medals") };
}
export const dynamic = "force-dynamic";

export default async function MedalsPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.medals");

  const [medalsRes, awardsRes] = await Promise.all([
    supabase.from("medals").select("id, name, color, criteria, sort_order").order("sort_order"),
    supabase
      .from("student_medals")
      .select("id, awarded_at, medals(name, color), students(first_name, last_name)")
      .order("awarded_at", { ascending: false })
      .limit(40),
  ]);

  const medals = medalsRes.data ?? [];
  const awards = (awardsRes.data ?? []).map((row) => {
    const medal = Array.isArray(row.medals) ? row.medals[0] : row.medals;
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    return {
      id: row.id,
      awardedAt: row.awarded_at,
      medalName: medal?.name ?? "—",
      medalColor: medal?.color ?? "#94a3b8",
      studentName: student ? `${student.first_name} ${student.last_name}` : "—",
    };
  });

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={
        <>
          <Badge tone="primary" iconLeft={<Medal className="h-3 w-3" />}>
            {medals.length} medallas
          </Badge>
          <Badge tone="success">{awards.length} entregadas</Badge>
        </>
      }
    >
      <Card>
        <CardHeader title="Medallas disponibles" description="Configuradas para tu escuela." />
        <CardBody>
          {medals.length === 0 ? (
            <EmptyState icon={<Medal className="h-5 w-5" />} title="Sin medallas configuradas" />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {medals.map((medal) => (
                <li
                  key={medal.id}
                  className="flex flex-col items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center shadow-[var(--shadow-sm)]"
                >
                  <span
                    className="grid h-12 w-12 place-items-center rounded-full text-white shadow-[var(--shadow-sm)]"
                    style={{ background: medal.color }}
                  >
                    <Medal className="h-6 w-6" />
                  </span>
                  <p className="mt-2.5 text-[13px] font-semibold leading-tight">{medal.name}</p>
                  {medal.criteria && (
                    <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
                      {medal.criteria}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Últimas entregas"
          description="Histórico de reconocimientos por alumno."
        />
        <CardBody>
          {awards.length === 0 ? (
            <EmptyState icon={<Medal className="h-5 w-5" />} title="Aún no has entregado medallas" />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {awards.map((award) => (
                <li
                  key={award.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-white"
                      style={{ background: award.medalColor }}
                    >
                      <Medal className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{award.studentName}</p>
                      <p className="truncate text-[11.5px] text-[var(--muted)]">
                        {award.medalName}
                      </p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-[11.5px] text-[var(--muted)]">
                    {formatShortDate(award.awardedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </PageShell>
  );
}
