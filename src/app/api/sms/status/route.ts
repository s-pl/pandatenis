import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Webhook de estado de entrega de Twilio (StatusCallback). Twilio hace POST
 * (x-www-form-urlencoded) con MessageSid y MessageStatus cuando el SMS cambia de
 * estado. Actualizamos `sms_messages` por provider_sid. Corre con service role
 * (sin sesión) y valida la firma X-Twilio-Signature.
 */

// Mapea el estado de Twilio a los estados de nuestra tabla.
const STATUS_MAP: Record<string, string> = {
  delivered: "delivered",
  undelivered: "undelivered",
  failed: "failed",
  sent: "sent",
};

/** Valida la firma de Twilio: base64(HMAC-SHA1(url + params ordenados, authToken)). */
function isValidSignature(url: string, params: Record<string, string>, signature: string): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join("");
  const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of form.entries()) params[key] = String(value);

    const signature = req.headers.get("x-twilio-signature") ?? "";
    // URL pública exacta que Twilio llamó (la que configuramos como StatusCallback).
    const url = process.env.APP_BASE_URL
      ? `${process.env.APP_BASE_URL.replace(/\/$/, "")}/api/sms/status`
      : req.url;

    if (!isValidSignature(url, params, signature)) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const sid = params.MessageSid || params.SmsSid;
    const twilioStatus = (params.MessageStatus || params.SmsStatus || "").toLowerCase();
    const mapped = STATUS_MAP[twilioStatus];

    if (sid && mapped && isSupabaseConfigured()) {
      const supabase = createServiceRoleClient();
      const patch: Record<string, unknown> = { status: mapped };
      if (params.ErrorCode) patch.error = `Twilio ${params.ErrorCode}`;
      if (mapped === "delivered") patch.sent_at = new Date().toISOString();
      await supabase.from("sms_messages").update(patch).eq("provider_sid", sid);
    }

    // Twilio espera 2xx; el cuerpo es indiferente.
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logError("sms_status_callback_failed", error);
    return new NextResponse(null, { status: 204 });
  }
}
