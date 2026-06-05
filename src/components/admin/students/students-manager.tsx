"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  GraduationCap,
  List,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { type ReactNode, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { StudentForm } from "@/components/admin/students/student-form";
import { LevelDonutChart } from "@/components/charts/level-donut-chart";
import {
  deleteStudentAction,
  toggleStudentActive,
  type StudentInput,
} from "@/lib/admin/actions/students";
import { formatPhoneEs, normalizeWhatsappNumber } from "@/lib/format";
import { avatarUrl, buildAvatarSeed } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  address: string;
  level: "Rojo" | "Naranja" | "Verde" | "Amarillo";
  dominantHand: "Derecha" | "Izquierda" | "Ambidiestro";
  groupId: string | null;
  professorId: string | null;
  medicalInfo: string;
  imageConsent: boolean;
  coachNotes: string;
  commLocale: "es" | "en";
  active: boolean;
};

type Guardian = {
  id: string;
  studentId: string;
  fullName: string;
  phone: string;
  email: string;
  relationship: string;
};

type Group = { id: string; name: string; level: Student["level"]; capacity?: number };
type Teacher = { id: string; fullName: string };

type GroupLoad = {
  id: string;
  name: string;
  level: Student["level"];
  enrolled: number;
  capacity: number;
  load: number;
};

type CoachLoad = {
  id: string;
  name: string;
  count: number;
};

const levelTone: Record<Student["level"], "danger" | "warning" | "primary" | "accent"> = {
  Rojo: "danger",
  Naranja: "warning",
  Verde: "primary",
  Amarillo: "accent",
};

function studentAvatar(s: { id: string; firstName: string; lastName: string }) {
  return avatarUrl(buildAvatarSeed(s.id, s.firstName, s.lastName), "pixel-art");
}

const tabItems: TabItem[] = [
  { value: "list", label: "Lista", icon: <List className="h-4 w-4" /> },
  { value: "stats", label: "Estadísticas", icon: <BarChart3 className="h-4 w-4" /> },
];

const LEVEL_ORDER: Student["level"][] = ["Rojo", "Naranja", "Verde", "Amarillo"];

const levelColors: Record<Student["level"], string> = {
  Rojo: "#d94a45",
  Naranja: "#e6922e",
  Verde: "#1f6f43",
  Amarillo: "#d9a417",
};

