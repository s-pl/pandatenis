import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/admin/page-shell";
import { StudentDetail } from "@/components/admin/students/student-detail";
import { EditStudentButton } from "@/components/admin/students/edit-student-button";
import { avatarUrl, buildAvatarSeed } from "@/lib/avatar";
import { requireAdmin } from "@/lib/dal";
import { normalizeWhatsappNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Alumno ${id.slice(0, 6)}` };
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [
    studentRes,
    guardiansRes,
    groupsRes,
    profilesRes,
    timelineRes,
    progressRes,
    medalsRes,
    awardsRes,
    paymentsRes,
    attendanceRes,
    reportsRes,
    mediaRes,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, birth_date, address, level, dominant_hand, group_id, professor_id, medical_info, image_consent, coach_notes, active, start_date")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("guardians").select("id, full_name, phone, email, relationship").eq("student_id", id),
    supabase.from("groups").select("id, name, level").order("name"),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
    supabase
      .from("student_timeline_events")
      .select("id, date, title, detail, type")
      .eq("student_id", id)
      .order("date", { ascending: false })
      .limit(40),
    supabase
      .from("progress_evaluations")
      .select("id, term, drive, reves, saque, actitud, asistencia, coach_comment, created_at")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("medals").select("id, name, color, criteria, sort_order").order("sort_order"),
    supabase
      .from("student_medals")
      .select("id, medal_id, awarded_at")
      .eq("student_id", id)
      .order("awarded_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, concept, amount, due_date, paid_at, status, method")
      .eq("student_id", id)
      .order("due_date", { ascending: false }),
    supabase
      .from("attendance_records")
      .select("status, classes!inner(date, student_id)")
      .eq("student_id", id),
    supabase
      .from("term_reports")
      .select("id, term, sent_at, created_at")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("media_assets")
      .select("id, title, type, uploaded_at, consent_checked")
      .eq("student_id", id)
      .order("uploaded_at", { ascending: false })
      .limit(6),
  ]);

  const student = studentRes.data;
  if (!student) notFound();

  const guardians = guardiansRes.data ?? [];
  const guardian = guardians[0] ?? null;
  const group = groupsRes.data?.find((g) => g.id === student.group_id) ?? null;
  const teachers = (profilesRes.data ?? []).map((row) => ({ id: row.id, fullName: row.full_name }));
  const teacher = teachers.find((t) => t.id === student.professor_id) ?? null;

  const timeline = (timelineRes.data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    title: row.title,
    detail: row.detail ?? "",
    type: row.type as "grupo" | "evaluacion" | "medalla" | "foto" | "torneo" | "pago",
  }));

  const evaluations = (progressRes.data ?? []).map((row) => ({
    id: row.id,
    term: row.term,
    drive: row.drive,
    reves: row.reves,
    saque: row.saque,
    actitud: row.actitud,
    asistencia: row.asistencia,
    coachComment: row.coach_comment ?? "",
    createdAt: row.created_at,
  }));
  const latestEvaluation = evaluations[0] ?? null;

  const medalsCatalog = (medalsRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    criteria: row.criteria ?? "",
  }));
  const awards = (awardsRes.data ?? []).map((row) => ({
    id: row.id,
    medalId: row.medal_id,
    awardedAt: row.awarded_at,
  }));

  const payments = (paymentsRes.data ?? []).map((row) => ({
    id: row.id,
    concept: row.concept,
    amount: Number(row.amount),
    dueDate: row.due_date,
    paidAt: row.paid_at,
    status: row.status as "pagado" | "pendiente" | "atrasado",
    method: row.method as "efectivo" | "transferencia" | "bizum" | null,
  }));

  const attendanceRows = (attendanceRes.data ?? []) as Array<{ status: string }>;
  const attendanceRate =
    attendanceRows.length === 0
      ? null
      : Math.round((attendanceRows.filter((row) => row.status === "asistio").length / attendanceRows.length) * 100);
  const absences = attendanceRows.filter((row) => row.status === "no_asistio").length;

  const fullName = `${student.first_name} ${student.last_name}`;
  const whatsappPhone = guardian?.phone ? normalizeWhatsappNumber(guardian.phone) : "";
  const [{ data: whatsappMessages }, { data: whatsappConversation }] = whatsappPhone
    ? await Promise.all([
        supabase
          .from("whatsapp_messages")
          .select("id, direction, status, body_text, template_name, created_at")
          .eq("recipient_phone", whatsappPhone)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("whatsapp_conversations")
          .select("tags, internal_note, marketing_opt_out, last_inbound_at, last_outbound_at, last_message_at")
          .eq("phone", whatsappPhone)
          .maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];

  return (
    <PageShell
      title={fullName}
      description={`${group ? `Grupo ${group.name}` : "Sin grupo asignado"}${teacher ? ` · ${teacher.fullName}` : ""}`}
      media={
        <div className="relative h-16 w-16 overflow-hidden rounded-full bg-[var(--surface-muted)] ring-2 ring-[var(--border)]">
          <Image
            src={avatarUrl(buildAvatarSeed(student.id, student.first_name, student.last_name), "pixel-art")}
            alt=""
            fill
            sizes="64px"
            unoptimized
            className="object-cover"
          />
        </div>
      }
      meta={
        <>
          <Badge tone={student.active ? "success" : "neutral"}>{student.active ? "Activo" : "Archivado"}</Badge>
          <Badge tone="primary">Nivel {student.level}</Badge>
          {attendanceRate !== null && <Badge tone="info">Asistencia {attendanceRate}%</Badge>}
          {absences > 5 && <Badge tone="danger">{absences} faltas</Badge>}
        </>
      }
      actions={
        <>
          <Link href="/admin/students">
            <Button variant="secondary" size="sm" iconLeft={<ArrowLeft className="h-3.5 w-3.5" />}>
              Volver
            </Button>
          </Link>
          <EditStudentButton
            studentId={student.id}
            guardianId={guardian?.id ?? null}
            studentName={fullName}
            groups={(groupsRes.data ?? []).map((g) => ({ id: g.id, name: g.name, level: g.level }))}
            teachers={teachers}
            initial={{
              firstName: student.first_name,
              lastName: student.last_name,
              birthDate: student.birth_date,
              address: student.address ?? "",
              level: student.level as "Rojo" | "Naranja" | "Verde" | "Amarillo",
              dominantHand: student.dominant_hand as "Derecha" | "Izquierda" | "Ambidiestro",
              groupId: student.group_id,
              professorId: student.professor_id,
              medicalInfo: student.medical_info ?? "",
              imageConsent: student.image_consent,
              coachNotes: student.coach_notes ?? "",
              guardianName: guardian?.full_name ?? "",
              guardianPhone: guardian?.phone ?? "",
              guardianEmail: guardian?.email ?? "",
              relationship: guardian?.relationship ?? "Madre",
            }}
          />
        </>
      }
    >
      <StudentDetail
        student={{
          id: student.id,
          firstName: student.first_name,
          lastName: student.last_name,
          birthDate: student.birth_date,
          address: student.address ?? "",
          level: student.level as "Rojo" | "Naranja" | "Verde" | "Amarillo",
          dominantHand: student.dominant_hand as "Derecha" | "Izquierda" | "Ambidiestro",
          groupName: group?.name ?? null,
          teacherName: teacher?.fullName ?? null,
          startDate: student.start_date,
          medicalInfo: student.medical_info ?? "",
          imageConsent: student.image_consent,
          coachNotes: student.coach_notes ?? "",
        }}
        guardian={guardian}
        timeline={timeline}
        evaluations={evaluations}
        latestEvaluation={latestEvaluation}
        medalsCatalog={medalsCatalog}
        awards={awards}
        payments={payments}
        attendanceStats={{ rate: attendanceRate, absences }}
        reports={(reportsRes.data ?? []).map((row) => ({
          id: row.id,
          term: row.term,
          sentAt: row.sent_at,
          createdAt: row.created_at,
        }))}
        media={(mediaRes.data ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          type: row.type as "foto" | "video",
          uploadedAt: row.uploaded_at,
          consentChecked: row.consent_checked,
        }))}
        whatsapp={{
          phone: whatsappPhone || null,
          tags: Array.isArray(whatsappConversation?.tags) ? whatsappConversation.tags : [],
          internalNote: whatsappConversation?.internal_note ?? null,
          marketingOptOut: Boolean(whatsappConversation?.marketing_opt_out),
          lastMessageAt: whatsappConversation?.last_message_at ?? null,
          messages: (whatsappMessages ?? []).map((row) => ({
            id: row.id,
            direction: row.direction as "inbound" | "outbound",
            status: row.status as string,
            body: row.body_text ?? row.template_name ?? "",
            createdAt: row.created_at,
          })),
        }}
      />
    </PageShell>
  );
}
