"use client";

import { MapPin, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createGroupAction,
  deleteGroupAction,
  updateGroupAction,
  type GroupInput,
} from "@/lib/admin/actions/groups";

type Group = {
  id: string;
  name: string;
  level: "Rojo" | "Naranja" | "Verde" | "Amarillo";
  professorId: string | null;
  professorName: string;
  schedule: string;
  capacity: number;
  location: string;
  weekdays: Array<"L" | "M" | "X" | "J" | "V" | "S" | "D">;
  startTime: string;
  endTime: string;
  enrolled: number;
};

const levelTone: Record<Group["level"], "danger" | "warning" | "primary" | "accent"> = {
  Rojo: "danger",
  Naranja: "warning",
  Verde: "primary",
  Amarillo: "accent",
};

const EMPTY: GroupInput = {
  name: "",
  level: "Verde",
  professorId: null,
  schedule: "Lunes y miércoles, 17:00 - 18:00",
  capacity: 8,
  location: "Pista 1",
  weekdays: [],
  startTime: "",
  endTime: "",
};

const WEEKDAY_BUTTONS: Array<{ value: "L" | "M" | "X" | "J" | "V" | "S" | "D"; label: string }> = [
  { value: "L", label: "L" },
  { value: "M", label: "M" },
  { value: "X", label: "X" },
  { value: "J", label: "J" },
  { value: "V", label: "V" },
  { value: "S", label: "S" },
];

function OccupancyBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = capacity === 0 ? 0 : Math.min(100, Math.round((enrolled / capacity) * 100));
  const tone =
    pct >= 90 ? "var(--danger)" : pct >= 75 ? "var(--warning)" : "var(--primary)";
  return (
    <div className="min-w-[100px]">
      <div className="flex items-center justify-between text-[11.5px] text-[var(--muted)]">
        <span>
          {enrolled}/{capacity}
        </span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}

