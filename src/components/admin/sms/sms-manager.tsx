"use client";

import { FormEvent, useState, useTransition } from "react";
import { MessageSquare, Pencil, Plus, Send, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatPhoneEs, relativeTime } from "@/lib/format";
import {
  createSmsTemplateAction,
  deleteSmsTemplateAction,
  sendSmsCampaignAction,
  updateSmsTemplateAction,
  type SmsTemplateInput,
} from "@/lib/admin/actions/sms";

export type SmsTemplate = { id: string; name: string; bodyEs: string; bodyEn: string };
export type SmsHistoryItem = {
  id: string;
  phone: string;
  body: string;
  kind: string;
  locale: "es" | "en";
  status: string;
  createdAt: string;
};

type Audience = "leads" | "students" | "both";
type LocaleFilter = "all" | "es" | "en";

const STATUS_META: Record<string, { tone: "neutral" | "info" | "success" | "warning" | "danger"; label: string }> = {
  queued: { tone: "neutral", label: "En cola" },
  sent: { tone: "info", label: "Enviado" },
  delivered: { tone: "success", label: "Entregado" },
  failed: { tone: "danger", label: "Fallido" },
  undelivered: { tone: "danger", label: "No entregado" },
  skipped: { tone: "warning", label: "Omitido" },
};

const KIND_LABELS: Record<string, string> = {
  promo: "Promoción",
  campaign: "Campaña",
  welcome: "Bienvenida",
  payment_confirm: "Pago confirmado",
  payment_reminder: "Recordatorio",
};

const AUDIENCE_OPTIONS: Array<[Audience, string]> = [
  ["both", "Leads + alumnos"],
  ["leads", "Solo leads"],
  ["students", "Solo alumnos"],
];

