"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  HeartPulse,
  Link as LinkIcon,
  Mail,
  Phone,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { formatLongDate, formatPhoneEs, formatShortDate } from "@/lib/format";
import { RegistrationInviteDialog } from "@/components/admin/registrations/registration-invite-dialog";
import {
  convertRegistrationToStudentAction,
  deleteRegistrationAction,
  markRegistrationInviteSentAction,
} from "@/lib/admin/actions/registrations";
import type { AdminRole } from "@/lib/admin/roles";

type Relation = {
  fullName?: string;
  relationship?: string;
  phone?: string;
  email?: string;
};

type Row = {
  id: string;
  type: "escuela" | "campus" | "ambos";
  fullName: string;
  phone: string;
  email: string | null;
  childName: string;
  childLastName: string | null;
  childAge: number | null;
  childBirthDate: string | null;
  childGender: string | null;
  courseSlug: string | null;
  familyRelations: Relation[];
  allergies: string | null;
  illnesses: string | null;
  injuries: string | null;
  signerFirstName: string | null;
  signerLastName: string | null;
  consentMultimedia: boolean;
  termsAcceptedAt: string | null;
  preferredDays: string[];
  preferredTimeBlocks: string[];
  schedulingNotes: string | null;
  adminNotes: string | null;
  submittedAt: string;
  status: "pendiente" | "confirmada" | "convertida";
  studentId: string | null;
  registrationSource: "public_web" | "admin_link";
  inviteToken: string | null;
  inviteStatus: "draft" | "sent" | "completed" | "expired" | null;
  inviteLocale: "es" | "en";
  inviteCreatedAt: string | null;
  inviteExpiresAt: string | null;
  inviteCompletedAt: string | null;
};

type CourseOption = { slug: string; label: string; kind: "escuela" | "campus" };
type Level = "Rojo" | "Naranja" | "Verde" | "Amarillo";
type GroupOption = {
  id: string;
  name: string;
  level: Level;
  capacity: number;
  enrolled: number;
  weekdays: string[];
  startTime: string;
  endTime: string;
  location: string;
};

const statusTone: Record<Row["status"], "warning" | "info" | "success"> = {
  pendiente: "warning",
  confirmada: "info",
  convertida: "success",
};
const statusLabel: Record<Row["status"], string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  convertida: "Convertida",
};
const typeLabel: Record<Row["type"], string> = {
  escuela: "Escuela",
  campus: "Campus",
  ambos: "Escuela + Campus",
};
const typeTone: Record<Row["type"], "primary" | "accent" | "success"> = {
  escuela: "primary",
  campus: "accent",
  ambos: "success",
};
const PENDING_CHILD_NAME = "Alumno pendiente";
const localeLabel: Record<Row["inviteLocale"], string> = {
  es: "Español",
  en: "English",
};
const sourceLabel: Record<Row["registrationSource"], string> = {
  public_web: "Web pública",
  admin_link: "Enlace privado",
};
const inviteStatusLabel: Record<NonNullable<Row["inviteStatus"]>, string> = {
  draft: "Creado",
  sent: "Enviado",
  completed: "Completado",
  expired: "Caducado",
};
const levelOptions: Level[] = ["Rojo", "Naranja", "Verde", "Amarillo"];
const weekdayLabel: Record<string, string> = {
  L: "L",
  M: "M",
  X: "X",
  J: "J",
  V: "V",
  S: "S",
  D: "D",
};

function familyLabel(row: Row) {
  return row.fullName.trim() || "Familia pendiente";
}

function childLabel(row: Row) {
  const name = row.childName.trim();
  if (!name || name === PENDING_CHILD_NAME) return "Ficha pendiente";
  return name;
}

function childDetail(row: Row) {
  const label = childLabel(row);
  return row.childAge ? `${label} · ${row.childAge} años` : label;
}

function phoneLabel(row: Row) {
  return row.phone ? formatPhoneEs(row.phone) : "Pendiente";
}

function canCreateStudent(row: Row) {
  return Boolean(
    !row.studentId &&
      childLabel(row) !== "Ficha pendiente" &&
      row.childBirthDate &&
      row.termsAcceptedAt,
  );
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Pendiente";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "Pendiente";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function dateTimeLabel(value: string | null) {
  if (!value) return "Pendiente";
  return new Date(value).toLocaleString("es-ES");
}

