"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FileText,
  History,
  ImageIcon,
  LayoutDashboard,
  Medal as MedalIcon,
  Phone,
  Trophy,
  User,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FormEvent, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { awardMedalAction, removeMedalAction } from "@/lib/admin/actions/medals";
import { saveProgressEvaluation } from "@/lib/admin/actions/progress";
import { createTermReportAction } from "@/lib/admin/actions/reports";
import { formatLongDate, formatMoney, formatPhoneEs, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  address: string;
  level: "Rojo" | "Naranja" | "Verde" | "Amarillo";
  dominantHand: "Derecha" | "Izquierda" | "Ambidiestro";
  groupName: string | null;
  teacherName: string | null;
  startDate: string;
  medicalInfo: string;
  imageConsent: boolean;
  coachNotes: string;
};

type Guardian = { id: string; full_name: string; phone: string; email: string | null; relationship: string } | null;
type TimelineEvent = { id: string; date: string; title: string; detail: string; type: "grupo" | "evaluacion" | "medalla" | "foto" | "torneo" | "pago" };
type Evaluation = {
  id: string;
  term: string;
  drive: number;
  reves: number;
  saque: number;
  actitud: number;
  asistencia: number;
  coachComment: string;
  createdAt: string;
};
type Medal = { id: string; name: string; color: string; criteria: string };
type Award = { id: string; medalId: string; awardedAt: string };
type Payment = {
  id: string;
  concept: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: "pagado" | "pendiente" | "atrasado";
  method: "efectivo" | "transferencia" | "bizum" | null;
};
type Report = { id: string; term: string; sentAt: string | null; createdAt: string };
type MediaAsset = {
  id: string;
  title: string;
  type: "foto" | "video";
  uploadedAt: string;
  consentChecked: boolean;
};
type Tab = "resumen" | "datos" | "progreso" | "historial" | "medallas" | "pagos";

const TABS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  { id: "resumen", label: "Resumen", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "datos", label: "Datos", icon: <User className="h-4 w-4" /> },
  { id: "progreso", label: "Progreso", icon: <Activity className="h-4 w-4" /> },
  { id: "historial", label: "Historial", icon: <History className="h-4 w-4" /> },
  { id: "medallas", label: "Medallas", icon: <MedalIcon className="h-4 w-4" /> },
  { id: "pagos", label: "Pagos", icon: <CreditCard className="h-4 w-4" /> },
];

const TAB_ITEMS: TabItem[] = TABS.map((t) => ({ value: t.id, label: t.label, icon: t.icon }));

const TIMELINE_ICON: Record<TimelineEvent["type"], string> = {
  grupo: "📋",
  evaluacion: "📊",
  medalla: "🏅",
  foto: "📸",
  torneo: "🏆",
  pago: "💳",
};

const PROGRESS_KEYS: Array<{ key: "drive" | "reves" | "saque" | "actitud" | "asistencia"; label: string; description: string }> = [
  { key: "drive", label: "Drive", description: "Golpe natural de derecha" },
  { key: "reves", label: "Revés", description: "Golpe de izquierda (a una o dos manos)" },
  { key: "saque", label: "Saque", description: "Ejecución y consistencia del servicio" },
  { key: "actitud", label: "Actitud", description: "Comportamiento, compromiso y respeto" },
  { key: "asistencia", label: "Asistencia", description: "Puntualidad y constancia" },
];

