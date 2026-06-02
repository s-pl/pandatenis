"use client";

import { MessageCircle, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  TemplateComposer,
  type ApprovedTemplate,
} from "@/components/admin/whatsapp/template-composer";
import { cn } from "@/lib/utils";

type Size = "sm" | "md";

/**
 * Botón rápido para enviar una plantilla aprobada de WhatsApp a un teléfono
 * concreto, desde cualquier pantalla del admin. Reemplaza los antiguos
 * enlaces directos a wa.me (que abrían WhatsApp Web sin pasar por Meta
 * Cloud API y no registraban el mensaje en el panel).
 *
 * - Carga las plantillas aprobadas bajo demanda al abrir el popover.
 * - Reusa <TemplateComposer> para la UI de variables y envío.
 * - Tras enviar, cierra el modal automáticamente.
 */
export function QuickTemplateButton({
  phone,
  recipientName,
  defaultVariables,
  label = "Enviar WhatsApp",
  size = "sm",
  className,
  variant = "icon",
}: {
  phone: string;
  recipientName?: string | null;
  defaultVariables?: Record<string, string>;
  label?: string;
  size?: Size;
  className?: string;
  variant?: "icon" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<ApprovedTemplate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || templates !== null) return;
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/whatsapp/templates/approved", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as { templates: ApprovedTemplate[] };
        if (!cancelled) setTemplates(json.templates ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las plantillas");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, templates]);

  const dims = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const triggerIcon =
    variant === "icon" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Enviar plantilla a ${recipientName ?? phone}`}
        aria-label={label}
        className={cn(
          dims,
          "grid place-items-center rounded-full bg-[var(--whatsapp)] text-white transition-colors hover:brightness-110",
          className,
        )}
      >
        <MessageCircle className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Enviar plantilla a ${recipientName ?? phone}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-[var(--whatsapp)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110",
          className,
        )}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {label}
      </button>
    );

  return (
    <>
      {triggerIcon}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Enviar plantilla WhatsApp"
        description={
          recipientName ? `A ${recipientName} · +${phone}` : `A +${phone}`
        }
        icon={<MessageCircle className="h-5 w-5" />}
        tone="success"
        size="md"
      >
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando plantillas…
          </div>
        )}
        {error && !loading && (
          <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        {!loading && !error && templates && templates.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning)]">
            <p>
              No tienes plantillas aprobadas todavía. Crea o aprueba una en{" "}
              <Link
                href="/admin/whatsapp"
                className="font-semibold underline"
                onClick={() => setOpen(false)}
              >
                Envíos y plantillas
              </Link>
              .
            </p>
          </div>
        )}
        {!loading && !error && templates && templates.length > 0 && (
          <TemplateComposer
            phone={phone}
            recipientName={recipientName ?? null}
            templates={templates}
            defaultVariables={defaultVariables}
            onSent={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}