function relationSummary(relations: Relation[]) {
  if (relations.length === 0) return "Pendiente";
  return relations
    .map((relation) =>
      [relation.fullName, relation.relationship, relation.phone, relation.email]
        .filter(Boolean)
        .join(" · "),
    )
    .join(" | ");
}

function groupScheduleLabel(group: GroupOption) {
  const days = group.weekdays.map((day) => weekdayLabel[day] ?? day).join(" ");
  const time =
    group.startTime && group.endTime
      ? `${group.startTime}-${group.endTime}`
      : group.startTime || group.endTime;
  return [days, time, group.location].filter(Boolean).join(" · ") || "Sin horario";
}

export function RegistrationsTable({
  rows,
  courses,
  groups,
  role,
}: {
  rows: Row[];
  courses: CourseOption[];
  groups: GroupOption[];
  role: AdminRole;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Row["status"]>("all");
  const [type, setType] = useState<"all" | Row["type"]>("all");
  const [details, setDetails] = useState<Row | null>(null);
  const [conversionTarget, setConversionTarget] = useState<Row | null>(null);
  const [conversionLevel, setConversionLevel] = useState<Level>("Rojo");
  const [conversionGroupId, setConversionGroupId] = useState("");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const result = await deleteRegistrationAction(target.id);
      if (result.ok) {
        toast.success("Inscripción eliminada");
        router.refresh();
      } else {
        toast.error("No se ha podido eliminar", { description: result.error });
      }
    });
  }

  async function updateStatus(row: Row, next: Row["status"]) {
    if (!isAdmin) return;
    startTransition(async () => {
      const basePath = window.location.pathname.replace(/\/$/, "");
      const response = await fetch(`${basePath}/api/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status: next }),
      });
      if (response.ok) {
        toast.success("Estado actualizado");
        router.refresh();
      }
      else toast.error("No se ha podido actualizar");
    });
  }

  function openConversion(row: Row) {
    if (!isAdmin) return;
    const firstAvailable = groups.find((group) => group.enrolled < group.capacity);
    setConversionTarget(row);
    setConversionGroupId("");
    setConversionLevel(firstAvailable?.level ?? "Rojo");
  }

  async function convertToStudent(row: Row) {
    if (!isAdmin || row.studentId) return;
    setConvertingId(row.id);
    startTransition(async () => {
      const result = await convertRegistrationToStudentAction({
        registrationId: row.id,
        level: conversionLevel,
        groupId: conversionGroupId || null,
      });
      setConvertingId(null);
      if (!result.ok) {
        toast.error("No se ha podido crear el alumno", { description: result.error });
        return;
      }
      toast.success("Alumno creado desde la solicitud");
      setConversionTarget(null);
      router.refresh();
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (type !== "all" && row.type !== type) return false;
      if (!q) return true;
      return (
        familyLabel(row).toLowerCase().includes(q) ||
        childLabel(row).toLowerCase().includes(q) ||
        row.phone.includes(q)
      );
    });
  }, [rows, query, status, type]);

  function exportCsv() {
    if (!isAdmin) return;
    const out = [
      [
        "Familia",
        "Niño",
        "Apellidos",
        "Edad",
        "Nacimiento",
        "Género",
        "Programa",
        "Curso",
        "Idioma enlace",
        "Teléfono",
        "Email",
        "Familiares",
        "Alergias",
        "Enfermedades",
        "Lesiones",
        "Preferencias días",
        "Preferencias horario",
        "Notas horario",
        "Firmante",
        "Consentimiento multimedia",
        "Términos aceptados",
        "Origen",
        "Estado enlace",
        "Solicitada",
        "Estado",
      ],
      ...filtered.map((r) => [
        familyLabel(r),
        childLabel(r),
        displayValue(r.childLastName),
        r.childAge ? String(r.childAge) : "",
        displayValue(r.childBirthDate),
        displayValue(r.childGender),
        typeLabel[r.type],
        displayValue(r.courseSlug),
        localeLabel[r.inviteLocale],
        r.phone,
        displayValue(r.email),
        relationSummary(r.familyRelations),
        displayValue(r.allergies),
        displayValue(r.illnesses),
        displayValue(r.injuries),
        displayValue(r.preferredDays),
        displayValue(r.preferredTimeBlocks),
        displayValue(r.schedulingNotes),
        displayValue([r.signerFirstName, r.signerLastName].filter(Boolean).join(" ")),
        displayValue(r.consentMultimedia),
        dateTimeLabel(r.termsAcceptedAt),
        sourceLabel[r.registrationSource],
        r.inviteStatus ? inviteStatusLabel[r.inviteStatus] : "Sin enlace",
        r.submittedAt,
        statusLabel[r.status],
      ]),
    ];
    const csv = out
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscripciones-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyInvite(row: Row) {
    if (!row.inviteToken) return;
    const url = `${window.location.origin}/${row.inviteLocale}/inscripcion/${row.inviteToken}`;
    await navigator.clipboard.writeText(url);
    const result = await markRegistrationInviteSentAction(row.id);
    if (result.ok) {
      toast.success("Enlace copiado");
    } else {
      toast.warning("Enlace copiado, pero no se marcó como enviado", {
        description: result.error,
      });
    }
  }

  const columns: Column<Row>[] = [
    {
      key: "family",
      label: "Familia · Niño",
      width: "minmax(220px, 2fr)",
      sortAccessor: (r) => familyLabel(r),
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{familyLabel(r)}</p>
          <p className="truncate text-[11.5px] text-[var(--muted)]">
            {childDetail(r)}
          </p>
        </div>
      ),
    },
    {
      key: "program",
      label: "Programa",
      width: "150px",
      sortAccessor: (r) => r.type,
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={typeTone[r.type]}>{typeLabel[r.type]}</Badge>
          <span className="text-[11px] font-medium text-[var(--muted)]">
            {localeLabel[r.inviteLocale]} · {sourceLabel[r.registrationSource]}
          </span>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Contacto",
      width: "140px",
      hideOnMobile: true,
      sortAccessor: (r) => r.phone,
      render: (r) => (
        <span className="text-[12.5px] text-[var(--muted)]">{phoneLabel(r)}</span>
      ),
    },
    {
      key: "submitted",
      label: "Solicitada",
      width: "120px",
      hideOnMobile: true,
      sortAccessor: (r) => r.submittedAt,
      render: (r) => (
        <span className="text-[12.5px] text-[var(--muted)]">{formatShortDate(r.submittedAt)}</span>
      ),
    },
    {
      key: "status",
      label: "Estado",
      width: "160px",
      sortAccessor: (r) => r.status,
      render: (r) => {
        const tone = statusTone[r.status];
        if (!isAdmin) return <Badge tone={tone}>{statusLabel[r.status]}</Badge>;
        return (
          <Select
            value={r.status}
            disabled={pending || Boolean(r.studentId)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateStatus(r, e.target.value as Row["status"])}
            className={`h-7 max-w-[140px] text-[11.5px] font-semibold ${
              tone === "success"
                ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                : tone === "info"
                  ? "border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]"
                  : "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]"
            }`}
          >
            <option value="pendiente">Pendiente</option>
            <option value="confirmada">Confirmada</option>
            {r.studentId && <option value="convertida">Convertida</option>}
          </Select>
        );
      },
    },
    {
      key: "actions",
      label: "",
      width: "auto",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetails(r);
              }}
              className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]"
              title="Ver solicitud completa"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
          {r.inviteToken && r.inviteStatus !== "completed" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                copyInvite(r);
              }}
              className="grid h-7 w-7 place-items-center rounded-full text-[var(--primary)] hover:bg-[var(--primary-soft)]"
              title="Copiar enlace de ficha"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
          {isAdmin && r.phone && (
            <>
              <a
                href={`tel:${r.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                title="Llamar"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            </>
          )}
          {isAdmin && canCreateStudent(r) && (
            <button
              type="button"
              disabled={convertingId === r.id}
              onClick={(e) => {
                e.stopPropagation();
                openConversion(r);
              }}
              className="grid h-7 w-7 place-items-center rounded-full text-[var(--success)] hover:bg-[var(--success-soft)] disabled:opacity-50"
              title="Crear alumno desde solicitud"
            >
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          )}
          {isAdmin && r.studentId && (
            <Link
              href={`/admin/students/${r.studentId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[12px] font-semibold text-[var(--primary)] hover:underline"
            >
              Ver alumno
            </Link>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleting(r);
              }}
              className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              title="Eliminar inscripción"
              aria-label="Eliminar inscripción"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-2">
        <Input
          className="h-10"
          placeholder={isAdmin ? "Buscar familia, niño o teléfono…" : "Buscar ficha o programa…"}
          iconLeft={<Search className="h-3.5 w-3.5" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
          <FilterChip
            label="Programa"
            value={type === "all" ? undefined : typeLabel[type]}
            onClick={() => {
              const order = ["all", "escuela", "campus", "ambos"] as const;
              const idx = order.indexOf(type);
              setType(order[(idx + 1) % order.length] as typeof type);
            }}
            onClear={() => setType("all")}
          />
          <FilterChip
            label="Estado"
            value={status === "all" ? undefined : statusLabel[status]}
            onClick={() => {
              const order = ["all", "pendiente", "confirmada", "convertida"] as const;
              const idx = order.indexOf(status);
              setStatus(order[(idx + 1) % order.length] as typeof status);
            }}
            onClear={() => setStatus("all")}
          />
          <div className="flex-1" />
          <RegistrationInviteDialog courses={courses} triggerLabel="Crear ficha" triggerSize="sm" />
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Download className="h-3.5 w-3.5" />}
              onClick={exportCsv}
              className="hidden sm:inline-flex"
            >
              Exportar
            </Button>
          )}
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        defaultSort={{ key: "submitted", direction: "desc" }}
        defaultPageSize={25}
        isActiveRow={(r) => r.status === "pendiente"}
        mobileCard={(r) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{familyLabel(r)}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">
                  {childDetail(r)} · {formatShortDate(r.submittedAt)}
                </p>
              </div>
              <Badge tone={typeTone[r.type]}>{typeLabel[r.type]}</Badge>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              {isAdmin && r.phone && (
                <>
                  <a
                    href={`tel:${r.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="grid h-9 w-9 place-items-center rounded-md bg-[var(--surface-muted)] text-[var(--primary)] active:bg-[var(--primary-soft)]"
                    aria-label="Llamar"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                </>
              )}
              {r.inviteToken && r.inviteStatus !== "completed" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyInvite(r);
                  }}
                  className="grid h-9 w-9 place-items-center rounded-md bg-[var(--surface-muted)] text-[var(--primary)] active:bg-[var(--primary-soft)]"
                  aria-label="Copiar enlace de ficha"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                </button>
              )}
              {isAdmin && canCreateStudent(r) && (
                <button
                  type="button"
                  disabled={convertingId === r.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    openConversion(r);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--success-soft)] px-3 text-[12px] font-semibold text-[var(--success)] disabled:opacity-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Crear alumno
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetails(r);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--surface-muted)] px-3 text-[12px] font-semibold text-[var(--primary)] active:bg-[var(--primary-soft)]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver solicitud
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(r);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--surface-muted)] px-3 text-[12px] font-semibold text-[var(--danger)] active:bg-[var(--danger-soft)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </button>
              )}
              <div className="flex-1" />
              {isAdmin ? (
                <Select
                  value={r.status}
                  disabled={pending || Boolean(r.studentId)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateStatus(r, e.target.value as Row["status"])}
                  className="h-9 max-w-[150px] text-[12px] font-semibold"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="confirmada">Confirmada</option>
                  {r.studentId && <option value="convertida">Convertida</option>}
                </Select>
              ) : (
                <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
              )}
            </div>
            {isAdmin && r.studentId && (
              <Link
                href={`/admin/students/${r.studentId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[12px] font-semibold text-[var(--primary)]"
              >
                Ver ficha del alumno →
              </Link>
            )}
          </div>
        )}
        emptyState={
          <EmptyState
            title={rows.length === 0 ? "Sin inscripciones" : "Sin resultados"}
            description={
              rows.length === 0
                ? "Crea una ficha desde el panel y comparte el enlace por WhatsApp."
                : "Ajusta filtros o búsqueda."
            }
          />
        }
      />
      <RegistrationDetailsModal row={details} onClose={() => setDetails(null)} />
      <ConversionModal
        row={conversionTarget}
        groups={groups}
        level={conversionLevel}
        groupId={conversionGroupId}
        pending={convertingId === conversionTarget?.id}
        onLevelChange={(level) => {
          setConversionLevel(level);
          setConversionGroupId("");
        }}
        onGroupChange={(groupId) => {
          const group = groups.find((item) => item.id === groupId);
          setConversionGroupId(groupId);
          if (group) setConversionLevel(group.level);
        }}
        onClose={() => setConversionTarget(null)}
        onConfirm={() => {
          if (conversionTarget) convertToStudent(conversionTarget);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar inscripción?"
        description={
          deleting
            ? `Vas a eliminar la inscripción de ${childLabel(deleting)}. No se borra el alumno ni el contacto ya creados. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Sí, eliminar"
      />
    </>
  );
}

function ConversionModal({
  row,
  groups,
  level,
  groupId,
  pending,
  onLevelChange,
  onGroupChange,
  onClose,
  onConfirm,
}: {
  row: Row | null;
  groups: GroupOption[];
  level: Level;
  groupId: string;
  pending: boolean;
  onLevelChange: (level: Level) => void;
  onGroupChange: (groupId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const groupsForLevel = groups.filter((group) => group.level === level);
  const selectedGroup = groups.find((group) => group.id === groupId) ?? null;
  const fullGroups = groupsForLevel.filter((group) => group.enrolled >= group.capacity).length;

  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      title="Crear alumno"
      description={row ? `${childLabel(row)} · ${familyLabel(row)}` : undefined}
      icon={<UserPlus className="h-5 w-5" />}
      tone="success"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            iconLeft={<UserPlus className="h-4 w-4" />}
            loading={pending}
            onClick={onConfirm}
          >
            Crear alumno
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success" iconLeft={<CheckCircle2 className="h-3 w-3" />}>
              Solicitud completa
            </Badge>
            <Badge tone={row?.type ? typeTone[row.type] : "neutral"}>
              {row?.type ? typeLabel[row.type] : "Inscripción"}
            </Badge>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Se creará la ficha del alumno con sus tutores, salud, consentimientos y
            preferencias. Elige el nivel operativo y, si ya lo sabes, el grupo.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nivel inicial" hint="Si eliges un grupo, el nivel se ajusta automáticamente al nivel del grupo.">
            <Select
              value={level}
              disabled={pending}
              onChange={(event) => onLevelChange(event.target.value as Level)}
            >
              {levelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Grupo" hint="Puedes dejarlo sin grupo y asignarlo más tarde desde Alumnos.">
            <Select
              value={groupId}
              disabled={pending}
              onChange={(event) => onGroupChange(event.target.value)}
            >
              <option value="">Sin grupo todavía</option>
              {groupsForLevel.map((group) => (
                <option
                  key={group.id}
                  value={group.id}
                  disabled={group.enrolled >= group.capacity}
                >
                  {group.name} · {group.enrolled}/{group.capacity}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {groupsForLevel.length === 0 ? (
          <div className="flex gap-2 rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] p-3 text-sm font-medium text-[var(--warning)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            No hay grupos creados para nivel {level}. Puedes crear el alumno sin grupo.
          </div>
        ) : (
          <ul className="grid gap-2">
            {groupsForLevel.map((group) => {
              const full = group.enrolled >= group.capacity;
              const active = group.id === groupId;
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    disabled={pending || full}
                    onClick={() => onGroupChange(group.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-55 ${
                      active
                        ? "border-[var(--success)] bg-[var(--success-soft)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{group.name}</span>
                      <span className="block truncate text-[12px] text-[var(--muted)]">
                        {groupScheduleLabel(group)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={full ? "danger" : active ? "success" : "neutral"}>
                        {group.enrolled}/{group.capacity}
                      </Badge>
                      {active && <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selectedGroup ? (
          <div className="flex items-start gap-2 rounded-xl border border-[var(--success)]/25 bg-[var(--success-soft)] p-3 text-sm text-[var(--success)]">
            <Users className="mt-0.5 h-4 w-4 shrink-0" />
            El alumno se creará en {selectedGroup.name} con nivel {selectedGroup.level}.
          </div>
        ) : fullGroups > 0 ? (
          <p className="text-[12px] font-medium text-[var(--muted)]">
            {fullGroups} grupo{fullGroups === 1 ? "" : "s"} de este nivel están completos y quedan bloqueados.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function RegistrationDetailsModal({ row, onClose }: { row: Row | null; onClose: () => void }) {
  if (!row) return null;
  const inviteUrl = row.inviteToken
    ? `/${row.inviteLocale}/inscripcion/${row.inviteToken}`
    : "Sin enlace";
  const signer = [row.signerFirstName, row.signerLastName].filter(Boolean).join(" ");

  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      title="Solicitud completa"
      description={`${familyLabel(row)} · ${childLabel(row)}`}
      icon={<ClipboardList className="h-5 w-5" />}
      tone="primary"
      size="xl"
    >
      <div className="grid gap-4">
        <DetailsSection title="Resumen" icon={<FileText className="h-4 w-4" />}>
          <DetailItem label="Programa" value={typeLabel[row.type]} />
          <DetailItem label="Estado" value={statusLabel[row.status]} />
          <DetailItem label="Curso / campus" value={displayValue(row.courseSlug)} />
          <DetailItem label="Origen" value={sourceLabel[row.registrationSource]} />
          <DetailItem label="Idioma del enlace" value={localeLabel[row.inviteLocale]} />
          <DetailItem label="Enlace" value={inviteUrl} mono />
          <DetailItem
            label="Estado enlace"
            value={row.inviteStatus ? inviteStatusLabel[row.inviteStatus] : "Sin enlace"}
          />
          <DetailItem label="Creado" value={dateTimeLabel(row.inviteCreatedAt)} />
          <DetailItem label="Caduca" value={dateTimeLabel(row.inviteExpiresAt)} />
          <DetailItem label="Completado" value={dateTimeLabel(row.inviteCompletedAt)} />
        </DetailsSection>

        <DetailsSection title="Familia" icon={<UserRound className="h-4 w-4" />}>
          <DetailItem label="Nombre familiar" value={familyLabel(row)} />
          <DetailItem label="Teléfono" value={phoneLabel(row)} />
          <DetailItem label="Email" value={displayValue(row.email)} />
          <DetailItem label="Familiares autorizados" value={relationSummary(row.familyRelations)} wide />
        </DetailsSection>

        <DetailsSection title="Alumno" icon={<CalendarDays className="h-4 w-4" />}>
          <DetailItem label="Nombre" value={childLabel(row)} />
          <DetailItem label="Apellidos" value={displayValue(row.childLastName)} />
          <DetailItem label="Edad" value={row.childAge ? `${row.childAge} años` : "Pendiente"} />
          <DetailItem label="Nacimiento" value={row.childBirthDate ? formatLongDate(row.childBirthDate) : "Pendiente"} />
          <DetailItem label="Género" value={displayValue(row.childGender)} />
        </DetailsSection>

        <DetailsSection title="Salud y preferencias" icon={<HeartPulse className="h-4 w-4" />}>
          <DetailItem label="Alergias" value={displayValue(row.allergies)} wide />
          <DetailItem label="Enfermedades" value={displayValue(row.illnesses)} wide />
          <DetailItem label="Lesiones" value={displayValue(row.injuries)} wide />
          <DetailItem label="Días preferidos" value={displayValue(row.preferredDays)} />
          <DetailItem label="Franjas preferidas" value={displayValue(row.preferredTimeBlocks)} />
          <DetailItem label="Notas horario" value={displayValue(row.schedulingNotes)} wide />
        </DetailsSection>

        <DetailsSection title="Consentimientos y notas" icon={<Mail className="h-4 w-4" />}>
          <DetailItem label="Firmante" value={displayValue(signer)} />
          <DetailItem label="Consentimiento multimedia" value={displayValue(row.consentMultimedia)} />
          <DetailItem label="Términos aceptados" value={dateTimeLabel(row.termsAcceptedAt)} />
          <DetailItem label="Notas internas" value={displayValue(row.adminNotes)} wide />
        </DetailsSection>
      </div>
    </Modal>
  );
}

function DetailsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
        {icon}
        {title}
      </h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        {children}
      </dl>
    </section>
  );
}

function DetailItem({
  label,
  value,
  wide = false,
  mono = false,
}: {
  label: string;
  value: unknown;
  wide?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-sm text-[var(--foreground)] ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {displayValue(value)}
      </dd>
    </div>
  );
}