export function StudentDetail({
  student,
  guardian,
  timeline,
  evaluations,
  latestEvaluation,
  medalsCatalog,
  awards,
  payments,
  attendanceStats,
  reports,
  media,
}: {
  student: Student;
  guardian: Guardian;
  timeline: TimelineEvent[];
  evaluations: Evaluation[];
  latestEvaluation: Evaluation | null;
  medalsCatalog: Medal[];
  awards: Award[];
  payments: Payment[];
  attendanceStats: { rate: number | null; absences: number };
  reports: Report[];
  media: MediaAsset[];
}) {
  const [tab, setTab] = useState<Tab>("resumen");

  const pendingPayments = payments.filter((p) => p.status !== "pagado");
  const paidPayments = payments.filter((p) => p.status === "pagado");
  const overduePayments = payments.filter((p) => p.status === "atrasado");
  const pendingAmount = pendingPayments.reduce((acc, p) => acc + p.amount, 0);
  const nextPayment = [...pendingPayments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
  const latestReport = reports[0] ?? null;
  const latestMedia = media[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Tabs items={TAB_ITEMS} value={tab} onChange={(v) => setTab(v as Tab)} />

      <AnimatePresence mode="wait">
        {tab === "resumen" && (
          <motion.div
            key="resumen"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 xl:grid-cols-[1.45fr_1fr]"
          >
            <Card>
              <CardHeader title="Ficha 360" description="Lo importante del alumno y su familia en una sola vista." />
              <CardBody className="grid gap-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile
                    label="Asistencia"
                    value={attendanceStats.rate === null ? "Sin datos" : `${attendanceStats.rate}%`}
                    tone={attendanceStats.absences > 5 ? "warning" : "success"}
                  />
                  <StatTile label="Faltas" value={String(attendanceStats.absences)} tone="info" />
                  <StatTile
                    label="Pendiente"
                    value={formatMoney(pendingAmount)}
                    tone={pendingAmount > 0 ? "warning" : "success"}
                  />
                  <StatTile label="Medallas" value={`${awards.length}/${medalsCatalog.length}`} tone="info" />
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <SummaryRow
                    icon={<User className="h-4 w-4" />}
                    label="Alumno"
                    title={`${student.firstName} ${student.lastName}`}
                    detail={`${student.groupName ?? "Sin grupo"} · ${student.teacherName ?? "Sin entrenador"} · Nivel ${student.level}`}
                  />
                  <SummaryRow
                    icon={<Phone className="h-4 w-4" />}
                    label="Tutor"
                    title={guardian?.full_name ?? "Sin tutor asignado"}
                    detail={guardian ? `${guardian.relationship} · ${formatPhoneEs(guardian.phone)}` : "Añade un responsable para poder contactar."}
                    href={guardian?.phone ? `tel:${guardian.phone}` : undefined}
                    actionLabel={guardian?.phone ? "Llamar" : undefined}
                  />
                  <SummaryRow
                    icon={<CreditCard className="h-4 w-4" />}
                    label="Cobros"
                    title={
                      pendingAmount > 0
                        ? `${formatMoney(pendingAmount, true)} pendiente`
                        : "Sin cobros pendientes"
                    }
                    detail={
                      overduePayments.length > 0
                        ? `${overduePayments.length} recibo${overduePayments.length === 1 ? "" : "s"} atrasado${overduePayments.length === 1 ? "" : "s"}`
                        : nextPayment
                          ? `Próximo vencimiento: ${formatLongDate(nextPayment.dueDate)}`
                          : "Todos los recibos están al día."
                    }
                    href="/admin/payments"
                    actionLabel="Ver pagos"
                    tone={overduePayments.length > 0 ? "danger" : pendingAmount > 0 ? "warning" : "success"}
                  />
                  <SummaryRow
                    icon={<Activity className="h-4 w-4" />}
                    label="Progreso"
                    title={latestEvaluation ? latestEvaluation.term : "Sin evaluación"}
                    detail={
                      latestEvaluation
                        ? `Actitud ${latestEvaluation.actitud}% · asistencia ${latestEvaluation.asistencia}%`
                        : "Guarda la primera evaluación desde la pestaña Progreso."
                    }
                  />
                  <SummaryRow
                    icon={<FileText className="h-4 w-4" />}
                    label="Informes"
                    title={latestReport ? latestReport.term : "Sin informes"}
                    detail={
                      latestReport
                        ? latestReport.sentAt
                          ? `Enviado ${relativeTime(latestReport.sentAt)}`
                          : `Creado ${relativeTime(latestReport.createdAt)}`
                        : "Genera un informe trimestral cuando haya evaluación."
                    }
                  />
                  <SummaryRow
                    icon={<ImageIcon className="h-4 w-4" />}
                    label="Media"
                    title={latestMedia ? latestMedia.title : "Sin archivos"}
                    detail={
                      latestMedia
                        ? `${latestMedia.type === "foto" ? "Foto" : "Vídeo"} · ${relativeTime(latestMedia.uploadedAt)} · ${latestMedia.consentChecked ? "consentimiento revisado" : "revisar consentimiento"}`
                        : "Las fotos y vídeos asociados aparecerán aquí."
                    }
                    tone={latestMedia && !latestMedia.consentChecked ? "warning" : "neutral"}
                  />
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}

        {tab === "datos" && (
          <motion.div
            key="datos"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 lg:grid-cols-[1.6fr_1fr]"
          >
            <Card>
              <CardHeader title="Datos personales" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <DataItem label="Fecha de nacimiento" value={formatLongDate(student.birthDate)} />
                <DataItem label="Mano dominante" value={student.dominantHand} />
                <DataItem label="Nivel" value={`Nivel ${student.level}`} />
                <DataItem label="Alta en la escuela" value={formatLongDate(student.startDate)} />
                <DataItem label="Grupo" value={student.groupName ?? "Sin asignar"} />
                <DataItem label="Entrenador" value={student.teacherName ?? "Sin asignar"} />
                <DataItem label="Dirección" value={student.address || "—"} className="sm:col-span-2" />
                <DataItem
                  label="Información médica"
                  value={student.medicalInfo || "Sin observaciones"}
                  className="sm:col-span-2"
                />
                <DataItem
                  label="Consentimiento de imagen"
                  value={student.imageConsent ? "Sí, autorizado" : "No autorizado"}
                  tone={student.imageConsent ? "primary" : "warning"}
                />
                <DataItem label="Notas del entrenador" value={student.coachNotes || "—"} className="sm:col-span-2" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Tutor responsable" />
              <CardBody>
                {guardian ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-lg font-semibold">{guardian.full_name}</p>
                    <p className="text-sm text-[var(--muted)]">{guardian.relationship}</p>
                    <a
                      href={`tel:${guardian.phone}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm hover:bg-[var(--surface-muted)]"
                    >
                      <Phone className="h-4 w-4" /> {formatPhoneEs(guardian.phone)}
                    </a>
                    {guardian.email && (
                      <a
                        href={`mailto:${guardian.email}`}
                        className="text-sm text-[var(--muted)] hover:text-[var(--primary)]"
                      >
                        {guardian.email}
                      </a>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={<User className="h-5 w-5" />}
                    title="Sin tutor asignado"
                    description="Edita el alumno desde el listado para añadir un responsable."
                  />
                )}
              </CardBody>
            </Card>
          </motion.div>
        )}

        {tab === "progreso" && (
          <motion.div
            key="progreso"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"
          >
            <ProgressForm studentId={student.id} latest={latestEvaluation} />
            <Card>
              <CardHeader
                title="Histórico de evaluaciones"
                description="Cada evaluación queda como informe imprimible en la sección Informes."
              />
              <CardBody>
                {evaluations.length === 0 ? (
                  <EmptyState
                    icon={<Activity className="h-5 w-5" />}
                    title="Aún no hay evaluaciones"
                    description="Guarda la primera evaluación cuando termines el primer trimestre."
                  />
                ) : (
                  <ul className="space-y-3">
                    {evaluations.map((evaluation) => (
                      <li key={evaluation.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{evaluation.term}</p>
                          <span className="text-xs text-[var(--muted)]">{relativeTime(evaluation.createdAt)}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
                          {PROGRESS_KEYS.map((entry) => (
                            <div key={entry.key} className="rounded-xl bg-[var(--surface-muted)] py-2">
                              <p className="text-[var(--muted)]">{entry.label}</p>
                              <p className="text-sm font-semibold">{evaluation[entry.key]}</p>
                            </div>
                          ))}
                        </div>
                        {evaluation.coachComment && (
                          <p className="mt-3 text-xs text-[var(--muted)]">🪶 {evaluation.coachComment}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </motion.div>
        )}

        {tab === "historial" && (
          <motion.div
            key="historial"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardHeader
                title="Historial"
                description="Eventos relevantes en orden cronológico. Se registran automáticamente al cambiar grupo, marcar pagos, asignar medallas, etc."
              />
              <CardBody>
                {timeline.length === 0 ? (
                  <EmptyState
                    icon={<History className="h-5 w-5" />}
                    title="Sin eventos por ahora"
                    description="Cuando registres pagos, cambios de grupo o medallas aparecerán aquí en orden cronológico."
                  />
                ) : (
                  <ol className="relative space-y-6 border-l border-[var(--border)] pl-6">
                    {timeline.map((event) => (
                      <li key={event.id} className="relative">
                        <span className="absolute -left-[34px] grid h-8 w-8 place-items-center rounded-full bg-[var(--surface)] text-base shadow-[var(--shadow-sm)]">
                          {TIMELINE_ICON[event.type]}
                        </span>
                        <p className="text-sm font-semibold">{event.title}</p>
                        {event.detail && (
                          <p className="mt-1 text-sm text-[var(--muted)]">{event.detail}</p>
                        )}
                        <p className="mt-1 text-xs text-[var(--muted)]">{formatLongDate(event.date)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
          </motion.div>
        )}

        {tab === "medallas" && (
          <motion.div
            key="medallas"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 lg:grid-cols-2"
          >
            <MedalsSection
              studentId={student.id}
              medalsCatalog={medalsCatalog}
              awards={awards}
            />
            <Card>
              <CardHeader
                title="Progreso hacia el premio final"
                description="Visualiza qué medallas tiene conseguidas y cuáles le quedan."
              />
              <CardBody>
                <div className="mb-4 flex items-center justify-between text-sm">
                  <span>Conseguidas</span>
                  <span className="font-semibold">
                    {awards.length} de {medalsCatalog.length}
                  </span>
                </div>
                <div className="mb-6 h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full bg-[var(--primary)] transition-all"
                    style={{ width: `${medalsCatalog.length === 0 ? 0 : Math.round((awards.length / medalsCatalog.length) * 100)}%` }}
                  />
                </div>
                {awards.length === medalsCatalog.length && medalsCatalog.length > 0 ? (
                  <div className="rounded-2xl bg-[var(--primary-soft)] p-4 text-sm text-[var(--primary)]">
                    🎉 ¡Premio final completado! Tiene todas las medallas del programa.
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    Le faltan {medalsCatalog.length - awards.length}{" "}
                    {medalsCatalog.length - awards.length === 1 ? "medalla" : "medallas"} para completar la Medalla Aventura.
                  </p>
                )}
              </CardBody>
            </Card>
          </motion.div>
        )}

        {tab === "pagos" && (
          <motion.div
            key="pagos"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardHeader
                title="Recibos"
                description="Todos los pagos asociados al alumno."
                actions={
                  <Link href="/admin/payments">
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-muted)]">
                      Ver todos los recibos
                    </span>
                  </Link>
                }
              />
              <CardBody>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatTile
                    label="Cobrado"
                    value={formatMoney(paidPayments.reduce((acc, p) => acc + p.amount, 0))}
                    tone="success"
                  />
                  <StatTile
                    label="Pendiente"
                    value={formatMoney(pendingPayments.reduce((acc, p) => acc + p.amount, 0))}
                    tone="warning"
                  />
                  <StatTile
                    label="Recibos emitidos"
                    value={String(payments.length)}
                    tone="info"
                  />
                </div>
                {payments.length === 0 ? (
                  <EmptyState
                    icon={<CreditCard className="h-5 w-5" />}
                    title="Sin recibos todavía"
                    description="Crea el primer recibo desde la sección Pagos."
                  />
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {payments.map((payment) => (
                      <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-sm font-medium">{payment.concept}</p>
                          <p className="text-xs text-[var(--muted)]">Vence {formatLongDate(payment.dueDate)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">{formatMoney(payment.amount, true)}</span>
                          <Badge
                            tone={
                              payment.status === "pagado"
                                ? "success"
                                : payment.status === "atrasado"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {payment.status === "pagado" ? "Cobrado" : payment.status === "atrasado" ? "Atrasado" : "Pendiente"}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {attendanceStats.absences > 5 && (
        <Card>
          <CardBody className="flex items-center gap-3 bg-[var(--danger-soft)] text-[var(--danger)]">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-medium">
              Atención: lleva {attendanceStats.absences} faltas registradas. Considera contactar con la familia.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function ProgressForm({ studentId, latest }: { studentId: string; latest: Evaluation | null }) {
  const [term, setTerm] = useState(() => suggestNextTerm(latest?.term));
  const [values, setValues] = useState({
    drive: latest?.drive ?? 50,
    reves: latest?.reves ?? 50,
    saque: latest?.saque ?? 50,
    actitud: latest?.actitud ?? 80,
    asistencia: latest?.asistencia ?? 80,
  });
  const [comment, setComment] = useState(latest?.coachComment ?? "");
  const [pending, startTransition] = useTransition();
  const [reportPending, startReportTransition] = useTransition();

  function set<K extends keyof typeof values>(key: K, value: number) {
    setValues((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, value)) }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveProgressEvaluation({
        studentId,
        term,
        coachComment: comment,
        ...values,
      });
      if (result.ok) {
        toast.success("Evaluación guardada");
      } else {
        toast.error("No se ha podido guardar", { description: result.error });
      }
    });
  }

  function createReport() {
    startReportTransition(async () => {
      const result = await createTermReportAction({ studentId, term, coachComment: comment });
      if (result.ok) toast.success("Informe trimestral creado", { description: "Disponible en la sección Informes." });
      else toast.error("No se ha podido crear el informe", { description: result.error });
    });
  }

  return (
    <Card>
      <CardHeader
        title="Evaluación deportiva"
        description="Ajusta cada barra. Lo que guardes alimentará el informe trimestral."
      />
      <CardBody>
        <form onSubmit={onSubmit} className="grid gap-5">
          <Field label="Trimestre" required hint="Ejemplo: Otoño 2026 o 1.er trimestre 2025/26.">
            <Input value={term} onChange={(e) => setTerm(e.target.value)} />
          </Field>

          <div className="grid gap-4">
            {PROGRESS_KEYS.map((entry) => (
              <div key={entry.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{entry.label}</p>
                    <p className="text-xs text-[var(--muted)]">{entry.description}</p>
                  </div>
                  <span className="text-base font-semibold text-[var(--primary)]">{values[entry.key]}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={values[entry.key]}
                  onChange={(e) => set(entry.key, Number(e.target.value))}
                  className="mt-3 w-full accent-[var(--primary)]"
                />
              </div>
            ))}
          </div>

          <Field label="Comentario del entrenador">
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anota fortalezas, áreas a mejorar o anécdotas del trimestre."
            />
          </Field>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={createReport} loading={reportPending}>
              Generar informe trimestral
            </Button>
            <Button type="submit" loading={pending} iconLeft={<CheckCircle2 className="h-4 w-4" />}>
              Guardar evaluación
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function MedalsSection({
  studentId,
  medalsCatalog,
  awards,
}: {
  studentId: string;
  medalsCatalog: Medal[];
  awards: Award[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const awardedMap = new Map(awards.map((award) => [award.medalId, award]));

  function toggle(medal: Medal) {
    const existing = awardedMap.get(medal.id);
    setPendingId(medal.id);
    startTransition(async () => {
      const result = existing
        ? await removeMedalAction(existing.id, studentId)
        : await awardMedalAction({ studentId, medalId: medal.id });
      setPendingId(null);
      if (result.ok) toast.success(existing ? "Medalla retirada" : "Medalla otorgada");
      else toast.error("No se ha podido actualizar", { description: result.error });
    });
  }

  return (
    <Card>
      <CardHeader
        title="Medalla Aventura"
        description="Pulsa sobre una medalla para otorgarla o retirarla."
      />
      <CardBody>
        {medalsCatalog.length === 0 ? (
          <EmptyState icon={<Trophy className="h-5 w-5" />} title="Sin medallas configuradas" />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {medalsCatalog.map((medal) => {
              const award = awardedMap.get(medal.id);
              const granted = !!award;
              return (
                <li key={medal.id}>
                  <button
                    type="button"
                    onClick={() => toggle(medal)}
                    disabled={pendingId === medal.id}
                    className={cn(
                      "flex w-full flex-col items-center gap-2 rounded-2xl border p-4 transition-all",
                      granted
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-[var(--shadow-sm)]"
                        : "border-dashed border-[var(--border-strong)] bg-[var(--surface)] opacity-70 hover:opacity-100",
                    )}
                  >
                    <span
                      className="grid h-14 w-14 place-items-center rounded-full text-white shadow-[var(--shadow-sm)]"
                      style={{ background: granted ? medal.color : "#cbd5dc" }}
                    >
                      <MedalIcon className="h-7 w-7" />
                    </span>
                    <span className="text-sm font-semibold">{medal.name}</span>
                    {medal.criteria && (
                      <span className="text-center text-xs text-[var(--muted)]">{medal.criteria}</span>
                    )}
                    {granted && award && (
                      <span className="text-[10px] text-[var(--primary)]">
                        Otorgada {formatLongDate(award.awardedAt)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function SummaryRow({
  icon,
  label,
  title,
  detail,
  href,
  actionLabel,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  title: string;
  detail: string;
  href?: string;
  actionLabel?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass: Record<"neutral" | "success" | "warning" | "danger", string> = {
    neutral: "text-[var(--primary)]",
    success: "text-[var(--success)]",
    warning: "text-[var(--warning)]",
    danger: "text-[var(--danger)]",
  };

  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{label}</span>
      <span className="truncate text-sm font-semibold">{title}</span>
      <span className="line-clamp-2 text-xs text-[var(--muted)]">{detail}</span>
    </div>
  );

  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <span className={cn("grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-[var(--surface-muted)]", toneClass[tone])}>
        {icon}
      </span>
      {content}
      {href && actionLabel && (
        <Link href={href} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-muted)]">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function DataItem({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "primary" | "warning";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "",
    primary: "text-[var(--primary)]",
    warning: "text-[var(--warning)]",
  };
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{label}</span>
      <span className={cn("text-sm font-medium", tones[tone])}>{value}</span>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "info" }) {
  const tones: Record<string, string> = {
    success: "bg-[var(--success-soft)] text-[var(--success)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    info: "bg-[var(--info-soft)] text-[var(--info)]",
  };
  return (
    <div className={cn("rounded-2xl px-4 py-3", tones[tone])}>
      <p className="text-xs uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function suggestNextTerm(previous?: string): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (previous) return previous;
  if (month >= 0 && month <= 3) return `2.º trimestre ${year - 1}/${String(year).slice(2)}`;
  if (month >= 4 && month <= 7) return `3.er trimestre ${year - 1}/${String(year).slice(2)}`;
  return `1.er trimestre ${year}/${String(year + 1).slice(2)}`;
}
