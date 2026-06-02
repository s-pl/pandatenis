"use client";

import { AlertTriangle, Calendar, ExternalLink, FileText, Film, Gift, Image as ImageIcon, Megaphone, Paperclip, Pencil, Receipt, RefreshCw, Send, ShieldCheck, ShieldQuestion, Trash2, Upload, UserPlus, X } from "lucide-react";
import { FormEvent, useMemo, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChatPreviewFrame, MessageBubble } from "@/components/admin/whatsapp/message-bubble";
import {
  createTemplateAction,
  deleteTemplateAction,
  deleteTemplateDocumentAction,
  setTemplateHeaderAction,
  submitTemplateToMetaAction,
  syncTemplatesFromMetaAction,
  updateTemplateAction,
  uploadTemplateDocumentAction,
  type TemplateInput,
} from "@/lib/admin/actions/whatsapp";
import type { Template } from "@/components/admin/whatsapp/whatsapp-workspace";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<Template["category"], string> = {
  recibo: "Recibo",
  promocion: "Promoción",
  evento: "Evento",
  inscripcion: "Inscripción",
  galeria: "Galería",
};

const CATEGORY_ICON: Record<Template["category"], ReactNode> = {
  recibo: <Receipt className="h-4 w-4" />,
  promocion: <Gift className="h-4 w-4" />,
  evento: <Calendar className="h-4 w-4" />,
  inscripcion: <UserPlus className="h-4 w-4" />,
  galeria: <ImageIcon className="h-4 w-4" />,
};

const META_TEMPLATES_URL = "https://business.facebook.com/wa/manage/message-templates/";

const META_STATUS_LABEL: Record<Template["metaStatus"], string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "es", label: "Español genérico · es" },
  { value: "es_ES", label: "Español (España) · es_ES" },
  { value: "en_US", label: "Inglés (EE.UU.) · en_US" },
  { value: "en", label: "Inglés genérico · en" },
];

const SAMPLE_BODIES: Record<Template["category"], string> = {
  recibo: "Hola {{1}}, te confirmamos el recibo {{2}} por {{3}}€. ¡Gracias por confiar en Panda Tenis!",
  promocion: "Hola {{1}}, abrimos plazas para el próximo trimestre. Si quieres reservar la plaza de {{2}}, responde a este WhatsApp y te contamos opciones.",
  evento: "Hola {{1}}, te recordamos el {{2}}. ¡Nos vemos en la pista! 🎾",
  inscripcion: "Hola {{1}}, ya está abierta la inscripción al {{2}}. Puedes completar la reserva aquí: {{3}}. Escríbenos si necesitas ayuda.",
  galeria: "Hola {{1}}, te mandamos una foto de {{2}} en la clase. ¡Esperamos que os guste!",
};

const VARIABLE_PATTERN = /\{\{(\d+|[a-zA-Z_]\w*)\}\}/g;
type MetaMediaHeaderType = "DOCUMENT" | "IMAGE" | "VIDEO";

function metaMediaHeaderType(raw: unknown): MetaMediaHeaderType | null {
  if (!Array.isArray(raw)) return null;
  for (const component of raw) {
    const c = component as { type?: unknown; format?: unknown };
    const format = String(c.format ?? "").toUpperCase();
    if (
      String(c.type ?? "").toUpperCase() === "HEADER" &&
      (format === "DOCUMENT" || format === "IMAGE" || format === "VIDEO")
    ) {
      return format;
    }
  }
  return null;
}

function hasMetaMediaHeader(raw: unknown, type: "DOCUMENT" | "IMAGE" | "VIDEO"): boolean {
  return metaMediaHeaderType(raw) === type;
}

function mediaHeaderIcon(type: MetaMediaHeaderType) {
  if (type === "IMAGE") return <ImageIcon className="h-3 w-3" />;
  if (type === "VIDEO") return <Film className="h-3 w-3" />;
  return <FileText className="h-3 w-3" />;
}

type TemplateMediaState =
  | { kind: "ready"; type: MetaMediaHeaderType; label: string }
  | { kind: "missing-local"; type: MetaMediaHeaderType; label: string }
  | { kind: "pending-meta"; type: MetaMediaHeaderType; label: string }
  | { kind: "mismatch"; localType: MetaMediaHeaderType; metaType: MetaMediaHeaderType; label: string }
  | { kind: "none"; label: string };

