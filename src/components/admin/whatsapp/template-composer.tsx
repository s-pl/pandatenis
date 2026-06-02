"use client";

import { Send, AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sendTemplateMessage } from "@/lib/admin/actions/whatsapp";
import { cn } from "@/lib/utils";

export type ApprovedTemplate = {
  id: string;
  name: string;
  body: string;
  language: string;
  category: string;
  componentsSchema: {
    body?: { variables?: string[] };
    header?: {
      type: "DOCUMENT" | "IMAGE" | "VIDEO";
      storagePath: string;
      filename: string;
      mimeType: string;
    } | null;
    raw?: unknown;
  } | null;
};

const EMPTY_DEFAULT_VARIABLES: Record<string, string> = {};
type MediaHeaderType = "DOCUMENT" | "IMAGE" | "VIDEO";

function metaMediaHeaderType(raw: unknown): MediaHeaderType | null {
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

function templateMediaIssue(template: ApprovedTemplate | null): string | null {
  if (!template) return null;
  const metaHeader = metaMediaHeaderType(template.componentsSchema?.raw);
  const localHeader = template.componentsSchema?.header ?? null;
  if (metaHeader && !localHeader) {
    return `Meta espera una cabecera ${metaHeader}, pero falta asociar el archivo local en Plantillas.`;
  }
  if (metaHeader && localHeader && metaHeader !== localHeader.type) {
    return `Meta espera ${metaHeader}, pero el archivo local es ${localHeader.type}.`;
  }
  if (localHeader && !metaHeader) {
    return `Hay un archivo ${localHeader.type} local, pero Meta aún no confirma esa cabecera. Sincroniza la plantilla antes de enviarla.`;
  }
  return null;
}

export function TemplateComposer({
  phone,
  recipientName,
  templates,
  defaultVariables,
  onSent,
}: {
  phone: string;
  recipientName: string | null;
  templates: ApprovedTemplate[];
  defaultVariables?: Record<string, string>;
  onSent?: (data: { id: string; status: "sent" | "queued"; notice?: string }) => void | Promise<void>;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [variableState, setVariableState] = useState<{
    key: string;
    values: Record<string, string>;
  }>({ key: "", values: {} });
  const [pending, startTransition] = useTransition();

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const variableKeys = useMemo(() => extractVariableKeys(template), [template]);
  const variableDefaults = defaultVariables ?? EMPTY_DEFAULT_VARIABLES;
  const defaultVariablesKey = useMemo(() => JSON.stringify(variableDefaults), [variableDefaults]);
  const stateKey = `${phone}:${template?.id ?? ""}:${defaultVariablesKey}`;

  const variables = useMemo(() => {
    if (!template) {
      return {};
    }
    if (variableState.key === stateKey) {
      return variableState.values;
    }
    const next: Record<string, string> = {};
    for (const key of variableKeys) {
      next[key] = variableDefaults[key] ?? "";
    }
    return next;
  }, [stateKey, template, variableDefaults, variableKeys, variableState]);

  const preview = useMemo(() => {
    if (!template) return "";
    return template.body.replace(/\{\{(\d+|[a-zA-Z_]\w*)\}\}/g, (_, key) =>
      variables[String(key)] ? variables[String(key)] : `{{${key}}}`,
    );
  }, [template, variables]);

  const missing = variableKeys.filter((key) => !variables[key]?.trim());
  const mediaIssue = templateMediaIssue(template);
  const canSend = Boolean(template) && missing.length === 0 && !mediaIssue;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!template || !canSend || pending) return;
    startTransition(async () => {
      const result = await sendTemplateMessage({
        phone,
        templateId: template.id,
        variables,
        recipientName: recipientName ?? undefined,
      });
      if (result.ok) {
        toast.success("Plantilla enviada", {
          description:
            result.data?.notice ??
            "Cuando la familia responda, podrás escribirle texto libre durante 24 h.",
        });
        if (result.data) await onSent?.(result.data);
        router.refresh();
      } else {
        toast.error("No se ha podido enviar", { description: result.error });
      }
    });
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-[var(--warning)]">
          <AlertTriangle className="h-4 w-4" /> No tienes plantillas aprobadas todavía
        </div>
        <p className="text-xs text-[var(--muted)]">
          Crea y aprueba una plantilla en Meta Business Manager, márcala como{" "}
          <code className="rounded bg-[var(--surface-muted)] px-1">approved</code> en{" "}
          <Link href="/admin/whatsapp" className="text-[var(--primary)] hover:underline">
            Envíos y plantillas
          </Link>{" "}
          y vuelve aquí para iniciar la conversación.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:px-4 print:hidden"
    >
      <div className="rounded-2xl border border-[#f1d9a8] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
        Ventana de 24 h cerrada — usa una plantilla aprobada para iniciar la conversación.
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Plantilla
          </label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="h-10 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--ring)]"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.language}
              </option>
            ))}
          </select>

          {variableKeys.length > 0 && (
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Variables
              </label>
              <div className="grid gap-2">
                {variableKeys.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-12 flex-shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-center font-mono text-[11px] text-[var(--muted)]">
                      {`{{${key}}}`}
                    </span>
                    <input
                      type="text"
                      value={variables[key] ?? ""}
                      onChange={(e) =>
                        setVariableState({
                          key: stateKey,
                          values: { ...variables, [key]: e.target.value },
                        })
                      }
                      placeholder={`Valor para {{${key}}}`}
                      className="flex-1 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--ring)]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Vista previa
            </label>
            {template && <Badge tone="neutral">{template.category}</Badge>}
          </div>
          <div className="min-h-[96px] rounded-2xl border border-[var(--border)] bg-[#d9fdd3] px-3 py-2 text-sm leading-snug text-[#111b21]">
            {preview || "Selecciona una plantilla para ver el preview."}
          </div>
          {missing.length > 0 && (
            <p className="text-xs text-[var(--muted)]">
              Faltan {missing.length} {missing.length === 1 ? "variable" : "variables"} por rellenar.
            </p>
          )}
          {mediaIssue && (
            <div className="rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-3 py-2 text-xs font-medium text-[var(--warning)]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{mediaIssue}</span>
              </div>
              <Link href="/admin/whatsapp" className="mt-1 inline-block font-bold underline">
                Abrir plantillas
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={pending}
          disabled={!canSend}
          iconLeft={pending ? null : <Send className="h-4 w-4" />}
          className={cn("h-11", !canSend && "opacity-60")}
        >
          {pending ? "Enviando…" : "Enviar plantilla"}
        </Button>
      </div>
    </form>
  );
}

function extractVariableKeys(template: ApprovedTemplate | null): string[] {
  if (!template) return [];
  if (template.componentsSchema?.body?.variables?.length) {
    return template.componentsSchema.body.variables;
  }
  const found = new Set<string>();
  const regex = /\{\{(\d+|[a-zA-Z_]\w*)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template.body))) {
    found.add(match[1]);
  }
  return Array.from(found);
}
