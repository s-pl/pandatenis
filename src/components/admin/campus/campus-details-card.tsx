"use client";

import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { useRouter } from "@/i18n/navigation";
import { CourseForm } from "@/components/admin/campus/course-form";
import {
  deleteCampusCourseAction,
  toggleCampusCoursePublicAction,
} from "@/lib/admin/actions/campus-courses";

export type CampusDetail = {
  id: string;
  slug: string;
  title: string;
  kind: "campus" | "escuela";
  datesLabel: string;
  startsOn: string | null;
  endsOn: string | null;
  intro: string;
  imagePath: string | null;
  isPublic: boolean;
  sortOrder: number;
};

export function CampusDetailsCard({ course }: { course: CampusDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();

  function togglePublic() {
    startTransition(async () => {
      const result = await toggleCampusCoursePublicAction(course.id, !course.isPublic);
      if (result.ok) {
        toast.success(course.isPublic ? "Campus oculto en la web" : "Campus publicado en la web");
      } else {
        toast.error("No se pudo cambiar", { description: result.error });
      }
    });
  }

  function confirmDelete() {
    setDeleting(false);
    startTransition(async () => {
      const result = await deleteCampusCourseAction(course.id);
      if (result.ok) {
        toast.success("Campus eliminado");
        router.push("/admin/campus");
      } else {
        toast.error("No se pudo eliminar", { description: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Detalles del campus"
        description="Edita fechas, descripción y visibilidad en la web pública."
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              className="flex-1 sm:flex-none"
              variant="secondary"
              size="sm"
              onClick={togglePublic}
              disabled={pending}
              iconLeft={course.isPublic ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            >
              {course.isPublic ? "Ocultar" : "Publicar"}
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              size="sm"
              onClick={() => setEditing(true)}
              iconLeft={<Pencil className="h-3.5 w-3.5" />}
            >
              Editar
            </Button>
          </div>
        }
      />
      <CardBody className="grid gap-3">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="Fechas (texto)" value={course.datesLabel || "—"} />
          <Detail
            label="Periodo"
            value={
              course.startsOn || course.endsOn
                ? `${course.startsOn ?? "?"} → ${course.endsOn ?? "?"}`
                : "Sin fechas"
            }
          />
          <Detail
            label="Visibilidad"
            value={
              course.isPublic ? (
                <Badge tone="info">Publicado</Badge>
              ) : (
                <Badge tone="neutral">Oculto</Badge>
              )
            }
          />
          <Detail label="Slug" value={<code className="font-mono text-[12px]">{course.slug}</code>} />
        </dl>
        {course.intro && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Descripción del formulario
            </p>
            <p className="mt-1 whitespace-pre-line text-[13px] text-[var(--foreground)]">
              {course.intro}
            </p>
          </div>
        )}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => setDeleting(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar campus
          </button>
        </div>
      </CardBody>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={`Editar ${course.title}`}
        icon={<Pencil className="h-5 w-5" />}
        tone="primary"
        size="md"
      >
        <CourseForm
          initial={{
            slug: course.slug,
            title: course.title,
            kind: course.kind,
            datesLabel: course.datesLabel,
            startsOn: course.startsOn ?? "",
            endsOn: course.endsOn ?? "",
            intro: course.intro,
            imagePath: course.imagePath ?? "",
            isPublic: course.isPublic,
            sortOrder: course.sortOrder,
          }}
          mode="edit"
          courseId={course.id}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </Modal>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={confirmDelete}
        title="¿Borrar campus?"
        description={`Vas a eliminar "${course.title}" definitivamente. Las inscripciones y recibos ya hechos no se borran, pero la tarjeta y el formulario público dejarán de funcionar.`}
        confirmLabel="Sí, borrar"
      />
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-[13.5px] font-medium">{value}</dd>
    </div>
  );
}
