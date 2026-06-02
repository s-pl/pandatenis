"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  ListChecks,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { ChatPreviewFrame, MessageBubble } from "@/components/admin/whatsapp/message-bubble";
import type { AudienceContact, Template } from "@/components/admin/whatsapp/whatsapp-workspace";
import { sendBulkWhatsapp } from "@/lib/admin/actions/whatsapp";
import { formatPhoneEs, normalizeWhatsappNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;
type SourceMode = "audience" | "excel" | "quick";

type QuickContact = { id: string; name: string; phone: string };

type ImportedSheet = { headers: string[]; rows: Record<string, string>[]; fileName: string };
type Mapping = { name: string; phone: string; variables: string[] };

type Recipient = {
  name: string;
  phone: string;
  variables: Record<string, string>;
};

const VARIABLE_PATTERN = /\{\{(\d+|[a-zA-Z_]\w*)\}\}/g;

function normalizeValidWhatsappPhone(phone: string) {
  const normalized = normalizeWhatsappNumber(phone);
  return /^\d{8,15}$/.test(normalized) ? normalized : "";
}

export function WhatsappBulkSender({
  audience,
  templates,
}: {
  audience: AudienceContact[];
  templates: Template[];
}) {
  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<SourceMode>("audience");
  const [audienceSelection, setAudienceSelection] = useState<Set<number>>(new Set());
  const [audienceFilter, setAudienceFilter] = useState("");
  const [quickContacts, setQuickContacts] = useState<QuickContact[]>([]);
  const [imported, setImported] = useState<ImportedSheet | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [templateId, setTemplateId] = useState<string>(
    () => templates.find((t) => t.metaStatus === "approved")?.id ?? templates[0]?.id ?? "",
  );
  // El envío siempre va por Meta Cloud API. Antes había un modo manual con
  // wa.me que se eliminó para no salirse de WhatsApp Business.
  const [pending, startTransition] = useTransition();

  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const templateVariables = useMemo(() => extractVariables(template?.body ?? ""), [template]);

  const recipients = useMemo<Recipient[]>(() => {
    if (source === "audience") {
      return [...audienceSelection]
        .map((idx) => audience[idx])
        .filter(Boolean)
        .map((contact) => ({
          name: contact.name,
          phone: contact.phone,
          variables: {
            "1": contact.name.split(" ")[0] ?? contact.name,
            "2": contact.studentName ?? "",
            "3": contact.level ?? "",
          },
        }));
    }
    if (source === "quick") {
      return quickContacts.map((contact) => ({
        name: contact.name,
        phone: contact.phone,
        variables: {
          "1": contact.name.split(" ")[0] ?? contact.name,
        },
      }));
    }
    if (!imported || !mapping) return [];
    return imported.rows.map((row) => {
      const variables: Record<string, string> = {};
      mapping.variables.forEach((column, idx) => {
        if (column) variables[String(idx + 1)] = row[column] ?? "";
      });
      return {
        name: row[mapping.name] ?? "",
        phone: row[mapping.phone] ?? "",
        variables,
      };
    });
  }, [source, audienceSelection, audience, quickContacts, imported, mapping]);

  const validRecipients = useMemo(
    () =>
      recipients
        .map((recipient) => ({
          ...recipient,
          phone: normalizeValidWhatsappPhone(recipient.phone),
        }))
        .filter((recipient) => Boolean(recipient.name && recipient.phone)),
    [recipients],
  );
  const invalidCount = recipients.length - validRecipients.length;

  const canAdvanceTo2 = validRecipients.length > 0;
  const canAdvanceTo3 = canAdvanceTo2 && !!template && template.metaStatus === "approved";

  function reset() {
    setStep(1);
    setAudienceSelection(new Set());
    setImported(null);
    setMapping(null);
    setQuickContacts([]);
  }

  function handleSend() {
    if (!template) return;
    startTransition(async () => {
      const result = await sendBulkWhatsapp({
        templateId: template.id,
        category: template.category,
        recipients: validRecipients,
      });
      if (result.ok) {
        const { sent = 0, queued = 0, failed = 0 } = result.data ?? {};
        if (failed === 0 && queued === 0) {
          toast.success(`${sent} mensajes enviados`, {
            description: "Las familias los recibirán como un mensaje normal de WhatsApp.",
          });
        } else if (failed === 0) {
          toast.info(`${sent} enviados, ${queued} en cola`, {
            description: "Los pendientes se reintentarán automáticamente desde la bandeja.",
          });
        } else {
          toast.warning(`${sent} enviados, ${queued} en cola, ${failed} fallidos`, {
            description: "Revisa la bandeja para procesar la cola o corregir los fallidos.",
          });
        }
        reset();
      } else {
        toast.error("No se han podido enviar", { description: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Asistente de envío masivo"
        description="Tres pasos: a quién, qué mensaje y revisar."
        actions={
          <Badge tone="primary" iconLeft={<Sparkles className="h-3 w-3" />}>
            Paso {step} de 3
          </Badge>
        }
      />
      <CardBody>
        <Stepper step={step} />

        <div className="mt-6 min-h-[460px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                <StepHeader
                  number={1}
                  title="¿A quién mandamos el mensaje?"
                  subtitle="Familias guardadas, un CSV/TSV o contactos sueltos escritos a mano."
                />
                <div className="mt-5 grid gap-2 rounded-xl bg-[var(--surface-muted)] p-1 md:grid-cols-3">
                  <SourceButton
                    active={source === "audience"}
                    onClick={() => setSource("audience")}
                    icon={<Users className="h-4 w-4" />}
                    title="Familias guardadas"
                    hint={`${audience.length} contactos`}
                  />
                  <SourceButton
                    active={source === "excel"}
                    onClick={() => setSource("excel")}
                    icon={<FileSpreadsheet className="h-4 w-4" />}
                    title="Subir CSV / TSV"
                    hint="Cualquier estructura"
                  />
                  <SourceButton
                    active={source === "quick"}
                    onClick={() => setSource("quick")}
                    icon={<UserPlus className="h-4 w-4" />}
                    title="Contactos sueltos"
                    hint={quickContacts.length === 0 ? "Escribe a mano" : `${quickContacts.length} añadidos`}
                  />
                </div>

                {source === "audience" && (
                  <AudiencePicker
                    audience={audience}
                    filter={audienceFilter}
                    onFilterChange={setAudienceFilter}
                    selection={audienceSelection}
                    onChangeSelection={setAudienceSelection}
                  />
                )}

                {source === "excel" && (
                  <ExcelImporter
                    imported={imported}
                    mapping={mapping}
                    onImported={(sheet) => {
                      setImported(sheet);
                      setMapping({
                        name: detectColumn(sheet.headers, ["nombre", "name", "tutor", "guardian", "padre", "madre"]),
                        phone: detectColumn(sheet.headers, [
                          "telefono",
                          "teléfono",
                          "phone",
                          "movil",
                          "móvil",
                          "whatsapp",
                          "celular",
                        ]),
                        variables: [],
                      });
                    }}
                    onMappingChange={setMapping}
                  />
                )}

                {source === "quick" && (
                  <QuickContactsBuilder
                    contacts={quickContacts}
                    onChange={setQuickContacts}
                  />
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                <StepHeader
                  number={2}
                  title="¿Qué mensaje quieres mandar?"
                  subtitle="Elige una plantilla aprobada. A la derecha verás cómo se verá en WhatsApp."
                />

                <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
                  <div className="flex flex-col gap-3">
                    {templates.length === 0 ? (
                      <EmptyState
                        icon={<Send className="h-5 w-5" />}
                        title="Aún no hay plantillas"
                        description="Crea una desde la pestaña Plantillas para poder enviar."
                      />
                    ) : (
                      <ul className="grid gap-2">
                        {templates.map((entry) => {
                          const active = entry.id === templateId;
                          return (
                            <li key={entry.id}>
                              <button
                                type="button"
                                onClick={() => setTemplateId(entry.id)}
                                className={cn(
                                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                                  active
                                    ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                                    : "border-[var(--border)] hover:bg-[var(--surface-muted)]",
                                )}
                              >
                                <span
                                  className={cn(
                                    "grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl",
                                    active ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-muted)] text-[var(--muted)]",
                                  )}
                                >
                                  {active ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold">{entry.name}</p>
                                    <Badge tone={(entry.metaStatus === "approved") ? "success" : "warning"}>
                                      {(entry.metaStatus === "approved") ? "Aprobada" : "Pendiente"}
                                    </Badge>
                                    <Badge tone="neutral">{categoryLabel(entry.category)}</Badge>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{entry.body}</p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {template && imported && mapping && templateVariables.length > 0 && (
                      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                        <p className="text-sm font-semibold">Personalización por columna</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          La plantilla tiene {templateVariables.length} variables. Indica de qué columna del archivo sale cada una.
                        </p>
                        <ul className="mt-3 grid gap-3 md:grid-cols-2">
                          {templateVariables.map((variable, idx) => (
                            <li key={variable}>
                              <Field label={`Variable {{${variable}}}`}>
                                <Select
                                  value={mapping.variables[idx] ?? ""}
                                  onChange={(e) => {
                                    const next = [...mapping.variables];
                                    next[idx] = e.target.value;
                                    setMapping({ ...mapping, variables: next });
                                  }}
                                >
                                  <option value="">— sin asignar —</option>
                                  {imported.headers.map((header) => (
                                    <option key={header} value={header}>
                                      {header}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="lg:sticky lg:top-6">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Vista previa</p>
                    {template ? (
                      <ChatPreviewFrame contactName={validRecipients[0]?.name ?? "Ana García"}>
                        <MessageBubble
                          text={renderTemplate(template.body, validRecipients[0]?.variables ?? sampleVariables(templateVariables))}
                          status="delivered"
                          timestamp="ahora"
                        />
                      </ChatPreviewFrame>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-10 text-center text-sm text-[var(--muted)]">
                        Elige una plantilla para ver el preview.
                      </div>
                    )}
                    {template && template.metaStatus !== "approved" && (
                      <p className="mt-3 rounded-2xl border border-[#f1d9a8] bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)]">
                        Esta plantilla aún no está aprobada por Meta. No podrás enviarla hasta que Business Manager la apruebe.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                <StepHeader
                  number={3}
                  title="Revisa antes de enviar"
                  subtitle="Elige cómo quieres mandar los mensajes y revisa el resumen."
                />

                <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
                  <div className="flex flex-col gap-4">
                    {/* Modo fijado a "auto" — todos los envíos van por Meta
                        Cloud API. Antes había un modo manual con wa.me
                        eliminado para no salirse de WhatsApp Business. */}
                    {template?.metaStatus !== "approved" && (
                      <div className="rounded-2xl border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                        Esta plantilla no está aprobada por Meta. Apruébala antes de
                        enviarla a las familias.
                      </div>
                    )}

                    <ul className="grid gap-2 sm:grid-cols-3">
                      <SummaryTile
                        label="Destinatarios"
                        value={validRecipients.length}
                        hint="con teléfono válido"
                        tone="success"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                      />
                      <SummaryTile
                        label="Descartados"
                        value={invalidCount}
                        hint={invalidCount > 0 ? "teléfono inválido" : "todo correcto"}
                        tone={invalidCount > 0 ? "warning" : "neutral"}
                        icon={<ListChecks className="h-4 w-4" />}
                      />
                      <SummaryTile
                        label="Plantilla"
                        value={template?.metaStatus === "approved" ? "Lista" : "Pendiente"}
                        hint={template?.name ?? ""}
                        tone={template?.metaStatus === "approved" ? "success" : "danger"}
                        icon={<Send className="h-4 w-4" />}
                      />
                    </ul>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                        Primeros 6 destinatarios
                      </p>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {validRecipients.slice(0, 6).map((recipient, idx) => (
                          <li
                            key={idx}
                            className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--surface-muted)] px-3 py-2 text-xs"
                          >
                            <span className="truncate font-medium">{recipient.name}</span>
                            <span className="text-[var(--muted)]">{formatPhoneEs(recipient.phone)}</span>
                          </li>
                        ))}
                      </ul>
                      {validRecipients.length > 6 && (
                        <p className="mt-2 text-right text-xs text-[var(--muted)]">
                          + {validRecipients.length - 6} familias más
                        </p>
                      )}
                    </div>

                    {invalidCount > 0 && (
                      <div className="rounded-2xl border border-[#f1c5c5] bg-[var(--danger-soft)] p-3 text-xs text-[var(--danger)]">
                        ⚠ Se descartarán {invalidCount} contactos por teléfono no válido. Revisa el origen si es importante.
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Vista previa real
                    </p>
                    {template && validRecipients[0] && (
                      <ChatPreviewFrame contactName={validRecipients[0].name}>
                        <MessageBubble
                          text={renderTemplate(template.body, validRecipients[0].variables)}
                          status="sent"
                          timestamp="ahora"
                        />
                      </ChatPreviewFrame>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 1}
            onClick={() => setStep((step - 1) as Step)}
            iconLeft={<ArrowLeft className="h-4 w-4" />}
          >
            Atrás
          </Button>

          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            {step === 1 && (
              <span>
                {validRecipients.length} de {recipients.length || 0} destinatarios listos
              </span>
            )}
            {step === 2 && template && (
              <span>
                {template.metaStatus === "approved" ? "Plantilla aprobada ✓" : "Plantilla pendiente"}
              </span>
            )}
            {step === 3 && <span>Última revisión antes de salir</span>}
          </div>

          {step < 3 ? (
            <Button
              type="button"
              disabled={step === 1 ? !canAdvanceTo2 : !canAdvanceTo3}
              onClick={() => setStep((step + 1) as Step)}
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              type="button"
              loading={pending}
              disabled={
                !template ||
                validRecipients.length === 0 ||
                template.metaStatus !== "approved"
              }
              onClick={handleSend}
              iconLeft={<Send className="h-4 w-4" />}
            >
              {pending ? "Enviando…" : `Enviar a ${validRecipients.length}`}
            </Button>
          )}
        </footer>
      </CardBody>

    </Card>
  );
}

function Stepper({ step }: { step: Step }) {
  const items: Array<{ number: Step; label: string; icon: ReactNode }> = [
    { number: 1, label: "Destinatarios", icon: <Users className="h-4 w-4" /> },
    { number: 2, label: "Mensaje", icon: <Send className="h-4 w-4" /> },
    { number: 3, label: "Revisar", icon: <CheckCircle2 className="h-4 w-4" /> },
  ];

  return (
    <ol className="flex items-center gap-3 overflow-x-auto">
      {items.map((item, idx) => {
        const active = step === item.number;
        const done = step > item.number;
        return (
          <li key={item.number} className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-2 transition-colors",
                active
                  ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                  : done
                    ? "border-transparent bg-[var(--surface-muted)] text-[var(--muted)]"
                    : "border-[var(--border)] text-[var(--muted)]",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-xl text-sm font-semibold",
                  active
                    ? "bg-[var(--primary)] text-white"
                    : done
                      ? "bg-[var(--success-soft)] text-[var(--success)]"
                      : "bg-[var(--surface)] text-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : item.number}
              </span>
              <span className="text-sm font-semibold text-foreground">{item.label}</span>
            </div>
            {idx < items.length - 1 && (
              <span className="hidden h-px w-12 bg-[var(--border)] md:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepHeader({ number, title, subtitle }: { number: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
        <span className="text-base font-semibold">{number}</span>
      </span>
      <div>
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      </div>
    </div>
  );
}

function SourceButton({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
        active ? "bg-[var(--surface)] shadow-[var(--shadow-sm)]" : "hover:bg-[var(--surface)]/60",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl",
          active ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-[var(--surface)] text-[var(--muted)]",
        )}
      >
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-[var(--muted)]">{hint}</span>
      </span>
    </button>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: ReactNode;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const tones: Record<string, string> = {
    success: "bg-[var(--success-soft)] text-[var(--success)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
    neutral: "bg-[var(--surface-muted)] text-[var(--muted)]",
  };
  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className={cn("mb-2 grid h-8 w-8 place-items-center rounded-xl", tones[tone])}>{icon}</div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-[var(--muted)]">{hint}</p>
    </li>
  );
}

function AudiencePicker({
  audience,
  filter,
  onFilterChange,
  selection,
  onChangeSelection,
}: {
  audience: AudienceContact[];
  filter: string;
  onFilterChange: (value: string) => void;
  selection: Set<number>;
  onChangeSelection: (next: Set<number>) => void;
}) {
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return audience
      .map((contact, idx) => ({ contact, idx }))
      .filter(({ contact }) => {
        if (!q) return true;
        return (
          contact.name.toLowerCase().includes(q) ||
          contact.phone.includes(q) ||
          (contact.studentName?.toLowerCase().includes(q) ?? false) ||
          (contact.level?.toLowerCase().includes(q) ?? false)
        );
      });
  }, [audience, filter]);

  function toggle(idx: number) {
    const next = new Set(selection);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    onChangeSelection(next);
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-[2fr_auto_auto]">
        <Input
          placeholder="Filtrar por familia, alumno, nivel…"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => onChangeSelection(new Set(filtered.map(({ idx }) => idx)))}
        >
          Seleccionar visibles
        </Button>
        <Button type="button" variant="ghost" onClick={() => onChangeSelection(new Set())}>
          Limpiar
        </Button>
      </div>
      {selection.size > 0 && (
        <div className="rounded-2xl bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-[var(--primary)]">
          {selection.size} {selection.size === 1 ? "familia seleccionada" : "familias seleccionadas"}
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--muted)]">
          No hay familias que coincidan con el filtro.
        </p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-[var(--border)] overflow-y-auto rounded-2xl border border-[var(--border)]">
          {filtered.map(({ contact, idx }) => {
            const checked = selection.has(idx);
            return (
              <li key={idx}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                    checked ? "bg-[var(--primary-soft)]/50" : "hover:bg-[var(--surface-muted)]",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(idx)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{contact.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {formatPhoneEs(contact.phone)}
                      {contact.studentName ? ` · ${contact.studentName}` : ""}
                      {contact.level ? ` · Nivel ${contact.level}` : ""}
                    </p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ExcelImporter({
  imported,
  mapping,
  onImported,
  onMappingChange,
}: {
  imported: ImportedSheet | null;
  mapping: Mapping | null;
  onImported: (sheet: ImportedSheet) => void;
  onMappingChange: (mapping: Mapping) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function processFile(file: File) {
    setParsing(true);
    try {
      const lower = file.name.toLowerCase();
      const delimiter: "," | "\t" =
        lower.endsWith(".tsv") || file.type === "text/tab-separated-values" ? "\t" : ",";
      const isSupported =
        lower.endsWith(".csv") ||
        lower.endsWith(".tsv") ||
        file.type === "text/csv" ||
        file.type === "text/tab-separated-values";
      if (!isSupported) {
        toast.error("Formato no soportado", {
          description: "Por seguridad, importa contactos en CSV o TSV.",
        });
        return;
      }
      if (file.size > 1024 * 1024) {
        toast.error("Archivo demasiado grande", {
          description: "Sube un CSV/TSV de hasta 1 MB.",
        });
        return;
      }

      const text = await readTextAuto(file);
      const { headers, rows } = parseDelimited(text, delimiter);
      if (headers.length === 0) {
        toast.error("El archivo está vacío");
        return;
      }
      if (rows.length === 0) {
        toast.error("No hay filas con datos");
        return;
      }
      if (rows.length > 5000) {
        toast.error("Demasiadas filas", {
          description: "Divide el envío en archivos de 5.000 contactos como máximo.",
        });
        return;
      }
      onImported({ headers, rows, fileName: file.name });
      toast.success(`Detectadas ${rows.length} filas`);
    } catch (error) {
      toast.error("No hemos podido leer el archivo", {
        description: error instanceof Error ? error.message : "Formato no soportado",
      });
    } finally {
      setParsing(false);
    }
  }

  async function readTextAuto(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return new TextDecoder("utf-8").decode(bytes.slice(3));
    }
    const strict = new TextDecoder("utf-8", { fatal: true });
    try {
      return strict.decode(bytes);
    } catch {
      return new TextDecoder("windows-1252").decode(bytes);
    }
  }

  function parseDelimited(text: string, delimiter: "," | "\t") {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === "\"") {
        if (inQuotes && next === "\"") {
          cell += "\"";
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && char === delimiter) {
        row.push(cell.trim());
        cell = "";
        continue;
      }

      if (!inQuotes && (char === "\n" || char === "\r")) {
        if (char === "\r" && next === "\n") i++;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += char;
    }

    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);

    const headers = (rows.shift() ?? [])
      .map((header, index) => header || `Columna ${index + 1}`)
      .map((header) => header.trim());
    const dataRows = rows.map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])),
    );

    return { headers, rows: dataRows };
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) processFile(file);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragging
            ? "border-[var(--primary)] bg-[var(--primary-soft)]"
            : "border-[var(--border-strong)] bg-[var(--surface-muted)]",
        )}
      >
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-[var(--primary)] shadow-[var(--shadow-sm)]">
          <UploadCloud className="h-7 w-7" />
        </span>
        <p className="mt-4 text-sm font-semibold">
          {imported ? `Archivo cargado: ${imported.fileName}` : "Arrastra aquí tu CSV o TSV"}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          .csv · .tsv — da igual el orden de las columnas, las mapeamos contigo.
        </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={parsing}
          >
            {imported ? "Cambiar archivo" : "Elegir desde el ordenador"}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {imported && mapping && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Detectadas {imported.rows.length} filas</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Confirma qué columna es el nombre y cuál el teléfono.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onImported({
                  headers: [],
                  rows: [],
                  fileName: "",
                })
              }
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)]"
            >
              <X className="h-3 w-3" /> Quitar archivo
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Columna con el nombre" required>
              <Select
                value={mapping.name}
                onChange={(e) => onMappingChange({ ...mapping, name: e.target.value })}
              >
                <option value="">— Elige columna —</option>
                {imported.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Columna con el teléfono" required hint="Se aceptan 600 123 456, +34…, 0034…">
              <Select
                value={mapping.phone}
                onChange={(e) => onMappingChange({ ...mapping, phone: e.target.value })}
              >
                <option value="">— Elige columna —</option>
                {imported.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Primeras 4 filas detectadas
            </p>
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="min-w-full text-xs">
                <thead className="bg-[var(--surface-muted)] text-left uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    {imported.headers.map((header) => (
                      <th key={header} className="px-3 py-2">
                        {header}
                        {header === mapping.name && (
                          <Badge className="ml-2" tone="primary">
                            Nombre
                          </Badge>
                        )}
                        {header === mapping.phone && (
                          <Badge className="ml-2" tone="info">
                            Teléfono
                          </Badge>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {imported.rows.slice(0, 4).map((row, idx) => (
                    <tr key={idx} className="border-t border-[var(--border)]">
                      {imported.headers.map((header) => (
                        <td key={header} className="px-3 py-2">
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function extractVariables(body: string): string[] {
  const variables = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(VARIABLE_PATTERN.source, "g");
  while ((match = regex.exec(body))) variables.add(match[1]);
  return Array.from(variables);
}

function renderTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(VARIABLE_PATTERN, (_, key) => variables[String(key)] || `{{${key}}}`);
}

function sampleVariables(keys: string[]): Record<string, string> {
  const sample: Record<string, string> = {};
  keys.forEach((key, idx) => {
    sample[String(key)] = `Ejemplo ${idx + 1}`;
  });
  return sample;
}

function detectColumn(headers: string[], candidates: string[]): string {
  const normalized = headers.map((header) =>
    header.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
  );
  for (const candidate of candidates) {
    const idx = normalized.findIndex((header) => header.includes(candidate));
    if (idx !== -1) return headers[idx];
  }
  return "";
}

function categoryLabel(category: Template["category"]): string {
  if (category === "recibo") return "Recibo";
  if (category === "promocion") return "Promoción";
  if (category === "evento") return "Evento";
  if (category === "inscripcion") return "Inscripción";
  return "Galería";
}

function QuickContactsBuilder({
  contacts,
  onChange,
}: {
  contacts: QuickContact[];
  onChange: (next: QuickContact[]) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bulk, setBulk] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  function addContact() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      toast.error("Falta el nombre");
      return;
    }
    const normalizedPhone = normalizeValidWhatsappPhone(trimmedPhone);
    if (!normalizedPhone) {
      toast.error("Teléfono no válido");
      return;
    }
    if (contacts.some((c) => normalizeValidWhatsappPhone(c.phone) === normalizedPhone)) {
      toast.error("Ese teléfono ya está en la lista");
      return;
    }
    onChange([
      ...contacts,
      { id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: trimmedName, phone: trimmedPhone },
    ]);
    setName("");
    setPhone("");
    nameRef.current?.focus();
  }

  function removeContact(id: string) {
    onChange(contacts.filter((c) => c.id !== id));
  }

  function clearAll() {
    if (contacts.length === 0) return;
    if (!confirm(`Quitar los ${contacts.length} contactos añadidos?`)) return;
    onChange([]);
  }

  function importBulk() {
    const text = bulk.trim();
    if (!text) return;
    const lines = text.split(/\r?\n/);
    const next: QuickContact[] = [...contacts];
    let added = 0;
    let skipped = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      // Separadores admitidos: coma, punto y coma, tabulador, guion " - ", pipe
      const parts = line.split(/\s*[,;|\t]\s*|\s+-\s+/);
      let parsedName = "";
      let parsedPhone = "";
      if (parts.length >= 2) {
        parsedName = parts[0]?.trim() ?? "";
        parsedPhone = parts[1]?.trim() ?? "";
      } else {
        // Si sólo hay una "parte" intentamos separar por el primer dígito
        const match = line.match(/^(.*?)([+\d][\d\s().+-]{5,})$/);
        if (match) {
          parsedName = match[1].trim();
          parsedPhone = match[2].trim();
        }
      }
      const normalized = normalizeValidWhatsappPhone(parsedPhone);
      if (!parsedName || !normalized) {
        skipped++;
        continue;
      }
      if (next.some((c) => normalizeValidWhatsappPhone(c.phone) === normalized)) {
        skipped++;
        continue;
      }
      next.push({
        id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${added}`,
        name: parsedName,
        phone: parsedPhone,
      });
      added++;
    }
    onChange(next);
    setBulk("");
    if (added > 0 && skipped === 0) toast.success(`${added} contactos añadidos`);
    else if (added > 0 && skipped > 0)
      toast.warning(`${added} añadidos, ${skipped} descartados`, {
        description: "Líneas vacías, sin teléfono válido o duplicadas.",
      });
    else toast.error("No se pudo importar ningún contacto");
  }

  const validCount = contacts.filter((c) => normalizeValidWhatsappPhone(c.phone)).length;
  const invalidCount = contacts.length - validCount;

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="mb-3 text-sm font-semibold">Añadir contacto</p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Nombre">
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="María García"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addContact();
                }
              }}
            />
          </Field>
          <Field label="Teléfono" hint="Se aceptan +34, 0034 o el móvil sin prefijo">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 600 123 456"
              inputMode="tel"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addContact();
                }
              }}
            />
          </Field>
          <div className="flex items-end">
            <Button type="button" iconLeft={<Plus className="h-4 w-4" />} onClick={addContact}>
              Añadir
            </Button>
          </div>
        </div>
      </div>

      <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          ¿Tienes una lista para pegar?
        </summary>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Pega una línea por contacto con el formato <code className="rounded bg-[var(--surface-muted)] px-1">Nombre, +34 600 123 456</code>. Acepta coma, punto y coma, tabulador o guion como separador.
        </p>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={4}
          className="mt-3 min-h-[120px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm outline-none transition-colors placeholder:text-[var(--muted)] hover:border-[var(--border-strong)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--ring)]"
          placeholder={`María García, +34 600 123 456\nJavier Fernández, 612 345 678`}
        />
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!bulk.trim()}
            onClick={importBulk}
          >
            Importar líneas
          </Button>
        </div>
      </details>

      {contacts.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {contacts.length} {contacts.length === 1 ? "contacto añadido" : "contactos añadidos"}
            </p>
            <div className="flex items-center gap-2">
              {invalidCount > 0 && (
                <Badge tone="warning">{invalidCount} sin teléfono válido</Badge>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
                Quitar todos
              </Button>
            </div>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            <AnimatePresence initial={false}>
              {contacts.map((contact) => {
                const normalized = normalizeValidWhatsappPhone(contact.phone);
                return (
                  <motion.li
                    key={contact.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{contact.name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {normalized ? formatPhoneEs(contact.phone) : `${contact.phone} — sin teléfono válido`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeContact(contact.id)}
                      className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                      aria-label={`Quitar ${contact.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  );
}
