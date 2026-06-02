"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  createCampusCourseAction,
  updateCampusCourseAction,
  type CampusCourseInput,
} from "@/lib/admin/actions/campus-courses";

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const EMPTY_COURSE: CampusCourseInput = {
  slug: "",
  title: "",
  kind: "campus",
  datesLabel: "",
  startsOn: "",
  endsOn: "",
  intro: "",
  imagePath: "",
  isPublic: true,
  sortOrder: 100,
};

export function CourseForm({
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
        toast.success(mode === "create" ? "Campus creado" : "Cambios guardados");
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Fecha de inicio"
          hint="Marca el estado en la web (próximo / en curso / finalizado)"
        >
          <Input
            type="date"
            value={values.startsOn ?? ""}
            onChange={(e) => set("startsOn", e.target.value)}
          />
        </Field>
        <Field label="Fecha de fin">
          <Input
            type="date"
            value={values.endsOn ?? ""}
            onChange={(e) => set("endsOn", e.target.value)}
          />
        </Field>
      </div>

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
            Publicado en la web
          </label>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {mode === "create" ? "Crear campus" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