export function GroupsManager({
  groups,
  teachers,
}: {
  groups: Group[];
  teachers: Array<{ id: string; fullName: string }>;
}) {
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [editing, setEditing] = useState<Group | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Group | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => {
      if (levelFilter && g.level !== levelFilter) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.professorName.toLowerCase().includes(q) ||
        g.schedule.toLowerCase().includes(q) ||
        g.location.toLowerCase().includes(q)
      );
    });
  }, [groups, query, levelFilter]);

  function handleDelete(group: Group) {
    if (group.enrolled > 0) {
      toast.error(`No puedes borrar un grupo con alumnos asignados (${group.enrolled})`);
      return;
    }
    setDeleting(group);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setPendingId(target.id);
    startTransition(async () => {
      const result = await deleteGroupAction(target.id);
      setPendingId(null);
      if (result.ok) toast.success("Grupo eliminado");
      else toast.error("No se ha podido eliminar", { description: result.error });
    });
  }

  const columns: Column<Group>[] = [
    {
      key: "name",
      label: "Grupo · Horario",
      width: "minmax(200px, 2fr)",
      sortAccessor: (g) => g.name,
      render: (g) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{g.name}</p>
          <p className="truncate text-[11.5px] text-[var(--muted)]">{g.schedule}</p>
        </div>
      ),
    },
    {
      key: "level",
      label: "Nivel",
      width: "110px",
      sortAccessor: (g) => ["Rojo", "Naranja", "Verde", "Amarillo"].indexOf(g.level),
      render: (g) => <Badge tone={levelTone[g.level]}>{g.level}</Badge>,
    },
    {
      key: "professor",
      label: "Entrenador",
      width: "minmax(140px, 1fr)",
      hideOnMobile: true,
      sortAccessor: (g) => g.professorName,
      render: (g) => (
        <span className="truncate text-[13px]">{g.professorName || "—"}</span>
      ),
    },
    {
      key: "location",
      label: "Pista",
      width: "100px",
      hideOnMobile: true,
      render: (g) => (
        <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--muted)]">
          <MapPin className="h-3 w-3" />
          {g.location || "—"}
        </span>
      ),
    },
    {
      key: "occupancy",
      label: "Aforo",
      width: "140px",
      sortAccessor: (g) => g.enrolled / Math.max(g.capacity, 1),
      render: (g) => <OccupancyBar enrolled={g.enrolled} capacity={g.capacity} />,
    },
    {
      key: "actions",
      label: "",
      width: "auto",
      align: "right",
      render: (g) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(g);
            }}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-foreground"
            aria-label="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(g);
            }}
            disabled={pendingId === g.id}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-40"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Filter row */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              className="h-10"
              placeholder="Buscar grupo, horario, pista…"
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
            <span className="hidden sm:inline">Nuevo grupo</span>
          </Button>
        </div>
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
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(g) => g.id}
        defaultSort={{ key: "name", direction: "asc" }}
        defaultPageSize={25}
        isActiveRow={(g) => g.enrolled >= g.capacity}
        emptyState={
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={groups.length === 0 ? "No hay grupos todavía" : "Sin resultados"}
            description={
              groups.length === 0
                ? "Crea el primer grupo para empezar a asignar alumnos y planificar clases."
                : "Ajusta los filtros o la búsqueda."
            }
            action={
              groups.length === 0 && (
                <Button
                  variant="accent"
                  iconLeft={<Plus className="h-4 w-4" />}
                  onClick={() => setCreating(true)}
                >
                  Crear grupo
                </Button>
              )
            }
          />
        }
        mobileCard={(g) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{g.name}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">
                  {g.schedule}
                </p>
              </div>
              <Badge tone={levelTone[g.level]}>{g.level}</Badge>
            </div>
            <p className="text-[11.5px] text-[var(--muted)]">
              <MapPin className="mr-1 inline h-3 w-3" />
              {g.location || "Sin pista"} · {g.professorName}
            </p>
            <OccupancyBar enrolled={g.enrolled} capacity={g.capacity} />
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(g);
                }}
                className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted)] active:bg-[var(--surface-muted)]"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(g);
                }}
                disabled={pendingId === g.id}
                className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted)] active:bg-[var(--danger-soft)]"
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Borrar grupo?"
        description={
          deleting
            ? `Vas a borrar el grupo "${deleting.name}". No tiene alumnos asignados, así que es seguro continuar.`
            : ""
        }
        confirmLabel="Sí, borrar"
      />

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Crear grupo"
        size="md"
      >
        <GroupForm
          initial={EMPTY}
          teachers={teachers}
          mode="create"
          onCancel={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Editar ${editing.name}` : ""}
        size="md"
      >
        {editing && (
          <GroupForm
            initial={{
              name: editing.name,
              level: editing.level,
              professorId: editing.professorId,
              schedule: editing.schedule,
              capacity: editing.capacity,
              location: editing.location,
              weekdays: editing.weekdays,
              startTime: editing.startTime,
              endTime: editing.endTime,
            }}
            teachers={teachers}
            mode="edit"
            groupId={editing.id}
            onCancel={() => setEditing(null)}
            onSaved={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}

function GroupForm({
  initial,
  teachers,
  mode,
  groupId,
  onCancel,
  onSaved,
}: {
  initial: GroupInput;
  teachers: Array<{ id: string; fullName: string }>;
  mode: "create" | "edit";
  groupId?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<GroupInput>(initial);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof GroupInput>(key: K, value: GroupInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createGroupAction(values)
          : await updateGroupAction(groupId!, values);
      if (result.ok) {
        toast.success("Grupo guardado");
        onSaved();
      } else {
        toast.error("No se ha podido guardar", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Nombre del grupo" required>
        <Input value={values.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nivel" required>
          <Select value={values.level} onChange={(e) => set("level", e.target.value as GroupInput["level"])}>
            <option value="Rojo">Rojo</option>
            <option value="Naranja">Naranja</option>
            <option value="Verde">Verde</option>
            <option value="Amarillo">Amarillo</option>
          </Select>
        </Field>
        <Field label="Entrenador">
          <Select
            value={values.professorId ?? ""}
            onChange={(e) => set("professorId", e.target.value || null)}
          >
            <option value="">Sin asignar</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Horario (descripción visible)" required>
        <Input value={values.schedule} onChange={(e) => set("schedule", e.target.value)} />
      </Field>

      {/* Estructurado: días + horas, lo usa el planificador */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Días de la semana
        </p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_BUTTONS.map((d) => {
            const active = (values.weekdays ?? []).includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() =>
                  set(
                    "weekdays",
                    active
                      ? (values.weekdays ?? []).filter((w) => w !== d.value)
                      : [...(values.weekdays ?? []), d.value],
                  )
                }
                className={`min-w-[36px] rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--primary)]/40"
                }`}
                aria-pressed={active}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Hora inicio">
            <Input
              type="time"
              value={values.startTime ?? ""}
              onChange={(e) => set("startTime", e.target.value)}
            />
          </Field>
          <Field label="Hora fin">
            <Input
              type="time"
              value={values.endTime ?? ""}
              onChange={(e) => set("endTime", e.target.value)}
            />
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Estos datos los usa el planificador para encajar a los alumnos según sus preferencias.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Aforo máximo" required>
          <Input
            type="number"
            min="1"
            value={values.capacity}
            onChange={(e) => set("capacity", Number(e.target.value))}
          />
        </Field>
        <Field label="Pista / ubicación">
          <Input value={values.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" loading={pending}>
          {mode === "create" ? "Crear grupo" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