function templateMediaState(template: Template): TemplateMediaState {
  const localHeader = template.componentsSchema?.header ?? null;
  const metaHeaderType = metaMediaHeaderType(template.componentsSchema?.raw);

  if (localHeader && metaHeaderType === localHeader.type) {
    return {
      kind: "ready",
      type: localHeader.type,
      label: `${localHeader.type} listo · ${localHeader.filename}`,
    };
  }
  if (!localHeader && metaHeaderType) {
    return {
      kind: "missing-local",
      type: metaHeaderType,
      label: `Meta espera ${metaHeaderType} · falta archivo local`,
    };
  }
  if (localHeader && metaHeaderType && metaHeaderType !== localHeader.type) {
    return {
      kind: "mismatch",
      localType: localHeader.type,
      metaType: metaHeaderType,
      label: `Meta espera ${metaHeaderType} · archivo local ${localHeader.type}`,
    };
  }
  if (localHeader && !metaHeaderType) {
    return {
      kind: "pending-meta",
      type: localHeader.type,
      label: `${localHeader.type} subido · falta confirmar en Meta`,
    };
  }
  return { kind: "none", label: "Sin cabecera multimedia" };
}

export function WhatsappTemplates({ templates }: { templates: Template[] }) {
  const [editing, setEditing] = useState<Template | null>(null);
  const [mediaTarget, setMediaTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [syncPending, startSyncTransition] = useTransition();
  const [, startTransition] = useTransition();
  const mediaActions = templates.filter((template) => {
    const state = templateMediaState(template);
    return state.kind === "missing-local" || state.kind === "pending-meta" || state.kind === "mismatch";
  });

  function handleDelete(template: Template) {
    setDeleting(template);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setPendingId(target.id);
    startTransition(async () => {
      const result = await deleteTemplateAction(target.id);
      setPendingId(null);
      if (result.ok) toast.success("Plantilla eliminada");
      else toast.error("No se ha podido eliminar", { description: result.error });
    });
  }

  function handleSync() {
    startSyncTransition(async () => {
      const result = await syncTemplatesFromMetaAction();
      if (result.ok) {
        toast.success("Plantillas sincronizadas", {
          description: `${result.data?.synced ?? 0} plantillas leídas desde Meta.`,
        });
      } else {
        toast.error("No se han podido sincronizar", { description: result.error });
      }
    });
  }

  function handleSubmitToMeta(template: Template) {
    setPendingId(template.id);
    startTransition(async () => {
      const result = await submitTemplateToMetaAction(template.id);
      setPendingId(null);
      if (result.ok) {
        const id = result.data?.metaTemplateId;
        const status = result.data?.rawStatus ?? "PENDING";
        const wasUpdate = Boolean(template.metaTemplateId);
        toast.success(wasUpdate ? "Plantilla actualizada en Meta" : "Plantilla creada en Meta", {
          description: id
            ? `ID Meta: ${id} · Estado: ${status}. Meta tarda entre minutos y 24 h en revisar y aprobar. Cuando esté aprobada, pulsa “Sincronizar Meta”.`
            : "El estado se actualizará cuando Meta termine la revisión.",
        });
      } else {
        toast.error("Meta no aceptó la plantilla", {
          description: result.error,
          duration: 12000,
        });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Tus plantillas"
        description="Las plantillas se crean y aprueban en Meta. Aquí solo se sincronizan para poder enviarlas."
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={META_TEMPLATES_URL} target="_blank" rel="noreferrer">
              <Button variant="secondary" iconLeft={<ExternalLink className="h-4 w-4" />}>
                Crear en Meta
              </Button>
            </a>
            <Button
              iconLeft={<RefreshCw className="h-4 w-4" />}
              onClick={handleSync}
              loading={syncPending}
            >
              Sincronizar Meta
            </Button>
          </div>
        }
      />
      <CardBody>
        <MetaTemplatesGuide />

        {mediaActions.length > 0 && (
          <div className="mb-4 rounded-2xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-[var(--warning)]">
                  <AlertTriangle className="h-4 w-4" />
                  Plantillas con cabecera multimedia pendiente
                </p>
                <p className="mt-1 text-xs text-[var(--warning)]/90">
                  Estas plantillas existen en Meta, pero necesitan archivo local o sincronización antes de enviarse desde el panel.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={handleSync}
                loading={syncPending}
              >
                Sincronizar
              </Button>
            </div>
            <ul className="mt-3 grid gap-2">
              {mediaActions.slice(0, 4).map((template) => {
                const state = templateMediaState(template);
                return (
                  <li
                    key={template.id}
                    className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{template.name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{state.label}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={state.kind === "missing-local" || state.kind === "mismatch" ? "primary" : "secondary"}
                      iconLeft={
                        state.kind === "pending-meta" ? (
                          <RefreshCw className="h-3.5 w-3.5" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )
                      }
                      onClick={() =>
                        state.kind === "pending-meta" ? handleSync() : setMediaTarget(template)
                      }
                    >
                      {state.kind === "pending-meta" ? "Sincronizar" : "Asociar archivo"}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {mediaActions.length > 4 && (
              <p className="mt-2 text-xs font-medium text-[var(--warning)]">
                Y {mediaActions.length - 4} plantilla{mediaActions.length - 4 === 1 ? "" : "s"} más pendiente{mediaActions.length - 4 === 1 ? "" : "s"}.
              </p>
            )}
          </div>
        )}

        {templates.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-5 w-5" />}
            title="Aún no tienes plantillas"
            description="Crea tus plantillas en Meta Business Manager y, una vez aprobadas, pulsa “Sincronizar Meta” para verlas aquí."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a href={META_TEMPLATES_URL} target="_blank" rel="noreferrer">
                  <Button variant="secondary" iconLeft={<ExternalLink className="h-4 w-4" />}>
                    Crear en Meta
                  </Button>
                </a>
                <Button
                  iconLeft={<RefreshCw className="h-4 w-4" />}
                  onClick={handleSync}
                  loading={syncPending}
                >
                  Sincronizar Meta
                </Button>
              </div>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {templates.map((template) => {
              const localHeader = template.componentsSchema?.header ?? null;
              const metaHeaderType = metaMediaHeaderType(template.componentsSchema?.raw);
              const mediaState = templateMediaState(template);
              return (
                <li key={template.id}>
                  <article className="flex h-full flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] sm:p-5">
                  <header className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{template.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                        {CATEGORY_LABEL[template.category]} · {template.language}
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] text-[var(--muted)]">
                        {template.metaTemplateName}
                      </p>
                    </div>
                    <Badge
                      tone={
                        template.metaStatus === "approved"
                          ? "success"
                          : template.metaStatus === "rejected"
                            ? "danger"
                            : "warning"
                      }
                      iconLeft={
                        template.metaStatus === "approved" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <ShieldQuestion className="h-3 w-3" />
                        )
                      }
                    >
                      {META_STATUS_LABEL[template.metaStatus]}
                    </Badge>
                  </header>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral" iconLeft={CATEGORY_ICON[template.category]}>
                      {CATEGORY_LABEL[template.category]}
                    </Badge>
                    {mediaState.kind !== "none" && (
                      <Badge
                        tone={mediaState.kind === "ready" ? "info" : "warning"}
                        iconLeft={
                          mediaState.kind === "mismatch" ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : mediaState.kind === "missing-local" ||
                            mediaState.kind === "pending-meta" ? (
                            mediaHeaderIcon(mediaState.type)
                          ) : (
                            mediaHeaderIcon(mediaState.type)
                          )
                        }
                      >
                        {mediaState.label}
                      </Badge>
                    )}
                  </div>

                  <div className="grid gap-1 rounded-2xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)]">
                    <span>ID Meta: {template.metaTemplateId ?? "sin crear"}</span>
                    <span>Estado bruto: {template.metaReviewStatus ?? "sin sincronizar"}</span>
                    {localHeader &&
                      !hasMetaMediaHeader(
                        template.componentsSchema?.raw,
                        localHeader.type,
                      ) && (
                        <span className="font-semibold text-[var(--warning)]">
                          Meta aún no confirma cabecera {localHeader.type}. No se enviará el archivo hasta actualizar y sincronizar.
                        </span>
                      )}
                    {!localHeader && metaHeaderType && (
                      <span className="font-semibold text-[var(--warning)]">
                        Meta confirma cabecera {metaHeaderType}, pero la web no tiene un archivo local para enviarla. Edita la plantilla y sube la imagen, vídeo o documento que quieres mandar.
                      </span>
                    )}
                    {template.metaQualityScore && <span>Calidad: {template.metaQualityScore}</span>}
                    {template.metaSyncedAt && <span>Sync: {new Date(template.metaSyncedAt).toLocaleString("es-ES")}</span>}
                    {template.metaRejectionReason && (
                      <span className="text-[var(--danger)]">Motivo: {template.metaRejectionReason}</span>
                    )}
                    {(mediaState.kind === "missing-local" || mediaState.kind === "mismatch") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        iconLeft={<Upload className="h-3.5 w-3.5" />}
                        onClick={() => setEditing(template)}
                        className="mt-1 justify-self-start"
                      >
                        Asociar archivo
                      </Button>
                    )}
                    {mediaState.kind === "pending-meta" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
                        onClick={handleSync}
                        loading={syncPending}
                        className="mt-1 justify-self-start"
                      >
                        Confirmar con Meta
                      </Button>
                    )}
                  </div>

                  <ChatPreviewFrame contactName="Vista previa">
                    <MessageBubble text={template.body} highlightVariables status="delivered" timestamp="ahora" />
                  </ChatPreviewFrame>

                  <footer className="mt-auto flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => setEditing(template)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={pendingId === template.id}
                      iconLeft={<Send className="h-3.5 w-3.5" />}
                      onClick={() => handleSubmitToMeta(template)}
                    >
                      {template.metaTemplateId ? "Actualizar en Meta" : "Enviar a Meta"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDelete(template)}
                      disabled={pendingId === template.id}
                      className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </footer>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        <ConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onConfirm={confirmDelete}
          title="¿Borrar plantilla?"
          description={
            deleting
              ? `Vas a borrar la plantilla "${deleting.name}" del panel. Si ya estaba aprobada por Meta seguirá existiendo en Business Manager hasta que la elimines también allí.`
              : ""
          }
          confirmLabel="Sí, borrar"
        />

        <Modal
          open={!!editing}
          onClose={() => setEditing(null)}
          title={editing ? `Editar plantilla "${editing.name}"` : ""}
          size="xl"
        >
          {editing && (
            <TemplateForm
              initial={{
                name: editing.name,
                category: editing.category,
                body: editing.body,
                metaTemplateName: editing.metaTemplateName,
                language: editing.language as TemplateInput["language"],
                metaStatus: editing.metaStatus,
                componentsSchema: editing.componentsSchema as TemplateInput["componentsSchema"],
              }}
              mode="edit"
              templateId={editing.id}
              onCancel={() => setEditing(null)}
              onSaved={() => setEditing(null)}
            />
          )}
        </Modal>

        <Modal
          open={!!mediaTarget}
          onClose={() => setMediaTarget(null)}
          title={mediaTarget ? `Archivo de cabecera · ${mediaTarget.name}` : ""}
          description="Sube la imagen, vídeo o documento que se enviará con esta plantilla. Solo guarda el archivo en el panel; no modifica la plantilla en Meta."
          size="md"
        >
          {mediaTarget && (
            <TemplateMediaForm
              template={mediaTarget}
              onCancel={() => setMediaTarget(null)}
              onSaved={() => setMediaTarget(null)}
            />
          )}
        </Modal>
      </CardBody>
    </Card>
  );
}

const META_STEPS = [
  "Entra en Meta Business Manager → WhatsApp Manager → Plantillas de mensajes.",
  "Pulsa “Crear plantilla”, elige categoría (utilidad, marketing o autenticación) e idioma.",
  "Escribe el texto. Usa variables {{1}}, {{2}}… para los datos que cambian por familia.",
  "Envíala y espera la aprobación de Meta (suele tardar de minutos a unas horas).",
  "Cuando aparezca como “Aprobada”, vuelve aquí y pulsa “Sincronizar Meta”.",
];

function TemplateMediaForm({
  template,
  onCancel,
  onSaved,
}: {
  template: Template;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [header, setHeader] = useState<HeaderMedia | null>(
    template.componentsSchema?.header ?? null,
  );
  const [pending, startTransition] = useTransition();
  const expectedType = metaMediaHeaderType(template.componentsSchema?.raw);

  function save() {
    startTransition(async () => {
      const result = await setTemplateHeaderAction(template.id, header);
      if (result.ok) {
        toast.success(header ? "Archivo asociado" : "Archivo retirado");
        onSaved();
      } else {
        toast.error("No se ha podido guardar", { description: result.error });
      }
    });
  }

  return (
    <div className="grid gap-4">
      {expectedType && (
        <div className="rounded-2xl border border-[var(--info)]/25 bg-[var(--info-soft)] p-3 text-xs text-[var(--info)]">
          Meta indica que esta plantilla tiene una cabecera <strong>{expectedType}</strong>. Sube aquí
          el archivo real que quieres enviar (el del portal de Meta solo sirvió para la revisión).
        </div>
      )}
      <HeaderMediaField value={header} expectedType={expectedType} onChange={setHeader} />
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="button" loading={pending} onClick={save}>
          Guardar archivo
        </Button>
      </div>
    </div>
  );
}

function MetaTemplatesGuide() {
  return (
    <div className="mb-4 rounded-2xl border border-[var(--info)]/25 bg-[var(--info-soft)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--info)]">
            <ShieldCheck className="h-4 w-4" />
            Las plantillas se crean en Meta, no aquí
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--info)]/90">
            WhatsApp exige que toda plantilla esté aprobada por Meta antes de poder enviarse. Créalas en
            Meta Business Manager y luego sincronízalas para usarlas desde el panel.
          </p>
        </div>
        <a href={META_TEMPLATES_URL} target="_blank" rel="noreferrer" className="flex-shrink-0">
          <Button size="sm" variant="secondary" iconLeft={<ExternalLink className="h-3.5 w-3.5" />}>
            Abrir Meta
          </Button>
        </a>
      </div>
      <ol className="mt-3 grid gap-1.5">
        {META_STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs text-[var(--foreground)]">
            <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-[var(--info)] text-[10px] font-bold text-white">
              {i + 1}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TemplateForm({
  initial,
  mode,
  templateId,
  onCancel,
  onSaved,
}: {
  initial: TemplateInput;
  mode: "create" | "edit";
  templateId?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<TemplateInput>(initial);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const metaHeaderType = metaMediaHeaderType(values.componentsSchema?.raw);

  function set<K extends keyof TemplateInput>(key: K, value: TemplateInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const variables = useMemo(() => {
    const used = new Set<string>();
    let match: RegExpExecArray | null;
    const pattern = new RegExp(VARIABLE_PATTERN.source, "g");
    while ((match = pattern.exec(values.body))) used.add(match[1]);
    return Array.from(used);
  }, [values.body]);

  function insertVariable() {
    const nextIndex = variables.length + 1;
    const token = `{{${nextIndex}}}`;
    const textarea = bodyRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? values.body.length;
      const end = textarea.selectionEnd ?? values.body.length;
      const next = values.body.slice(0, start) + token + values.body.slice(end);
      set("body", next);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      });
    } else {
      set("body", values.body + token);
    }
  }

  function loadSample() {
    set("body", SAMPLE_BODIES[values.category]);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let payload = values;
    if (!values.metaTemplateName) {
      const slug = values.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      payload = { ...values, metaTemplateName: slug || "plantilla" };
    }
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTemplateAction(payload)
          : await updateTemplateAction(templateId!, payload);
      if (result.ok) {
        toast.success("Plantilla guardada");
        onSaved();
      } else {
        toast.error("No se ha podido guardar", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[1.2fr_360px]">
      <div className="grid gap-4">
        <Field label="¿De qué tipo es esta plantilla?" required>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
            {(Object.keys(CATEGORY_LABEL) as Template["category"][]).map((category) => {
              const active = values.category === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => set("category", category)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs font-medium transition-colors",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                  )}
                >
                  {CATEGORY_ICON[category]}
                  {CATEGORY_LABEL[category]}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Nombre interno" required hint="Cómo la verás aquí en el panel.">
          <Input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Recordatorio de pago" />
        </Field>

        <Field
          label="Texto del mensaje"
          required
          hint="Usa el botón “Insertar variable” para añadir personalizaciones."
        >
          <div className="flex flex-col gap-2">
            <Textarea
              ref={bodyRef}
              value={values.body}
              onChange={(e) => set("body", e.target.value)}
              rows={6}
              placeholder="Hola {{1}}, ..."
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={insertVariable}>
                Insertar variable {`{{${variables.length + 1}}}`}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={loadSample}>
                Cargar ejemplo de {CATEGORY_LABEL[values.category].toLowerCase()}
              </Button>
              {variables.length > 0 && (
                <Badge tone="primary">
                  {variables.length} {variables.length === 1 ? "variable" : "variables"} detectadas
                </Badge>
              )}
            </div>
          </div>
        </Field>

        <Field
          label="Nombre exacto en Meta"
          required
          hint="El 'name' aprobado en Meta Business Manager. Sólo minúsculas, números y guiones bajos."
        >
          <Input
            value={values.metaTemplateName}
            onChange={(e) => set("metaTemplateName", e.target.value)}
            placeholder="recordatorio_pago"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Idioma" required>
            <select
              value={values.language}
              onChange={(e) => set("language", e.target.value as TemplateInput["language"])}
              className="h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--ring)]"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado local" required>
            <select
              value={values.metaStatus}
              onChange={(e) => set("metaStatus", e.target.value as TemplateInput["metaStatus"])}
              className="h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--ring)]"
            >
              <option value="pending">Pendiente de aprobación</option>
              <option value="approved">Aprobada por Meta</option>
              <option value="rejected">Rechazada por Meta</option>
            </select>
          </Field>
        </div>

        <HeaderMediaField
          value={values.componentsSchema?.header ?? null}
          expectedType={metaHeaderType}
          onChange={(header) =>
            set("componentsSchema", {
              ...(values.componentsSchema ?? {}),
              header: header ?? null,
            })
          }
        />
        {metaHeaderType && !values.componentsSchema?.header && (
          <div className="rounded-2xl border border-[#f1d9a8] bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)]">
            <strong>Meta detecta cabecera {metaHeaderType}.</strong> La imagen subida en el portal es la muestra de revisión; para enviarla desde este panel, sube aquí el archivo que quieres mandar con la plantilla.
          </div>
        )}

        <div className="rounded-2xl border border-[#f1d9a8] bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)]">
          <strong>Aviso importante:</strong> crea el borrador aquí y pulsa <em>Enviar a Meta</em>, o usa
          <em> Sincronizar Meta</em> para traer plantillas ya existentes. El estado local se actualiza con la API y el webhook.
          {values.componentsSchema?.header && (
            <span className="mt-2 block">
              <strong>Plantilla con cabecera multimedia:</strong> pulsa <em>Enviar a Meta</em> o <em>Actualizar en Meta</em> para que la plantilla se revise con cabecera
              <em> {values.componentsSchema.header.type}</em>. Cuando Meta la apruebe, pulsa <em>Sincronizar Meta</em>; hasta entonces el sistema bloqueará el envío para que no llegue sin archivo.
            </span>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            {mode === "create" ? "Crear plantilla" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Vista previa</p>
        <ChatPreviewFrame contactName="Ana García">
          <MessageBubble
            text={values.body || "Empieza a escribir para ver el mensaje aquí…"}
            status="delivered"
            timestamp="ahora"
            highlightVariables
          />
        </ChatPreviewFrame>
        {variables.length > 0 && (
          <p className="mt-3 rounded-2xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)]">
            Al enviar tendrás que indicar el valor de cada variable: {variables.map((v) => `{{${v}}}`).join(", ")}.
          </p>
        )}
      </div>
    </form>
  );
}

type HeaderMedia = NonNullable<NonNullable<TemplateInput["componentsSchema"]>["header"]>;
type HeaderMediaType = HeaderMedia["type"];

/**
 * MIME types accepted by Meta WhatsApp Cloud for template HEADERs.
 * Limits per type are enforced server-side; we just enforce client-side
 * limits to fail fast without round-tripping a 100 MB file.
 *
 *  IMAGE      ≤ 5 MB    jpg, png
 *  VIDEO      ≤ 16 MB   mp4, 3gpp
 *  DOCUMENT   ≤ 100 MB  pdf, doc(x), xls(x), ppt(x), txt
 */
const ACCEPTED_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  // Videos
  "video/mp4",
  "video/3gpp",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
].join(",");

const ACCEPTED_TYPES_BY_TYPE: Record<HeaderMediaType, string> = {
  IMAGE: ["image/jpeg", "image/png"].join(","),
  VIDEO: ["video/mp4", "video/3gpp"].join(","),
  DOCUMENT: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ].join(","),
};

const MAX_BYTES_PER_TYPE: Record<HeaderMediaType, number> = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 16 * 1024 * 1024,
  DOCUMENT: 100 * 1024 * 1024,
};

function classifyMime(mime: string): HeaderMediaType | null {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime.startsWith("application/vnd.") ||
    mime === "text/plain"
  )
    return "DOCUMENT";
  return null;
}

function HeaderMediaPreview({ value }: { value: HeaderMedia }) {
  if (value.type === "IMAGE") {
    return <ImageIcon className="h-4 w-4 text-[var(--primary)]" />;
  }
  if (value.type === "VIDEO") {
    return <Film className="h-4 w-4 text-[var(--primary)]" />;
  }
  return <FileText className="h-4 w-4 text-[var(--primary)]" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function HeaderMediaField({
  value,
  expectedType,
  onChange,
}: {
  value: HeaderMedia | null;
  expectedType?: MetaMediaHeaderType | null;
  onChange: (next: HeaderMedia | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, startUpload] = useTransition();

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const mime = file.type || "application/octet-stream";
    const type = classifyMime(mime);
    if (!type) {
      toast.error("Tipo de archivo no admitido", {
        description: "Acepta imágenes (JPG, PNG), vídeos (MP4, 3GPP) o documentos (PDF, Word, Excel, PowerPoint, TXT).",
      });
      return;
    }
    if (expectedType && type !== expectedType) {
      toast.error("El archivo no coincide con la plantilla de Meta", {
        description: `Meta espera una cabecera ${expectedType}. Sube un archivo de ese tipo o cambia la plantilla en Meta.`,
      });
      return;
    }
    const limit = MAX_BYTES_PER_TYPE[type];
    if (file.size > limit) {
      toast.error("El archivo es demasiado grande", {
        description: `Máximo ${formatBytes(limit)} para ${type.toLowerCase()}s en WhatsApp.`,
      });
      return;
    }

    startUpload(async () => {
      try {
        const base64 = await fileToBase64(file);
        const result = await uploadTemplateDocumentAction({
          filename: file.name,
          mimeType: mime,
          base64,
        });
        if (!result.ok) {
          toast.error("No se ha podido subir el archivo", { description: result.error });
          return;
        }
        // Si había una cabecera previa, intentamos borrar el archivo anterior.
        if (value?.storagePath) {
          await deleteTemplateDocumentAction(value.storagePath).catch(() => {});
        }
        const uploaded = result.data!;
        onChange({
          // The server now returns `type` after inspection — trust it.
          type: uploaded.type ?? type,
          storagePath: uploaded.storagePath,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
        });
        toast.success("Archivo adjuntado a la plantilla", {
          description:
            uploaded.type === "IMAGE"
              ? "Imagen lista. Meta debe aprobarla con cabecera tipo IMAGE."
              : uploaded.type === "VIDEO"
                ? "Vídeo listo. Meta debe aprobarlo con cabecera tipo VIDEO."
                : "Documento listo. Meta debe aprobarlo con cabecera tipo DOCUMENT.",
        });
      } catch (error) {
        toast.error("No se ha podido subir", {
          description: error instanceof Error ? error.message : "Inténtalo de nuevo.",
        });
      }
    });
  }

  async function handleRemove() {
    if (!value) return;
    const previous = value;
    onChange(null);
    const result = await deleteTemplateDocumentAction(previous.storagePath);
    if (!result.ok) {
      toast.warning("El archivo no se ha podido borrar del almacenamiento", { description: result.error });
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)]/40 p-3">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <Paperclip className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Archivo de cabecera (opcional)</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {expectedType
              ? `Meta espera cabecera ${expectedType}. Sube aquí el archivo que se enviará con esta plantilla.`
              : "Imágenes (JPG · PNG, hasta 5 MB), vídeos (MP4 · 3GPP, hasta 16 MB) o documentos (PDF, Word, Excel, PowerPoint, TXT, hasta 100 MB)."}
          </p>

          {value ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <HeaderMediaPreview value={value} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium" title={value.filename}>
                {value.filename}
              </span>
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {value.type}
              </span>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-[var(--surface-muted)] disabled:opacity-60"
              >
                <Upload className="h-3 w-3" /> Reemplazar
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:opacity-60"
              >
                <X className="h-3 w-3" /> Quitar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Subiendo…" : "Subir archivo"}
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={expectedType ? ACCEPTED_TYPES_BY_TYPE[expectedType] : ACCEPTED_TYPES}
            className="hidden"
            onChange={handleSelect}
          />
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Lectura de archivo inválida"));
        return;
      }
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
