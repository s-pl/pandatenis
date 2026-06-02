"use client";

import { ChevronRight, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Link } from "@/i18n/navigation";
import { computeCampusStatus, type CampusStatus } from "@/lib/web/campus-status";
import { seasonIconFor } from "@/lib/campus-season-icon";
import { CourseForm, EMPTY_COURSE } from "@/components/admin/campus/course-form";

export type CampusCardRow = {
  id: string;
  slug: string;
  title: string;
  datesLabel: string;
  startsOn: string | null;
  endsOn: string | null;
  isPublic: boolean;
  registrationCount: number;
};

const STATUS_META: Record<CampusStatus, { label: string; tone: "warning" | "success" | "neutral" }> = {
  upcoming: { label: "Próximamente", tone: "warning" },
  active: { label: "En curso", tone: "success" },
  finished: { label: "Finalizado", tone: "neutral" },
};

export function CampusCardsGrid({ courses }: { courses: CampusCardRow[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-[var(--muted)]">
          Toca un campus para gestionar sus fechas, inscripciones y pagos.
        </p>
        <Button
          className="w-full sm:w-auto"
          iconLeft={<Plus className="h-4 w-4" />}
          onClick={() => setCreating(true)}
        >
          Nuevo campus
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {courses.map((course) => {
          const Icon = seasonIconFor(course.title);
          const status = computeCampusStatus(course.startsOn, course.endsOn);
          return (
            <Link
              key={course.id}
              href={`/admin/campus/${course.slug}`}
              className="group flex h-full flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] sm:p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] sm:h-11 sm:w-11">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <ChevronRight className="h-5 w-5 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold sm:text-sm">{course.title}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)] sm:text-[12px]">
                  {course.datesLabel || "Sin fechas"}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                {status && <Badge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Badge>}
                {course.isPublic ? (
                  <Badge tone="info">Publicado</Badge>
                ) : (
                  <Badge tone="neutral">Oculto</Badge>
                )}
                <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--muted)]">
                  <UserPlus className="h-3.5 w-3.5" />
                  {course.registrationCount}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo campus"
        description="Aparecerá como tarjeta y, si lo marcas como publicado, también en /campamentos."
        icon={<Plus className="h-5 w-5" />}
        tone="primary"
        size="md"
      >
        <CourseForm
          initial={EMPTY_COURSE}
          mode="create"
          onCancel={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      </Modal>
    </div>
  );
}
