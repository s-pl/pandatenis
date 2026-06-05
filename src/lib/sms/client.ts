import "server-only";

/**
 * Cliente SMS sobre la API REST de Twilio (sin SDK, vía fetch — funciona en
 * Vercel Functions sin añadir dependencias).
 *
 * Configuración por variables de entorno:
 *   TWILIO_ACCOUNT_SID   SID de la cuenta (empieza por "AC").
 *   TWILIO_AUTH_TOKEN    Token de autenticación.
 *   TWILIO_FROM          Remitente: número en formato E.164 (+34...) o, si la
 *                        cuenta lo permite, un Sender ID alfanumérico
 *                        (p. ej. "Panda Tenis").
 *
 * Si falta configuración, `sendSms` devuelve estado "skipped" sin lanzar, de
 * modo que el flujo de negocio (marcar un pago, etc.) nunca se rompe por SMS.
 */

export type SmsResult =
  | { status: "sent"; sid: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

function isConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM,
  );
}

/**
 * Normaliza un teléfono a E.164. Asume España (+34) cuando no hay prefijo
 * internacional. Devuelve null si no parece un móvil válido.
 */
export function toE164(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  // Quita separadores comunes.
  let digits = trimmed.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) {
    const rest = digits.slice(1).replace(/\D/g, "");
    return rest.length >= 8 ? `+${rest}` : null;
  }
  const onlyDigits = digits.replace(/\D/g, "");
  if (!onlyDigits) return null;
  // Sin prefijo: si son 9 dígitos lo tratamos como número español.
  if (onlyDigits.length === 9) return `+34${onlyDigits}`;
  return `+${onlyDigits}`;
}

export async function sendSms(
  to: string,
  body: string,
  opts?: { statusCallback?: string },
): Promise<SmsResult> {
  const e164 = toE164(to);
  if (!e164) return { status: "failed", error: `Teléfono inválido: ${to}` };

  if (!isConfigured()) {
    console.info(`[sms:skipped] (Twilio no configurado) → ${e164}: ${body}`);
    return { status: "skipped", reason: "Twilio no configurado" };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM!;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  const params = new URLSearchParams();
  params.set("To", e164);
  params.set("Body", body);
  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else {
    params.set("From", from);
  }
  // Twilio notificará el estado de entrega final a esta URL (delivered/undelivered).
  if (opts?.statusCallback) params.set("StatusCallback", opts.statusCallback);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    const data = (await res.json()) as { sid?: string; message?: string };
    if (!res.ok) {
      return { status: "failed", error: data.message ?? `HTTP ${res.status}` };
    }
    return { status: "sent", sid: data.sid ?? "" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Error de red" };
  }
}
