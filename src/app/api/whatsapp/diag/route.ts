import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dal";
import { getPhoneNumberStatus, getWabaStatus, isWhatsappConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// End-to-end diagnostics for the WhatsApp pipeline (Meta Cloud API):
// 1. ¿Están las credenciales en .env.local?
// 2. ¿Responde Graph API con info del número (verified_name, quality_rating)?
// 3. ¿Es alcanzable META_WABA_ID y cuántas plantillas vivas hay?
// 4. ¿Llega webhook inbound? — miramos último mensaje entrante registrado.
export async function GET() {
  const { supabase } = await requireAdmin();

  const configured = isWhatsappConfigured();
  const result: {
    configured: boolean;
    provider: "meta";
    env: { hasAccessToken: boolean; hasPhoneNumberId: boolean; hasWabaId: boolean; hasAppSecret: boolean; hasVerifyToken: boolean };
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
  } = {
    configured,
    provider: "meta",
    env: {
      hasAccessToken: Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN),
      hasPhoneNumberId: Boolean(process.env.META_PHONE_NUMBER_ID),
      hasWabaId: Boolean(process.env.META_WABA_ID),
      hasAppSecret: Boolean(process.env.META_APP_SECRET),
      hasVerifyToken: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN),
    },
    hints: [],
  };

  if (!result.env.hasAccessToken || !result.env.hasPhoneNumberId) {
    result.hints.push(
      "Define META_WHATSAPP_ACCESS_TOKEN y META_PHONE_NUMBER_ID en .env.local y reinicia el panel.",
    );
  }
  if (!result.env.hasWabaId) {
    result.hints.push(
      "Falta META_WABA_ID. Sin él no podrás crear ni sincronizar plantillas. Cópialo desde Meta Business Manager → WhatsApp → Configuración API.",
    );
  }
  if (!result.env.hasAppSecret) {
    result.hints.push(
      "Falta META_APP_SECRET. Sin él los webhooks no pueden verificar firma y se rechazarán como no autorizados.",
    );
  }
  if (!result.env.hasVerifyToken) {
    result.hints.push(
      "Falta META_WEBHOOK_VERIFY_TOKEN. Sin él Meta no podrá verificar tu webhook en el primer GET de suscripción.",
    );
  }

  if (configured) {
    const phone = await getPhoneNumberStatus();
    result.phone = {
      reachable: phone.status === "ready",
      status: phone.status,
      phoneNumberId: phone.phoneNumberId,
      displayPhoneNumber: phone.displayPhoneNumber,
      verifiedName: phone.verifiedName,
      qualityRating: phone.qualityRating,
      lastError: phone.lastError ?? null,
      elapsedMs: phone.elapsedMs,
    };
    if (phone.status !== "ready") {
      result.hints.push(
        `Graph API no respondió correctamente al consultar el phone number: ${phone.lastError ?? "error desconocido"}. Comprueba que META_WHATSAPP_ACCESS_TOKEN es un token vigente (system user, sin expirar) y que META_PHONE_NUMBER_ID es correcto.`,
      );
    } else if (phone.qualityRating === "RED") {
      result.hints.push(
        "El quality rating de tu número está en ROJO. Meta puede limitar tus envíos. Mejora la calidad evitando spam y respondiendo rápido.",
      );
    } else if (phone.qualityRating === "YELLOW") {
      result.hints.push("Quality rating amarillo: vigila tasas de bloqueo y reportes.");
    }
  }

  if (result.env.hasWabaId && configured) {
    const waba = await getWabaStatus();
    result.waba = {
      reachable: waba.reachable,
      wabaId: waba.wabaId,
      name: waba.name,
      currency: waba.currency,
      templatesCount: waba.templatesCount,
      lastError: waba.lastError,
      elapsedMs: waba.elapsedMs,
    };
    if (!waba.reachable) {
      result.hints.push(
        `Graph API no devolvió la WhatsApp Business Account (WABA) ${waba.wabaId}: ${waba.lastError}. Esto es la causa habitual del bug "la plantilla aparece como enviada pero no se ve en Meta". Verifica:`,
      );
      result.hints.push(
        "  · El token tiene el permiso 'whatsapp_business_management' (no solo 'whatsapp_business_messaging').",
      );
      result.hints.push(
        "  · META_WABA_ID corresponde a la cuenta donde miras las plantillas en Business Manager.",
      );
      result.hints.push(
        "  · El System User dueño del token tiene acceso completo (Admin) a esa WABA.",
      );
    }
  }

  // Estado de inbound en BBDD
  const now = Date.now();
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const [countRes, lastRes] = await Promise.all([
    supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .gte("created_at", since),
    supabase
      .from("whatsapp_messages")
      .select("recipient_phone, recipient_name, body_text, created_at")
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lastReceivedAt = lastRes.data?.created_at ?? null;
  const minutesSinceLast = lastReceivedAt
    ? Math.round((now - new Date(lastReceivedAt).getTime()) / 60000)
    : null;

  result.inbound = {
    last24h: countRes.count ?? 0,
    lastReceivedAt,
    lastFrom: lastRes.data
      ? `+${lastRes.data.recipient_phone} (${lastRes.data.recipient_name})`
      : null,
    lastBody: lastRes.data?.body_text?.slice(0, 100) ?? null,
    minutesSinceLast,
  };

  if (configured && result.phone?.reachable && result.inbound.last24h === 0) {
    result.hints.push(
      "El número está conectado pero no llegan inbound. Comprueba en Meta Business Manager → WhatsApp → Configuración → Webhook que apunta a https://<tu-dominio>/api/whatsapp/inbound y que el verify token coincide con META_WEBHOOK_VERIFY_TOKEN. Y que los campos 'messages' AND 'message_template_status_update' están suscritos.",
    );
  } else if (minutesSinceLast !== null && minutesSinceLast > 60 * 24) {
    result.hints.push(
      `Último inbound recibido hace ${Math.round(minutesSinceLast / 60)} h. Si esperabas algo más reciente, revisa la configuración del webhook.`,
    );
  }

  return NextResponse.json(result);
}