export function SmsManager({
  templates,
  history,
}: {
  templates: SmsTemplate[];
  history: SmsHistoryItem[];
}) {
  const router = useRouter();
  const [bodyEs, setBodyEs] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [audience, setAudience] = useState<Audience>("both");
  const [localeFilter, setLocaleFilter] = useState<LocaleFilter>("all");
  const [templateId, setTemplateId] = useState("");
  const [sending, startSend] = useTransition();

  // Plantillas
  const [editing, setEditing] = useState<SmsTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingTpl, setDeletingTpl] = useState<SmsTemplate | null>(null);
  const [tplPending, startTpl] = useTransition();

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setBodyEs(tpl.bodyEs);
      setBodyEn(tpl.bodyEn);
    }
  }

  function send() {
    if (bodyEs.trim().length < 2) {
      toast.error("Escribe el mensaje en español");
      return;
    }
    startSend(async () => {
      const result = await sendSmsCampaignAction({ bodyEs, bodyEn, audience, localeFilter });
      if (result.ok) {
        const d = result.data!;
        toast.success(`SMS enviados: ${d.sent}/${d.total}`, {
          description: `${d.skipped} omitidos · ${d.failed} fallidos`,
        });
        router.refresh();
      } else {
        toast.error("No se ha podido enviar", { description: result.error });
      }
    });
  }

  function confirmDeleteTpl() {
    if (!deletingTpl) return;
    const target = deletingTpl;
    setDeletingTpl(null);
    startTpl(async () => {
      const result = await deleteSmsTemplateAction(target.id);
      if (result.ok) {
        toast.success("Plantilla eliminada");
        router.refresh();
      } else {
        toast.error("No se ha podido eliminar", { description: result.error });
      }
    });
  }

  return (
    <div className="grid gap-4">
      {/* Compositor de campaña */}
      <Card>
        <CardHeader
          title="Nueva campaña SMS"
          description="Se envía a los contactos con teléfono, sin duplicar números. Los leads convertidos a alumno no se duplican."
        />
        <CardBody className="grid gap-4">
          <div>
            <p className="mb-2 text-[12.5px] font-bold text-foreground">Audiencia</p>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAudience(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    audience === value
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Filtrar por idioma">
              <Select value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value as LocaleFilter)}>
                <option value="all">Todos</option>
                <option value="es">Español</option>
                <option value="en">English</option>
              </Select>
            </Field>
            {templates.length > 0 && (
              <Field label="Cargar plantilla">
                <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">— Sin plantilla —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <Field label="Mensaje (español)" hint={`${bodyEs.length} caracteres`} required>
            <Textarea value={bodyEs} onChange={(e) => setBodyEs(e.target.value)} rows={3} maxLength={600} />
          </Field>
          <Field
            label="Mensaje (inglés)"
            hint="Opcional. Si lo dejas vacío, a los contactos en inglés se les envía el texto en español."
          >
            <Textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} rows={3} maxLength={600} />
          </Field>

          <div className="flex justify-end">
            <Button onClick={send} loading={sending} iconLeft={<Send className="h-4 w-4" />}>
              Enviar campaña
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Plantillas */}
      <Card>
        <CardHeader
          title="Plantillas"
          description="Mensajes reutilizables para no reescribir cada campaña."
          actions={
            <Button variant="secondary" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Nueva plantilla
            </Button>
          }
        />
        <CardBody>
          {templates.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-[var(--muted)]">Aún no hay plantillas.</p>
          ) : (
            <ul className="grid gap-2">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                      <FileText className="h-3.5 w-3.5 text-[var(--muted)]" />
                      {t.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] text-[var(--muted)]">{t.bodyEs}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]"
                      aria-label="Editar plantilla"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingTpl(t)}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                      aria-label="Eliminar plantilla"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader title="Historial de envíos" description="Últimos SMS enviados y su estado de entrega." />
        <CardBody>
          {history.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title="Sin envíos todavía"
              description="Cuando envíes una campaña o se disparen SMS automáticos, aparecerán aquí."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-2 pr-3">Contacto</th>
                    <th className="py-2 pr-3">Mensaje</th>
                    <th className="hidden py-2 pr-3 sm:table-cell">Tipo</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="hidden py-2 pr-3 md:table-cell">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((m) => {
                    const meta = STATUS_META[m.status] ?? { tone: "neutral" as const, label: m.status };
                    return (
                      <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-2.5 pr-3 align-top font-medium">{formatPhoneEs(m.phone)}</td>
                        <td className="max-w-[280px] py-2.5 pr-3 align-top text-[var(--muted)]">
                          <span className="line-clamp-2">{m.body}</span>
                        </td>
                        <td className="hidden py-2.5 pr-3 align-top sm:table-cell">
                          <Badge tone="neutral">{KIND_LABELS[m.kind] ?? m.kind}</Badge>
                        </td>
                        <td className="py-2.5 pr-3 align-top">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </td>
                        <td className="hidden py-2.5 pr-3 align-top text-[var(--muted)] md:table-cell">
                          {relativeTime(m.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva plantilla SMS" size="md">
        <TemplateForm onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); router.refresh(); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar plantilla" size="md">
        {editing && (
          <TemplateForm
            template={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); router.refresh(); }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deletingTpl}
        onClose={() => setDeletingTpl(null)}
        onConfirm={confirmDeleteTpl}
        title="¿Eliminar plantilla?"
        description={deletingTpl ? `Vas a eliminar la plantilla "${deletingTpl.name}".` : ""}
        confirmLabel="Sí, eliminar"
      />
      {tplPending && <span className="sr-only">Guardando…</span>}
    </div>
  );
}

function TemplateForm({
  template,
  onCancel,
  onSaved,
}: {
  template?: SmsTemplate;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<SmsTemplateInput>({
    name: template?.name ?? "",
    bodyEs: template?.bodyEs ?? "",
    bodyEn: template?.bodyEn ?? "",
  });
  const [pending, start] = useTransition();

  function set<K extends keyof SmsTemplateInput>(key: K, value: SmsTemplateInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start(async () => {
      const result = template
        ? await updateSmsTemplateAction(template.id, values)
        : await createSmsTemplateAction(values);
      if (result.ok) {
        toast.success(template ? "Plantilla actualizada" : "Plantilla creada");
        onSaved();
      } else {
        toast.error("No se ha podido guardar", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Nombre" required>
        <Input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej.: Recordatorio campus" />
      </Field>
      <Field label="Mensaje (español)" required>
        <Textarea value={values.bodyEs} onChange={(e) => set("bodyEs", e.target.value)} rows={3} maxLength={600} />
      </Field>
      <Field label="Mensaje (inglés)" required>
        <Textarea value={values.bodyEn} onChange={(e) => set("bodyEn", e.target.value)} rows={3} maxLength={600} />
      </Field>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {template ? "Guardar" : "Crear plantilla"}
        </Button>
      </div>
    </form>
  );
}
