"use client";

import { Eye, EyeOff, Pencil, Plus, Sun, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  createCampusCourseAction,
  deleteCampusCourseAction,
  toggleCampusCoursePublicAction,
  updateCampusCourseAction,
  type CampusCourseInput,
} from "@/lib/admin/actions/campus-courses";

export type CampusCourseRow = {
  id: string;
  slug: string;
  title: string;
  kind: "campus" | "escuela";
  datesLabel: string;
  intro: string;
  imagePath: string | null;
  isPublic: boolean;
  sortOrder: number;
};

const EMPTY: CampusCourseInput = {
  slug: "",
  title: "",
  kind: "campus",
  datesLabel: "",
  intro: "",
  imagePath: "",
  isPublic: true,
  sortOrder: 100,
};

export function CampusCoursesManager({ courses }: { courses: CampusCourseRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CampusCourseRow | null>(null);
  const [deleting, setDeleting] = useState<CampusCourseRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function togglePublic(course: CampusCourseRow) {
    setPendingId(course.id);
    const result = await toggleCampusCoursePublicAction(course.id, !course.isPublic);
    setPendingId(null);
    if (result.ok) {
      toast.success(course.isPublic ? "Convocatoria oculta" : "Convocatoria publicada");
    } else {
      toast.error("No se pudo cambiar", { description: result.error });
    }
  }

  function handleDelete(course: CampusCourseRow) {
    setDeleting(course);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setPendingId(target.id);
    startTransition(async () => {
      const result = await deleteCampusCourseAction(target.id);
      setPendingId(null);
      if (result.ok) toast.success("Convocatoria eliminada");
      else toast.error("No se pudo eliminar", { description: result.error });
    });
  }

  return (
    <Card>
      <CardHeader
        title="Convocatorias publicadas en la web"
        description="Cada fila es una convocatoria que aparece en /campamentos. Puedes despublicarla temporalmente sin borrarla."
        actions={
          <Button
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() => setCreating(true)}
          >
            Nueva convocatoria
          </Button>
        }
      />
      <CardBody>
        {courses.length === 0 ? (
          <EmptyState
            icon={<Sun className="h-5 w-5" />}
            title="Sin convocatorias todavía"
            description="Crea la primera para que aparezca en la web pública."
            action={
              <Button iconLeft={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                Crear convocatoria
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {courses.map((course) => (
              <li
                key={course.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{course.title}</p>
                    {course.isPublic ? (
                      <Badge tone="success">Publicada</Badge>
                    ) : (
                      <Badge tone="neutral">Oculta</Badge>
                    )}
                    {course.kind === "escuela" && <Badge tone="primary">Escuela</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--muted)]">
                    {course.datesLabel || "Sin fechas"} ·{" "}
                    <code className="font-mono text-[11px]">{course.slug}</code>
                    {" · orden "}
                    {course.sortOrder}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => togglePublic(course)}
                    disabled={pendingId === course.id}
                    className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground disabled:opacity-50"
                    title={course.isPublic ? "Ocultar de la web" : "Publicar en la web"}
                  >
                    {course.isPublic ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(course)}
                    className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(course)}
                    disabled={pendingId === course.id}
                    className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-50"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <ConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onConfirm={confirmDelete}
          title="¿Borrar convocatoria?"
          description={
            deleting
              ? `Vas a eliminar "${deleting.title}" definitivamente. Las inscripciones ya hechas no se borran, pero el formulario público dejará de funcionar.`
              : ""
          }
          confirmLabel="Sí, borrar"
        />

        <Modal
          open={creating}
          onClose={() => setCreating(false)}
          title="Nueva convocatoria"
          description="Aparecerá en /campamentos si la marcas como publicada."
          icon={<Sun className="h-5 w-5" />}
          tone="warning"
          size="md"
        >
          <CourseForm
            initial={EMPTY}
            mode="create"
            onCancel={() => setCreating(false)}
            onSaved={() => setCreating(false)}
          />
        </Modal>

        <Modal
          open={!!editing}
          onClose={() => setEditing(null)}
          title={editing ? `Editar ${editing.title}` : ""}
          icon={<Pencil className="h-5 w-5" />}
          tone="primary"
          size="md"
        >
          {editing && (
            <CourseForm
              initial={{
                slug: editing.slug,
                title: editing.title,
                kind: editing.kind,
                datesLabel: editing.datesLabel,
                intro: editing.intro,
                imagePath: editing.imagePath ?? "",
                isPublic: editing.isPublic,
                sortOrder: editing.sortOrder,
              }}
              mode="edit"
              courseId={editing.id}
              onCancel={() => setEditing(null)}
              onSaved={() => setEditing(null)}
            />
          )}
        </Modal>
      </CardBody>
    </Card>
  );
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function CourseForm({
  initial,
  mode,
  courseId,
  onCancel,
  onSaved,
}: {
  initial: CampusCourseInput;
  mode: "create" | "edit";
  courseId?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<CampusCourseInput>(initial);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof CampusCourseInput>(key: K, value: CampusCourseInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: CampusCourseInput = {
      ...values,
      slug: values.slug?.trim() || slugify(values.title ?? ""),
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCampusCourseAction(payload)
          : await updateCampusCourseAction(courseId!, payload);
      if (result.ok) {
        toast.success(mode === "create" ? "Convocatoria creada" : "Cambios guardados");
        onSaved();
      } else {
        toast.error("No se pudo guardar", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <Field label="Título" required>
        <Input
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ej. Campus de Verano 2026"
          autoFocus
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <Field label="Slug (URL)" hint="Identificador único, ej. campus-verano-2026" required>
          <Input
            value={values.slug}
            onChange={(e) =>
              set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            placeholder="se genera del título si lo dejas vacío"
          />
        </Field>
        <Field label="Tipo" required>
          <Select
            value={values.kind ?? "campus"}
            onChange={(e) => set("kind", e.target.value as "campus" | "escuela")}
          >
            <option value="campus">Campus</option>
            <option value="escuela">Escuela regular</option>
          </Select>
        </Field>
      </div>

      <Field label="Fechas (texto visible)" hint="Ej. Julio - Agosto 2026">
        <Input
          value={values.datesLabel}
          onChange={(e) => set("datesLabel", e.target.value)}
          placeholder="Texto libre que se muestra debajo del título"
        />
      </Field>

      <Field
        label="Descripción (intro del formulario)"
        hint="Aparece como bienvenida en la página de inscripción. Soporta **negrita**."
      >
        <Textarea
          rows={4}
          value={values.intro}
          onChange={(e) => set("intro", e.target.value)}
          placeholder="Gracias por inscribirte al…"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Orden" hint="Menor = aparece antes">
          <Input
            type="number"
            min={0}
            value={String(values.sortOrder ?? 100)}
            onChange={(e) => set("sortOrder", Number(e.target.value))}
          />
        </Field>
        <Field label="Visibilidad">
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
            <input
              type="checkbox"
              checked={values.isPublic ?? true}
              onChange={(e) => set("isPublic", e.target.checked)}
              className="h-4 w-4"
            />
            Publicada en la web
          </label>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {mode === "create" ? "Crear convocatoria" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
