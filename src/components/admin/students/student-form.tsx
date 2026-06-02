"use client";

import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  createStudentAction,
  updateStudentAction,
  type StudentInput,
} from "@/lib/admin/actions/students";

type Props = {
  mode: "create" | "edit";
  studentId?: string;
  guardianId?: string | null;
  groups: Array<{ id: string; name: string; level: string }>;
  teachers: Array<{ id: string; fullName: string }>;
  initial?: StudentInput;
  onCancel: () => void;
  onSaved: () => void;
};

const EMPTY: StudentInput = {
  firstName: "",
  lastName: "",
  birthDate: "",
  address: "",
  level: "Verde",
  dominantHand: "Derecha",
  groupId: null,
  professorId: null,
  medicalInfo: "",
  imageConsent: false,
  coachNotes: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
  relationship: "Madre",
};

export function StudentForm({
  mode,
  studentId,
  guardianId,
  groups,
  teachers,
  initial,
  onCancel,
  onSaved,
}: Props) {
  const [values, setValues] = useState<StudentInput>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  function set<K extends keyof StudentInput>(key: K, value: StudentInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createStudentAction(values)
          : await updateStudentAction(studentId!, guardianId ?? null, values);
      if (result.ok) {
        toast.success(mode === "create" ? "Alumno dado de alta" : "Cambios guardados");
        onSaved();
      } else {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error("No hemos podido guardar", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nombre" required error={errors.firstName?.[0]}>
          <Input value={values.firstName} onChange={(e) => set("firstName", e.target.value)} autoFocus />
        </Field>
        <Field label="Apellidos" required error={errors.lastName?.[0]}>
          <Input value={values.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
        <Field label="Fecha de nacimiento" required hint="Formato día/mes/año" error={errors.birthDate?.[0]}>
          <Input type="date" value={values.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        </Field>
        <Field label="Mano dominante" required>
          <Select
            value={values.dominantHand}
            onChange={(e) => set("dominantHand", e.target.value as StudentInput["dominantHand"])}
          >
            <option value="Derecha">Derecha</option>
            <option value="Izquierda">Izquierda</option>
            <option value="Ambidiestro">Ambidiestro</option>
          </Select>
        </Field>
        <Field label="Nivel deportivo" required>
          <Select
            value={values.level}
            onChange={(e) => set("level", e.target.value as StudentInput["level"])}
          >
            <option value="Rojo">Rojo · iniciación</option>
            <option value="Naranja">Naranja · técnica</option>
            <option value="Verde">Verde · pista entera</option>
            <option value="Amarillo">Amarillo · competición</option>
          </Select>
        </Field>
        <Field label="Grupo asignado">
          <Select
            value={values.groupId ?? ""}
            onChange={(e) => set("groupId", e.target.value || null)}
          >
            <option value="">Sin grupo</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} (Nivel {group.level})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Entrenador asignado">
          <Select
            value={values.professorId ?? ""}
            onChange={(e) => set("professorId", e.target.value || null)}
          >
            <option value="">Sin entrenador asignado</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dirección">
          <Input value={values.address} onChange={(e) => set("address", e.target.value)} placeholder="Opcional" />
        </Field>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:p-5">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Tutor responsable
        </h4>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nombre del tutor" required error={errors.guardianName?.[0]}>
            <Input value={values.guardianName} onChange={(e) => set("guardianName", e.target.value)} />
          </Field>
          <Field label="Relación con el alumno" required>
            <Select value={values.relationship} onChange={(e) => set("relationship", e.target.value)}>
              <option>Madre</option>
              <option>Padre</option>
              <option>Tutor legal</option>
              <option>Abuelo/a</option>
              <option>Otro</option>
            </Select>
          </Field>
          <Field label="Teléfono móvil" required hint="Se usará para WhatsApp" error={errors.guardianPhone?.[0]}>
            <Input
              value={values.guardianPhone}
              onChange={(e) => set("guardianPhone", e.target.value)}
              placeholder="600 123 456"
            />
          </Field>
          <Field label="Email" error={errors.guardianEmail?.[0]}>
            <Input
              type="email"
              value={values.guardianEmail}
              onChange={(e) => set("guardianEmail", e.target.value)}
              placeholder="opcional"
            />
          </Field>
        </div>
      </div>

      <Field label="Información médica relevante" hint="Alergias, medicación, contraindicaciones">
        <Textarea
          value={values.medicalInfo}
          onChange={(e) => set("medicalInfo", e.target.value)}
          rows={2}
        />
      </Field>

      <Field label="Notas del entrenador" hint="Visible para el equipo técnico">
        <Textarea
          value={values.coachNotes}
          onChange={(e) => set("coachNotes", e.target.value)}
          rows={3}
        />
      </Field>

      <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <input
          type="checkbox"
          checked={values.imageConsent}
          onChange={(e) => set("imageConsent", e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[var(--border-strong)]"
        />
        <span className="text-sm">
          <strong>Consentimiento de imagen.</strong>{" "}
          <span className="text-[var(--muted)]">
            La familia autoriza el uso de fotos y vídeos del alumno con fines de comunicación interna y promocional.
          </span>
        </span>
      </label>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {mode === "create" ? "Crear alumno" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