function validWhatsapp(phone?: string) {
  const normalized = normalizeWhatsappNumber(phone ?? "");
  return /^\d{8,15}$/.test(normalized);
}

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function StudentsManager({
  students,
  guardians,
  groups,
  teachers,
}: {
  students: Student[];
  guardians: Guardian[];
  groups: Group[];
  teachers: Teacher[];
}) {
  const [tab, setTab] = useState<string>("list");
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [teacherFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "archived">("active");
  const [editing, setEditing] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [, startTransition] = useTransition();

  const guardianByStudent = useMemo(() => {
    const map = new Map<string, Guardian>();
    for (const guardian of guardians) map.set(guardian.studentId, guardian);
    return map;
  }, [guardians]);

  const groupById = useMemo(() => {
    const map = new Map<string, Group>();
    for (const group of groups) map.set(group.id, group);
    return map;
  }, [groups]);

  const teacherById = useMemo(() => {
    const map = new Map<string, Teacher>();
    for (const teacher of teachers) map.set(teacher.id, teacher);
    return map;
  }, [teachers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((student) => {
      if (activeFilter === "active" && !student.active) return false;
      if (activeFilter === "archived" && student.active) return false;
      if (levelFilter && student.level !== levelFilter) return false;
      if (groupFilter && student.groupId !== groupFilter) return false;
      if (teacherFilter && student.professorId !== teacherFilter) return false;
      if (!q) return true;
      const guardian = guardianByStudent.get(student.id);
      return (
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(q) ||
        (guardian?.fullName.toLowerCase().includes(q) ?? false) ||
        (guardian?.phone.includes(q) ?? false)
      );
    });
  }, [students, query, activeFilter, levelFilter, groupFilter, teacherFilter, guardianByStudent]);

  const stats = useMemo(() => {
    const activeStudents = students.filter((student) => student.active);
    const archivedCount = students.length - activeStudents.length;
    const withGuardian = activeStudents.filter((student) => guardianByStudent.has(student.id)).length;
    const whatsappReady = activeStudents.filter((student) =>
      validWhatsapp(guardianByStudent.get(student.id)?.phone),
    ).length;
    const withImageConsent = activeStudents.filter((student) => student.imageConsent).length;
    const withMedicalInfo = activeStudents.filter((student) => student.medicalInfo.trim().length > 0).length;
    const unassigned = activeStudents.filter((student) => !student.groupId);
    const withoutCoach = activeStudents.filter((student) => !student.professorId);

    const levelData = LEVEL_ORDER.map((level) => ({
      level,
      count: activeStudents.filter((student) => student.level === level).length,
      color: levelColors[level],
    }));

    const groupLoad = groups
      .map((group) => {
        const enrolled = activeStudents.filter((student) => student.groupId === group.id).length;
        const capacity = group.capacity ?? 0;
        return {
          id: group.id,
          name: group.name,
          level: group.level,
          enrolled,
          capacity,
          load: capacity > 0 ? enrolled / capacity : 0,
        };
      })
      .sort((a, b) => b.load - a.load || b.enrolled - a.enrolled || a.name.localeCompare(b.name));

    const coachLoad = [
      ...teachers.map((teacher) => ({
        id: teacher.id,
        name: teacher.fullName,
        count: activeStudents.filter((student) => student.professorId === teacher.id).length,
      })),
      {
        id: "unassigned",
        name: "Sin entrenador",
        count: withoutCoach.length,
      },
    ]
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      activeStudents,
      archivedCount,
      withGuardian,
      whatsappReady,
      withImageConsent,
      withMedicalInfo,
      unassigned,
      withoutCoach,
      levelData,
      groupLoad,
      coachLoad,
    };
  }, [students, groups, teachers, guardianByStudent]);

  function handleToggleActive(student: Student) {
    startTransition(async () => {
      const result = await toggleStudentActive(student.id, !student.active);
      if (result.ok) toast.success(student.active ? "Alumno archivado" : "Alumno reactivado");
      else toast.error("No se ha podido actualizar", { description: result.error });
    });
  }

  function handleDelete(student: Student) {
    setDeleting(student);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const result = await deleteStudentAction(target.id);
      if (result.ok) toast.success("Alumno eliminado");
      else toast.error("No se ha podido eliminar", { description: result.error });
    });
  }

  function exportCsv() {
    const rows = [
      ["Nombre", "Apellido", "Nivel", "Grupo", "Tutor", "Teléfono", "Email", "Activo"],
      ...filtered.map((s) => {
        const g = guardianByStudent.get(s.id);
        return [
          s.firstName,
          s.lastName,
          s.level,
          s.groupId ? (groupById.get(s.groupId)?.name ?? "") : "",
          g?.fullName ?? "",
          g?.phone ?? "",
          g?.email ?? "",
          s.active ? "Sí" : "No",
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alumnos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: Column<Student>[] = [
    {
      key: "name",
      label: "Alumno",
      width: "minmax(220px, 2fr)",
      sortAccessor: (s) => `${s.firstName} ${s.lastName}`,
      render: (s) => {
        const group = s.groupId ? groupById.get(s.groupId) : null;
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/admin/students/${s.id}`}
              onClick={(e) => e.stopPropagation()}
              className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)] transition-all hover:ring-2 hover:ring-[var(--accent)]"
              aria-label={`Ver ficha de ${s.firstName} ${s.lastName}`}
            >
              <Image
                src={studentAvatar(s)}
                alt=""
                fill
                sizes="40px"
                unoptimized
                className="object-cover"
              />
            </Link>
            <div className="min-w-0">
              <Link
                href={`/admin/students/${s.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 hover:text-[var(--primary)]"
              >
                <span className="truncate text-[13.5px] font-semibold text-foreground">
                  {s.firstName} {s.lastName}
                </span>
                {!s.active && <Badge tone="neutral">Archivado</Badge>}
              </Link>
              <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">
                {group ? group.name : "Sin grupo"}
                {s.professorId
                  ? ` · ${teacherById.get(s.professorId)?.fullName ?? ""}`
                  : ""}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "level",
      label: "Nivel",
      width: "110px",
      sortAccessor: (s) => ["Rojo", "Naranja", "Verde", "Amarillo"].indexOf(s.level),
      render: (s) => <Badge tone={levelTone[s.level]}>{s.level}</Badge>,
    },
    {
      key: "guardian",
      label: "Tutor",
      width: "minmax(180px, 1.4fr)",
      hideOnMobile: true,
      sortAccessor: (s) => guardianByStudent.get(s.id)?.fullName ?? "",
      render: (s) => {
        const g = guardianByStudent.get(s.id);
        if (!g) return <span className="text-xs text-[var(--muted)]">—</span>;
        return (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground">{g.fullName}</p>
            <a
              href={`tel:${g.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-[var(--muted)] hover:text-[var(--primary)]"
            >
              <Phone className="h-3 w-3" />
              {formatPhoneEs(g.phone)}
            </a>
          </div>
        );
      },
    },
    {
      key: "contact",
      label: "Contacto",
      width: "100px",
      hideOnMobile: true,
      render: (s) => {
        const g = guardianByStudent.get(s.id);
        if (!g) return null;
        return (
          <div className="flex items-center gap-1">
            <a
              href={`tel:${g.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
              title="Llamar"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "",
      width: "44px",
      align: "right",
      render: (s) => (
        <ActionsMenu
          studentId={s.id}
          isActive={s.active}
          onEdit={() => setEditing(s)}
          onToggleActive={() => handleToggleActive(s)}
          onDelete={() => handleDelete(s)}
        />
      ),
    },
  ];

  return (
    <>
      {/* ── Tabs ────────────────────────────────────── */}
      <Tabs items={tabItems} value={tab} onChange={setTab} />

      {tab === "list" && (
        <>
          {/* ── Filter row — mobile-first ────────────────── */}
          <div className="flex flex-col gap-2">
            {/* Row 1: search full-width on mobile + main CTA */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  className="h-10"
                  placeholder="Buscar alumno o tutor…"
                  iconLeft={<Search className="h-3.5 w-3.5" />}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button
                variant="accent"
                size="sm"
                iconLeft={<Plus className="h-4 w-4" />}
                onClick={() => setCreating(true)}
                className="h-10"
              >
                <span className="hidden sm:inline">Nuevo alumno</span>
              </Button>
            </div>

            {/* Row 2: filter chips — horizontal scroll on mobile */}
            <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
              <FilterChip
                label="Nivel"
                value={levelFilter || undefined}
                onClick={() => {
                  const order = ["", "Rojo", "Naranja", "Verde", "Amarillo"];
                  const idx = order.indexOf(levelFilter);
                  setLevelFilter(order[(idx + 1) % order.length]);
                }}
                onClear={() => setLevelFilter("")}
              />
              <div className="hidden sm:block">
                <Select
                  className="h-9 text-[13px]"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                >
                  <option value="">Todos los grupos</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </div>
              <FilterChip
                label="Estado"
                value={
                  activeFilter === "active"
                    ? "Activos"
                    : activeFilter === "archived"
                      ? "Archivados"
                      : "Todos"
                }
                active
                onClick={() => {
                  const order = ["active", "archived", "all"] as const;
                  const idx = order.indexOf(activeFilter);
                  setActiveFilter(order[(idx + 1) % order.length]);
                }}
              />
              <div className="flex-1" />
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Download className="h-3.5 w-3.5" />}
                onClick={exportCsv}
                className="hidden sm:inline-flex"
              >
                Exportar
              </Button>
            </div>
          </div>

          {/* ── Table ───────────────────────────────── */}
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(s) => s.id}
            defaultSort={{ key: "name", direction: "asc" }}
            defaultPageSize={25}
            enableColumnToggle
            isActiveRow={(s) => !s.active}
            mobileCard={(s) => {
              const guardian = guardianByStudent.get(s.id);
              const group = s.groupId ? groupById.get(s.groupId) : null;
              return (
                <div className="flex items-start gap-3">
                  <Link
                    href={`/admin/students/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]"
                  >
                    <Image
                      src={studentAvatar(s)}
                      alt=""
                      fill
                      sizes="48px"
                      unoptimized
                      className="object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/students/${s.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2"
                    >
                      <span className="truncate text-[14px] font-semibold">
                        {s.firstName} {s.lastName}
                      </span>
                      {!s.active && <Badge tone="neutral">Archivado</Badge>}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--muted)]">
                      <Badge tone={levelTone[s.level]}>{s.level}</Badge>
                      <span>{group ? group.name : "Sin grupo"}</span>
                    </div>
                    {guardian && (
                      <div className="mt-2 flex items-center gap-2 text-[12px]">
                        <span className="truncate text-[var(--muted)]">
                          {guardian.fullName}
                        </span>
                        <a
                          href={`tel:${guardian.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface-muted)] text-[var(--primary)] active:bg-[var(--primary-soft)]"
                          aria-label="Llamar"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                  <ActionsMenu
                    studentId={s.id}
                    isActive={s.active}
                    onEdit={() => setEditing(s)}
                    onToggleActive={() => handleToggleActive(s)}
                    onDelete={() => handleDelete(s)}
                  />
                </div>
              );
            }}
            emptyState={
              <EmptyState
                icon={<UserRound className="h-5 w-5" />}
                title={
                  students.length === 0
                    ? "Sin alumnos todavía"
                    : "No hay alumnos con esos filtros"
                }
                description={
                  students.length === 0
                    ? "Da de alta a tu primer alumno para empezar a registrar asistencias, pagos y progreso."
                    : "Ajusta la búsqueda o cambia los filtros."
                }
                action={
                  students.length === 0 && (
                    <Button
                      variant="accent"
                      iconLeft={<Plus className="h-4 w-4" />}
                      onClick={() => setCreating(true)}
                    >
                      Crear primer alumno
                    </Button>
                  )
                }
              />
            }
          />
        </>
      )}

      {tab === "stats" && (
        <StudentStatsPanel
          totalStudents={students.length}
          activeCount={stats.activeStudents.length}
          archivedCount={stats.archivedCount}
          guardianCount={stats.withGuardian}
          whatsappReady={stats.whatsappReady}
          imageConsentCount={stats.withImageConsent}
          medicalInfoCount={stats.withMedicalInfo}
          unassignedStudents={stats.unassigned}
          withoutCoachCount={stats.withoutCoach.length}
          levelData={stats.levelData}
          groupLoad={stats.groupLoad}
          coachLoad={stats.coachLoad}
        />
      )}

      {/* Confirm dialog for delete */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar alumno?"
        description={
          deleting
            ? `Vas a eliminar a ${deleting.firstName} ${deleting.lastName}. También se borrarán su tutor, pagos y asistencias. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Sí, eliminar"
      />

      {/* Modals */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Dar de alta un alumno"
        description="Registra al alumno con sus datos básicos y un tutor responsable."
        size="lg"
      >
        <StudentForm
          groups={groups}
          teachers={teachers}
          onCancel={() => setCreating(false)}
          onSaved={() => setCreating(false)}
          mode="create"
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Editar ${editing.firstName} ${editing.lastName}` : ""}
        size="lg"
      >
        {editing && (
          <StudentForm
            groups={groups}
            teachers={teachers}
            mode="edit"
            studentId={editing.id}
            guardianId={guardianByStudent.get(editing.id)?.id ?? null}
            initial={toFormValues(editing, guardianByStudent.get(editing.id))}
            onCancel={() => setEditing(null)}
            onSaved={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}

function toFormValues(student: Student, guardian?: Guardian): StudentInput {
  return {
    firstName: student.firstName,
    lastName: student.lastName,
    birthDate: student.birthDate,
    address: student.address,
    level: student.level,
    dominantHand: student.dominantHand,
    groupId: student.groupId,
    professorId: student.professorId,
    medicalInfo: student.medicalInfo,
    imageConsent: student.imageConsent,
    coachNotes: student.coachNotes,
    guardianName: guardian?.fullName ?? "",
    guardianPhone: guardian?.phone ?? "",
    guardianEmail: guardian?.email ?? "",
    relationship: guardian?.relationship ?? "Madre",
    commLocale: student.commLocale ?? "es",
  };
}

function StudentStatsPanel({
  totalStudents,
  activeCount,
  archivedCount,
  guardianCount,
  whatsappReady,
  imageConsentCount,
  medicalInfoCount,
  unassignedStudents,
  withoutCoachCount,
  levelData,
  groupLoad,
  coachLoad,
}: {
  totalStudents: number;
  activeCount: number;
  archivedCount: number;
  guardianCount: number;
  whatsappReady: number;
  imageConsentCount: number;
  medicalInfoCount: number;
  unassignedStudents: Student[];
  withoutCoachCount: number;
  levelData: Array<{ level: Student["level"]; count: number; color: string }>;
  groupLoad: GroupLoad[];
  coachLoad: CoachLoad[];
}) {
  const unassignedPreview = unassignedStudents.slice(0, 5);
  const readyPercent = pct(whatsappReady, activeCount);
  const guardianPercent = pct(guardianCount, activeCount);
  const consentPercent = pct(imageConsentCount, activeCount);
  const medicalPercent = pct(medicalInfoCount, activeCount);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Alumnos activos"
          value={String(activeCount)}
          detail={`${totalStudents} en total · ${archivedCount} archivados`}
          tone="primary"
        />
        <StatCard
          icon={<Phone className="h-4 w-4" />}
          label="Teléfono válido"
          value={activeCount > 0 ? `${whatsappReady}/${activeCount}` : "0"}
          detail={activeCount > 0 ? `${readyPercent}% con teléfono válido` : "Sin alumnos activos"}
          tone={readyPercent === 100 ? "success" : "warning"}
        />
        <StatCard
          icon={<GraduationCap className="h-4 w-4" />}
          label="Sin grupo"
          value={String(unassignedStudents.length)}
          detail={
            unassignedStudents.length === 0
              ? "Todos los activos tienen grupo"
              : "Necesitan asignación"
          }
          tone={unassignedStudents.length === 0 ? "success" : "danger"}
        />
        <StatCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Sin entrenador"
          value={String(withoutCoachCount)}
          detail={withoutCoachCount === 0 ? "Carga docente cubierta" : "Revisa responsable"}
          tone={withoutCoachCount === 0 ? "success" : "warning"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Distribución por nivel</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Vista rápida de la escuela activa por color de pelota.
              </p>
            </div>
            <Badge tone="primary">{activeCount} activos</Badge>
          </div>

          {activeCount > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(180px,0.8fr)_minmax(0,1fr)]">
              <LevelDonutChart data={levelData} size={190} />
              <div className="grid content-center gap-2">
                {levelData.map((item) => (
                  <LevelRow
                    key={item.level}
                    label={item.level}
                    color={item.color}
                    count={item.count}
                    total={activeCount}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyStatsMessage text="Todavía no hay alumnos activos para calcular niveles." />
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Calidad de datos</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Campos que afectan a comunicación, permisos y seguimiento.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <HealthMetric
              label="Tutor registrado"
              value={guardianPercent}
              detail={activeCount > 0 ? `${guardianCount}/${activeCount}` : "Sin activos"}
            />
            <HealthMetric
              label="Teléfono móvil válido"
              value={readyPercent}
              detail={activeCount > 0 ? `${whatsappReady}/${activeCount}` : "Sin activos"}
            />
            <HealthMetric
              label="Consentimiento de imagen"
              value={consentPercent}
              detail={activeCount > 0 ? `${imageConsentCount}/${activeCount}` : "Sin activos"}
            />
            <HealthMetric
              label="Info médica anotada"
              value={medicalPercent}
              detail={activeCount > 0 ? `${medicalInfoCount}/${activeCount}` : "Sin activos"}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
          <h3 className="text-sm font-semibold text-foreground">Ocupación de grupos</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Prioriza ajustes cuando un grupo se acerca al aforo.
          </p>
          <div className="mt-4 space-y-3">
            {groupLoad.length > 0 ? (
              groupLoad.slice(0, 8).map((group) => (
                <GroupLoadRow key={group.id} group={group} />
              ))
            ) : (
              <EmptyStatsMessage text="Crea grupos para ver ocupación y aforos." />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
          <h3 className="text-sm font-semibold text-foreground">Carga por entrenador</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Reparte alumnos activos con una lectura rápida de responsables.
          </p>
          <div className="mt-4 space-y-3">
            {coachLoad.length > 0 ? (
              coachLoad.map((coach) => (
                <LoadRow
                  key={coach.id}
                  label={coach.name}
                  value={coach.count}
                  total={Math.max(activeCount, 1)}
                  tone={coach.id === "unassigned" ? "var(--warning)" : "var(--primary)"}
                />
              ))
            ) : (
              <EmptyStatsMessage text="No hay alumnos activos asignados a entrenadores." />
            )}
          </div>
        </div>
      </div>

      {unassignedStudents.length > 0 && (
        <div className="rounded-xl border border-[var(--warning-soft)] bg-[var(--warning-soft)]/45 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--warning)]">
                Alumnos pendientes de grupo
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Así el administrador no pierde fichas que ya están listas para organizar.
              </p>
            </div>
            <Badge tone="warning">{unassignedStudents.length} por colocar</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {unassignedPreview.map((student) => (
              <Link
                key={student.id}
                href={`/admin/students/${student.id}`}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[var(--warning)] hover:text-[var(--warning)]"
              >
                {student.firstName} {student.lastName}
              </Link>
            ))}
            {unassignedStudents.length > unassignedPreview.length && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
                +{unassignedStudents.length - unassignedPreview.length} más
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "primary" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    primary: "bg-[var(--primary-soft)] text-[var(--primary)]",
    success: "bg-[var(--success-soft)] text-[var(--success)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  }[tone];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3">
        <span className={cn("grid h-9 w-9 place-items-center rounded-full", toneClass)}>
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase text-[var(--muted)]">
          {label}
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function LevelRow({
  label,
  color,
  count,
  total,
}: {
  label: Student["level"];
  color: string;
  count: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-[var(--muted)]">
        {count} · {pct(count, total)}%
      </span>
    </div>
  );
}

function HealthMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  const color = value >= 90 ? "var(--success)" : value >= 70 ? "var(--warning)" : "var(--danger)";
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-[var(--muted)]">{detail} · {value}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function GroupLoadRow({ group }: { group: GroupLoad }) {
  const value = pct(group.enrolled, group.capacity);
  const color = value >= 90 ? "var(--danger)" : value >= 75 ? "var(--warning)" : "var(--primary)";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={levelTone[group.level]} className="px-2 py-0.5 text-[11px]">
              {group.level}
            </Badge>
            <span className="text-xs text-[var(--muted)]">
              {group.enrolled}/{group.capacity || "sin aforo"} alumnos
            </span>
          </div>
        </div>
        <span className="text-sm font-semibold text-foreground">{value}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function LoadRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const percent = pct(value, total);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-medium text-foreground">{label}</span>
        <span className="text-[var(--muted)]">{value} alumnos</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, percent)}%`, background: tone }}
        />
      </div>
    </div>
  );
}

function EmptyStatsMessage({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-6 text-center text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}

function ActionsMenu({
  studentId,
  onEdit,
  onToggleActive,
  isActive,
  onDelete,
}: {
  studentId: string;
  onEdit: () => void;
  onToggleActive: () => void;
  isActive: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground",
          open && "bg-[var(--surface-muted)] text-foreground",
        )}
        aria-label="Acciones"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)]"
            onMouseLeave={() => setOpen(false)}
          >
            <Link
              href={`/admin/students/${studentId}`}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] hover:bg-[var(--surface-muted)]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            >
              <Eye className="h-3.5 w-3.5" /> Ver ficha
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] hover:bg-[var(--surface-muted)]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onEdit();
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] hover:bg-[var(--surface-muted)]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onToggleActive();
              }}
            >
              {isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
              {isActive ? "Archivar" : "Reactivar"}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
