/**
 * Tipos compartidos del cliente WhatsApp (Meta Cloud API).
 *
 * Las firmas son compatibles con la integración anterior para que el resto del
 * código (server actions, componentes) no se vea afectado al cambiar el proveedor.
 */

export type WhatsappErrorKind =
  | "not_configured"
  | "invalid_phone"
  | "not_registered"
  | "not_ready"
  | "auth"
  | "rate_limited"
  | "transient"
  | "outside_window"
  | "template_required"
  | "unknown";

export type WhatsappTemplateComponent = {
  type: "header" | "body" | "footer" | "button";
  // Meta exige un sub_type para los botones; lo aceptamos como passthrough.
  sub_type?: string;
  index?: number;
  parameters?: Array<Record<string, unknown>>;
};

export type WhatsappTemplatePayload = {
  name: string;
  language: string;
  components?: WhatsappTemplateComponent[];
};

export type WhatsappSendInput = {
  to: string;
  body?: string;
  mediaUrl?: string;
  mediaCaption?: string;
  /** Nombre visible del archivo cuando se envía como documento. */
  mediaFilename?: string;
  template?: WhatsappTemplatePayload;
  delayMs?: number;
  timeoutMs?: number;
};

export type WhatsappSendResult = {
  id: string | null;
  timestamp: number;
  conversationId?: string | null;
  pricingCategory?: string | null;
};

export type MetaTemplateStatus = "pending" | "approved" | "rejected";

export type MetaMessageTemplate = {
  id: string | null;
  name: string;
  language: string;
  status: MetaTemplateStatus;
  rawStatus: string;
  category: string | null;
  body: string;
  components: Array<Record<string, unknown>>;
  rejectionReason: string | null;
  qualityScore: string | null;
};

export type WhatsappPhoneStatus = {
  configured: boolean;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: "GREEN" | "YELLOW" | "RED" | string;
  platformType?: string;
  status?: string;
  lastError?: string;
  elapsedMs?: number;
};

export class WhatsappDeliveryError extends Error {
  status?: number;
  kind: WhatsappErrorKind;
  retryable: boolean;
  code?: number;
  fbtraceId?: string;
  retryAfterSeconds?: number;
  raw?: unknown;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: number;
      kind: WhatsappErrorKind;
      retryable: boolean;
      fbtraceId?: string;
      retryAfterSeconds?: number;
      raw?: unknown;
    },
  ) {
    super(message);
    this.name = "WhatsappDeliveryError";
    this.status = options.status;
    this.code = options.code;
    this.kind = options.kind;
    this.retryable = options.retryable;
    this.fbtraceId = options.fbtraceId;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.raw = options.raw;
  }
}

export function whatsappErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Error desconocido";
}

export function isRetryableWhatsappError(error: unknown): boolean {
  if (error instanceof WhatsappDeliveryError) return error.retryable;
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    return (
      lower.includes("timeout") ||
      lower.includes("timed out") ||
      lower.includes("econnrefused") ||
      lower.includes("econnreset") ||
      lower.includes("failed to fetch") ||
      lower.includes("network")
    );
  }
  return false;
}

/**
 * Pequeño jitter para no enviar varios mensajes con timestamps idénticos.
 * Útil cuando hacemos bulk; la integración anterior lo aceptaba como input y aquí lo
 * conservamos para que el resto del código siga funcionando igual.
 */
export function jitterDelay(base = 1500, spread = 2500): number {
  return base + Math.floor(Math.random() * Math.max(0, spread));
}
