"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Images, Send, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
import { FormEvent, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import {
  deleteMediaAsset,
  registerMediaAsset,
  shareMediaByWhatsapp,
} from "@/lib/admin/actions/media";
import { formatLongDate } from "@/lib/format";

type Asset = {
  id: string;
  studentId: string;
  type: "foto" | "video";
  title: string;
  url: string;
  storagePath: string;
  uploadedAt: string;
  consentChecked: boolean;
  studentName: string;
};

type Student = { id: string; fullName: string; imageConsent: boolean };

export function GalleryManager({
  assets,
  students,
}: {
  assets: Asset[];
  students: Student[];
}) {
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(
    () => (filter ? assets.filter((asset) => asset.studentId === filter) : assets),
    [assets, filter],
  );

  function handleDelete(asset: Asset) {
    setDeleting(asset);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const result = await deleteMediaAsset(target.id);
      if (result.ok) toast.success("Archivo eliminado");
      else toast.error("No se ha podido eliminar", { description: result.error });
    });
  }

  function handleShare(asset: Asset) {
    startTransition(async () => {
      const result = await shareMediaByWhatsapp({ assetId: asset.id });
      if (result.ok) {
        toast.success(result.data?.status === "sent" ? "Envío realizado" : "Envío en cola", {
          description:
            result.data?.status === "queued"
              ? "Cloud API lo reintentará automáticamente desde la cola."
              : "La familia lo recibirá en segundos.",
        });
      }
      else toast.error("No se ha podido enviar", { description: result.error });
    });
  }

  return (
    <>
      {/* Filter + CTA row — mobile-first */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10">
            <option value="">Todos los alumnos</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.fullName}
                {!student.imageConsent ? " (sin consentimiento)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="accent"
          size="sm"
          iconLeft={<ImagePlus className="h-4 w-4" />}
          onClick={() => setUploading(true)}
          className="h-10"
        >
          Subir archivos
        </Button>
      </div>

      <Card>
        <CardHeader
          title="Archivos de la escuela"
          description="Antes de enviar a la familia, comprueba el consentimiento de imagen."
        />
        <CardBody>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Images className="h-5 w-5" />}
              title={assets.length === 0 ? "Sin contenido todavía" : "Sin resultados"}
              description={
                assets.length === 0
                  ? "Cuando subas fotos o vídeos aparecerán aquí ordenados por fecha más reciente."
                  : "Cambia el alumno seleccionado o sube nuevo material."
              }
              action={
                assets.length === 0 && (
                  <Button iconLeft={<ImagePlus className="h-4 w-4" />} onClick={() => setUploading(true)}>
                    Subir primer archivo
                  </Button>
                )
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {filtered.map((asset) => (
                  <motion.li
                    key={asset.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Card className="overflow-hidden">
                      <div className="relative aspect-video w-full bg-[var(--surface-muted)]">
                        {asset.type === "foto" ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
                        ) : (
                          <video src={asset.url} controls className="h-full w-full object-cover" />
                        )}
                        {!asset.consentChecked && (
                          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--danger-soft)] px-2 py-1 text-xs font-medium text-[var(--danger)]">
                            <ShieldAlert className="h-3 w-3" /> Sin consentimiento
                          </span>
                        )}
                      </div>
                      <CardBody>
                        <p className="text-sm font-semibold">{asset.title}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {asset.studentName} · {formatLongDate(asset.uploadedAt)}
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <Button
                            size="sm"
                            variant={asset.consentChecked ? "outline" : "ghost"}
                            disabled={!asset.consentChecked}
                            iconLeft={<Send className="h-3.5 w-3.5" />}
                            onClick={() => handleShare(asset)}
                          >
                            Enviar por WhatsApp
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDelete(asset)}
                            className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                            aria-label="Borrar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </CardBody>
                    </Card>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Borrar archivo?"
        description={
          deleting
            ? `Vas a borrar "${deleting.title}" de ${deleting.studentName}. El archivo se eliminará tanto del panel como del almacenamiento.`
            : ""
        }
        confirmLabel="Sí, borrar"
      />

      <Modal open={uploading} onClose={() => setUploading(false)} title="Subir archivos" size="md">
        <UploadForm students={students} onCancel={() => setUploading(false)} onSaved={() => setUploading(false)} />
      </Modal>
    </>
  );
}

function UploadForm({
  students,
  onCancel,
  onSaved,
}: {
  students: Student[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pending, setPending] = useState(false);

  const selectedStudent = students.find((student) => student.id === studentId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      toast.error("Elige un archivo");
      return;
    }
    if (!studentId) {
      toast.error("Selecciona un alumno");
      return;
    }
    setPending(true);
    let uploadedPath: string | null = null;
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${studentId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("student-media")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      uploadedPath = path;

      const result = await registerMediaAsset({
        studentId,
        storagePath: path,
        type: file.type.startsWith("video/") ? "video" : "foto",
        title: title || file.name,
        consentChecked,
      });
      if (!result.ok) throw new Error(result.error);
      uploadedPath = null;
      toast.success("Archivo subido");
      onSaved();
    } catch (error) {
      if (uploadedPath) {
        await createClient().storage.from("student-media").remove([uploadedPath]);
      }
      toast.error("No se ha podido subir", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Alumno" required>
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.fullName}
            </option>
          ))}
        </Select>
      </Field>

      {selectedStudent && !selectedStudent.imageConsent && (
        <div className="rounded-2xl border border-[#f1d9a8] bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)]">
          ⚠ Este alumno aún no tiene marcado el consentimiento de imagen en su ficha.
        </div>
      )}

      <Field label="Título" required hint="Visible en la galería y en el mensaje a la familia.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Foto en el torneo de Navidad" />
      </Field>

      <Field label="Archivo" required>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-6 text-center transition-colors hover:border-[var(--accent)] sm:px-6 sm:py-8"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[var(--primary)] shadow-[var(--shadow-sm)]">
            <UploadCloud className="h-6 w-6" />
          </span>
          <p className="text-sm font-semibold">
            {file ? file.name : "Elige una foto o vídeo"}
          </p>
          <p className="text-xs text-[var(--muted)]">JPG, PNG, WebP, MP4 o MOV · máximo 50 MB</p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            setFile(next);
            if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, ""));
          }}
        />
      </Field>

      <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm">
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--primary)]"
        />
        <span>
          <strong>Confirmo que la familia ha autorizado el uso de esta imagen</strong>{" "}
          <span className="text-[var(--muted)]">para fines internos o promocionales.</span>
        </span>
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Subir archivo
        </Button>
      </div>
    </form>
  );
}
