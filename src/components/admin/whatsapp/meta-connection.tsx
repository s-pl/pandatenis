"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  KeyRound,
  Layers3,
  Loader2,
  RefreshCcw,
  Shield,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type DiagResponse = {
  configured: boolean;
  provider: "meta";
  env: {
    hasAccessToken: boolean;
    hasPhoneNumberId: boolean;
    hasWabaId: boolean;
    hasAppSecret: boolean;
    hasVerifyToken: boolean;
  };
  phone?: {
    reachable: boolean;
    status?: string;
    phoneNumberId?: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
    lastError?: string | null;
    elapsedMs?: number;
  };
  waba?: {
    reachable: boolean;
    wabaId?: string;
    name?: string | null;
    currency?: string | null;
    templatesCount?: number | null;
    lastError?: string | null;
    elapsedMs?: number;
  };
  inbound?: {
    last24h: number;
    lastReceivedAt: string | null;
    lastFrom: string | null;
    lastBody: string | null;
    minutesSinceLast: number | null;
  };
  hints: string[];
};

export function MetaConnection({ initialOrigin }: { initialOrigin: string }) {
  const [data, setData] = useState<DiagResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const webhookUrl = `${initialOrigin.replace(/\/+$/, "")}/api/whatsapp/inbound`;

  const fetchDiag = useCallback(async (manual = false) => {
    try {
      if (manual) setRefreshing(true);
      const response = await fetch("/api/whatsapp/diag", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as DiagResponse;
      setData(json);
    } catch (error) {
      toast.error("No se ha podido leer el estado", {
        description: error instanceof Error ? error.message : "Inténtalo de nuevo",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const didInitialFetchRef = useRef(false);
  useEffect(() => {
    if (didInitialFetchRef.current) return;
    didInitialFetchRef.current = true;
    void fetchDiag();
  }, [fetchDiag]);

  function copy(value: string, label: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copiado al portapapeles`))
      .catch(() => toast.error("No se ha podido copiar"));
  }

  const qualityTone =
    data?.phone?.qualityRating === "GREEN"
      ? "success"
      : data?.phone?.qualityRating === "YELLOW"
        ? "warning"
        : data?.phone?.qualityRating === "RED"
          ? "danger"
          : "neutral";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader
          title="Número conectado a Meta"
          description="Información del número emisor en WhatsApp Business Cloud API."
          actions={
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={refreshing}
              iconLeft={<RefreshCcw className="h-3.5 w-3.5" />}
              onClick={() => fetchDiag(true)}
            >
              Refrescar
            </Button>
          }
        />
        <CardBody>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Leyendo estado…
            </div>
          ) : !data?.configured ? (
            <ConfigMissing />
          ) : data.phone?.reachable ? (
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Conectado</p>
                  <p className="text-xs text-[var(--muted)]">
                    {data.phone.verifiedName ?? "Sin nombre verificado"}
                  </p>
                </div>
                <Badge tone={qualityTone} className="ml-auto">
                  Calidad {data.phone.qualityRating ?? "—"}
                </Badge>
              </div>
              <dl className="grid gap-2 text-sm">
                <Row label="Número" value={data.phone.displayPhoneNumber ?? "—"} onCopy={data.phone.displayPhoneNumber ? () => copy(data.phone!.displayPhoneNumber!, "Número") : undefined} />
                <Row label="Phone number ID" value={data.phone.phoneNumberId ?? "—"} mono onCopy={data.phone.phoneNumberId ? () => copy(data.phone!.phoneNumberId!, "Phone number ID") : undefined} />
                <Row label="Tiempo de respuesta" value={`${data.phone.elapsedMs ?? "?"} ms`} />
              </dl>
            </div>
          ) : (
            <div className="grid gap-3 rounded-2xl border border-[#f1c5c5] bg-[var(--danger-soft)] p-4">
              <div className="flex items-center gap-2 text-[var(--danger)]">
                <AlertTriangle className="h-4 w-4" /> Meta no responde
              </div>
              <p className="text-sm text-[var(--danger)]">
                {data.phone?.lastError ?? "Error desconocido"}
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Webhook entrante"
          description="Configura esta URL en Meta Business Manager → WhatsApp → Configuración."
        />
        <CardBody className="space-y-4">
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              URL del webhook
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
              <code className="flex-1 truncate text-xs">{webhookUrl}</code>
              <button
                type="button"
                onClick={() => copy(webhookUrl, "URL del webhook")}
                aria-label="Copiar"
                className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-white"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Verify token
            </label>
            <p className="text-xs text-[var(--muted)]">
              Usa el valor que pusiste en{" "}
              <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5">META_WEBHOOK_VERIFY_TOKEN</code>
              {" "}al hacer el handshake. Mantenlo en secreto.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)]">
            <p className="mb-1 inline-flex items-center gap-1 font-semibold text-foreground">
              <Shield className="h-3.5 w-3.5" /> Campos que tienes que suscribir
            </p>
            <ul className="ml-5 list-disc">
              <li>
                <code className="rounded bg-white px-1 py-0.5">messages</code> — entrantes y reacciones
              </li>
              <li>
                <code className="rounded bg-white px-1 py-0.5">message_template_status_update</code> — para enterarte cuando Meta aprueba o rechaza tus plantillas
              </li>
            </ul>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Cuenta WABA y plantillas"
          description="Comprueba que el token apunta a la cuenta de WhatsApp donde miras las plantillas en Meta."
          actions={
            <Link href="/admin/whatsapp">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                iconLeft={<Layers3 className="h-3.5 w-3.5" />}
              >
                Plantillas
              </Button>
            </Link>
          }
        />
        <CardBody>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Revisando WABA…
            </div>
          ) : !data?.env.hasWabaId ? (
            <div className="grid gap-3 rounded-2xl border border-dashed border-[var(--border-strong)] p-4 text-sm">
              <p className="font-semibold">Falta META_WABA_ID</p>
              <p className="text-[var(--muted)]">
                Sin este ID el panel puede enviar mensajes, pero no puede sincronizar ni crear
                plantillas con seguridad.
              </p>
            </div>
          ) : data.waba?.reachable ? (
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {data.waba.name ?? "WABA accesible"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Meta devuelve esta cuenta con el token actual.
                  </p>
                </div>
                <Badge tone="success" className="ml-auto">
                  Activa
                </Badge>
              </div>
              <dl className="grid gap-2 text-sm">
                <Row
                  label="WABA ID"
                  value={data.waba.wabaId ?? "—"}
                  mono
                  onCopy={data.waba.wabaId ? () => copy(data.waba!.wabaId!, "WABA ID") : undefined}
                />
                <Row
                  label="Plantillas Meta"
                  value={
                    data.waba.templatesCount === null || data.waba.templatesCount === undefined
                      ? "No disponible"
                      : String(data.waba.templatesCount)
                  }
                />
                <Row
                  label="Tiempo de respuesta"
                  value={`${data.waba.elapsedMs ?? "?"} ms`}
                />
              </dl>
            </div>
          ) : (
            <div className="grid gap-3 rounded-2xl border border-[#f1c5c5] bg-[var(--danger-soft)] p-4">
              <div className="flex items-center gap-2 text-[var(--danger)]">
                <AlertTriangle className="h-4 w-4" /> WABA no accesible
              </div>
              <p className="text-sm text-[var(--danger)]">
                {data?.waba?.lastError ?? "El token no puede leer esta cuenta de WhatsApp."}
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Checklist de credenciales"
          description="Solo mostramos si existen; nunca el valor real de los secretos."
        />
        <CardBody className="grid gap-2 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Leyendo entorno…
            </div>
          ) : data ? (
            <>
              <SecretSignal ok={data.env.hasAccessToken} label="Access token" />
              <SecretSignal ok={data.env.hasPhoneNumberId} label="Phone number ID" />
              <SecretSignal ok={data.env.hasWabaId} label="WABA ID" />
              <SecretSignal ok={data.env.hasAppSecret} label="App secret para firma" />
              <SecretSignal ok={data.env.hasVerifyToken} label="Verify token webhook" />
            </>
          ) : (
            <p className="text-[var(--muted)]">No se pudo cargar el diagnóstico.</p>
          )}
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title="Recepción de mensajes"
          description="Lo que ha llegado por el webhook recientemente."
          actions={
            data?.inbound?.last24h !== undefined ? (
              <Badge tone={data.inbound.last24h > 0 ? "primary" : "warning"}>
                {data.inbound.last24h} inbound en 24 h
              </Badge>
            ) : null
          }
        />
        <CardBody className="grid gap-3">
          {data?.inbound?.lastReceivedAt ? (
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-medium">Último mensaje:</span>
              <span className="text-[var(--muted)]">{data.inbound.lastFrom}</span>
              <span className="text-[var(--muted)]">·</span>
              <span className="truncate text-[var(--muted)]">{data.inbound.lastBody ?? "—"}</span>
              <span className="ml-auto text-xs text-[var(--muted)]">
                hace {data.inbound.minutesSinceLast ?? 0} min
              </span>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Aún no se ha registrado ningún inbound. Pide a un compañero que te escriba para validar.
            </p>
          )}
          {(data?.hints ?? []).length > 0 && (
            <ul className="grid gap-2">
              {data!.hints.map((hint, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 rounded-2xl border border-[#f1d9a8] bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)]"
                >
                  <ClipboardCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          )}
          <a
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 self-start text-xs text-[var(--primary)] hover:underline"
          >
            Documentación oficial de Meta <ExternalLink className="h-3 w-3" />
          </a>
        </CardBody>
      </Card>
    </div>
  );
}

function SecretSignal({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2">
      <span
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full",
          ok
            ? "bg-[var(--success-soft)] text-[var(--success)]"
            : "bg-[var(--warning-soft)] text-[var(--warning)]",
        )}
      >
        {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
      </span>
      <span className="font-medium">{label}</span>
      <Badge tone={ok ? "success" : "warning"} className="ml-auto">
        {ok ? "OK" : "Falta"}
      </Badge>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-sm">
      <span className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className={cn("ml-auto truncate", mono && "font-mono text-xs")}>{value}</span>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] hover:bg-white"
          aria-label={`Copiar ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ConfigMissing() {
  return (
    <div className="grid gap-3 rounded-2xl border border-dashed border-[var(--border-strong)] p-4 text-sm">
      <p className="font-semibold">Meta WhatsApp aún no está configurado</p>
      <p className="text-[var(--muted)]">
        Define estas variables en <code className="rounded bg-[var(--surface-muted)] px-1">.env.local</code> y reinicia el panel:
      </p>
      <pre className="overflow-x-auto rounded-xl bg-[var(--surface-muted)] p-3 text-xs">
{`META_WHATSAPP_ACCESS_TOKEN=...   # System user token con whatsapp_business_messaging
META_PHONE_NUMBER_ID=...
META_WABA_ID=...
META_APP_SECRET=...              # Para validar HMAC del webhook
META_WEBHOOK_VERIFY_TOKEN=...    # Lo eliges tú, Meta lo usará al hacer handshake
META_GRAPH_API_VERSION=v20.0     # opcional`}
      </pre>
    </div>
  );
}
