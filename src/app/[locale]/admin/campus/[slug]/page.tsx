import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ExternalLink, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/admin/page-shell";
import { PaymentsManager } from "@/components/admin/payments/payments-manager";
import { RegistrationInviteDialog } from "@/components/admin/registrations/registration-invite-dialog";
import {
  CampusDetailsCard,
  type CampusDetail,
} from "@/components/admin/campus/campus-details-card";
import { CopyLinkButton } from "@/components/admin/campus/copy-link-button";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/dal";
import { formatLongDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Campus · ${slug}` };
}

const STATUS_LABEL: Record<"pendiente" | "confirmada" | "convertida", string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  convertida: "Convertida",
};
const STATUS_TONE: Record<"pendiente" | "confirmada" | "convertida", "warning" | "info" | "success"> = {
  pendiente: "warning",
  confirmada: "info",
  convertida: "success",
};

type CampusRegistration = {
  id: string;
  full_name: string | null;
  child_name: string | null;
  child_last_name: string | null;
  status: string | null;
  type: string | null;
  submitted_at: string;
};

function RegistrationGroup({
  title,
  tone,
  count,
  items,
  emptyText,
}: {
  title: string;
  tone: "warning" | "success";
  count: number;
  items: CampusRegistration[];
  emptyText: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            tone === "success" ? "bg-[var(--success)]" : "bg-[var(--warning)]"
          }`}
        />
        <h4 className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted)]">
          {title}
        </h4>
        <Badge tone={tone}>{count}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-3 text-[12px] text-[var(--muted)]">
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-3">
          {items.map((r) => {
            const child = [r.child_name, r.child_last_name].filter(Boolean).join(" ").trim();
            const family = r.full_name?.trim() || "Familia pendiente";
            const status = (r.status as "pendiente" | "confirmada" | "convertida") ?? "pendiente";
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{child || "Ficha pendiente"}</p>
                  <p className="truncate text-[11.5px] text-[var(--muted)]">
                    {family} · {formatLongDate(r.submitted_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.type === "ambos" && <Badge tone="primary">Ambos</Badge>}
                  <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default async function CampusDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const { supabase } = await requireAdmin();

  const [courseRes, registrationsRes, studentsRes] = await Promise.all([
    supabase
      .from("campus_courses")
      .select(
        "id, slug, title, kind, dates_label, intro, image_path, is_public, sort_order, starts_on, ends_on",
      )
      .eq("slug", slug)
      .maybeSingle(),
    supabase
      .from("registrations")
      .select("id, full_name, phone, child_name, child_last_name, status, type, submitted_at")
      .eq("course_slug", slug)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("students")
      .select("id, first_name, last_name, guardians(phone, full_name)")
      .order("first_name")
      .limit(2000),
  ]);

  if (!courseRes.data) notFound();
  const row = courseRes.data;

  const course: CampusDetail = {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    kind: (row.kind as "campus" | "escuela") ?? "campus",
    datesLabel: (row.dates_label as string) ?? "",
    startsOn: (row.starts_on as string | null) ?? null,
    endsOn: (row.ends_on as string | null) ?? null,
    intro: (row.intro as string) ?? "",
    imagePath: (row.image_path as string | null) ?? null,
    isPublic: Boolean(row.is_public),
    sortOrder: (row.sort_order as number) ?? 0,
  };

  // ── Pagos vinculados a este campus ──
  const paymentsRes = await supabase
    .from("payments")
    .select("id, student_id, concept, amount, due_date, paid_at, status, method")
    .eq("campus_course_id", course.id)
    .order("due_date", { ascending: false });

  const paymentRows = paymentsRes.data ?? [];
  const paymentIds = paymentRows.map((p) => p.id);

  const receiptsRes = paymentIds.length
    ? await supabase.from("receipts").select("payment_id, receipt_number").in("payment_id", paymentIds)
    : { data: [] as { payment_id: string; receipt_number: string }[] };

  const students = (studentsRes.data ?? []).map((s) => {
    const guardian = Array.isArray(s.guardians) ? s.guardians[0] : s.guardians;
    return {
      id: s.id as string,
      fullName: `${s.first_name} ${s.last_name}`,
      guardianName: guardian?.full_name ?? null,
      guardianPhone: guardian?.phone ?? null,
    };
  });
  const studentById = new Map(students.map((s) => [s.id, s]));
  const receiptByPayment = new Map(
    (receiptsRes.data ?? []).map((r) => [r.payment_id, r.receipt_number]),
  );

  const payments = paymentRows.map((p) => {
    const student = studentById.get(p.student_id);
    return {
      id: p.id as string,
      studentId: p.student_id as string,
      studentName: student?.fullName ?? "—",
      guardianName: student?.guardianName ?? null,
      guardianPhone: student?.guardianPhone ?? null,
      concept: p.concept as string,
      amount: Number(p.amount),
      dueDate: p.due_date as string,
      paidAt: p.paid_at as string | null,
      status: p.status as "pagado" | "pendiente" | "atrasado",
      method: p.method as "efectivo" | "transferencia" | "bizum" | null,
      receiptNumber: receiptByPayment.get(p.id) ?? null,
    };
  });

  const collected = payments
    .filter((p) => p.status === "pagado")
    .reduce((acc, p) => acc + p.amount, 0);
  const pending = payments
    .filter((p) => p.status !== "pagado")
    .reduce((acc, p) => acc + p.amount, 0);

  const registrations = registrationsRes.data ?? [];
  const pendingRegs = registrations.filter(
    (r) => ((r.status as string) ?? "pendiente") === "pendiente",
  );
  const completedRegs = registrations.filter(
    (r) => ((r.status as string) ?? "pendiente") !== "pendiente",
  );

  // Enlace público de inscripción de este campus (absoluto para compartir).
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";
  const inscriptionUrl = `${origin}/${locale}/campamentos/${course.slug}/inscripcion`;

  return (
    <PageShell
      variant="tinted"
      title={course.title}
      description={course.datesLabel || "Gestiona fechas, inscripciones y pagos de este campus."}
      actions={
        <Link
          href="/admin/campus"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--muted)] hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todos los campus
        </Link>
      }
    >
      <CampusDetailsCard course={course} />

      {/* ── Inscripciones ── */}
      <Card>
        <CardHeader
          title="Inscripciones"
          description="Genera una ficha privada para una familia, o comparte el enlace público de este campus."
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <RegistrationInviteDialog
                lockedCampus={{ slug: course.slug, label: course.title }}
                triggerLabel="Generar ficha privada"
                triggerSize="sm"
                triggerClassName="w-full sm:w-auto"
              />
              <div className="flex items-center gap-2">
                <CopyLinkButton url={inscriptionUrl} label="Enlace público" />
                <a
                  href={inscriptionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--primary)] hover:underline"
                >
                  Abrir <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          }
        />
        <CardBody>
          {registrations.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="h-5 w-5" />}
              title="Sin inscripciones todavía"
              description="Cuando una familia rellene el formulario de este campus aparecerá aquí."
            />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-[var(--muted)]">
                  {pendingRegs.length} pendiente{pendingRegs.length === 1 ? "" : "s"} ·{" "}
                  {completedRegs.length} completada{completedRegs.length === 1 ? "" : "s"}
                </span>
                <Link
                  href="/admin/registrations?type=campus"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--primary)] hover:underline"
                >
                  Confirmar / convertir en inscripciones
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <RegistrationGroup
                title="Pendientes"
                tone="warning"
                count={pendingRegs.length}
                items={pendingRegs as CampusRegistration[]}
                emptyText="No hay inscripciones pendientes."
              />
              <RegistrationGroup
                title="Completadas"
                tone="success"
                count={completedRegs.length}
                items={completedRegs as CampusRegistration[]}
                emptyText="Todavía no hay inscripciones confirmadas o convertidas."
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Pagos ── */}
      <Card>
        <CardHeader
          title="Pagos del campus"
          description="Los recibos que crees aquí quedan vinculados a este campus."
          actions={
            <div className="flex items-center gap-2">
              <Badge tone="success">Cobrado · {formatMoney(collected)}</Badge>
              {pending > 0 && <Badge tone="warning">Pendiente · {formatMoney(pending)}</Badge>}
            </div>
          }
        />
        <CardBody>
          <PaymentsManager payments={payments} students={students} campusCourseId={course.id} />
        </CardBody>
      </Card>
    </PageShell>
  );
}
