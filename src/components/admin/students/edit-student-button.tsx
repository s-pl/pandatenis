"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StudentForm } from "@/components/admin/students/student-form";
import type { StudentInput } from "@/lib/admin/actions/students";

/**
 * Botón "Actualizar info" en la página de detalle del alumno.
 * Abre el StudentForm dentro de un Modal y refresca la página al guardar.
 */
export function EditStudentButton({
  studentId,
  guardianId,
  studentName,
  initial,
  groups,
  teachers,
}: {
  studentId: string;
  guardianId: string | null;
  studentName: string;
  initial: StudentInput;
  groups: Array<{ id: string; name: string; level: string }>;
  teachers: Array<{ id: string; fullName: string }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        variant="accent"
        size="sm"
        iconLeft={<Pencil className="h-3.5 w-3.5" />}
        onClick={() => setOpen(true)}
      >
        Actualizar info
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Editar ${studentName}`}
        description="Cambia los datos del alumno o de su tutor responsable."
        icon={<Pencil className="h-5 w-5" />}
        tone="primary"
        size="lg"
      >
        <StudentForm
          mode="edit"
          studentId={studentId}
          guardianId={guardianId}
          initial={initial}
          groups={groups}
          teachers={teachers}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
