import { NextResponse } from "next/server";
import { log, logError } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processWhatsappQueueWithClient } from "@/lib/admin/actions/whatsapp";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = createServiceRoleClient();
    const result = await processWhatsappQueueWithClient(supabase, body);
    log("info", "whatsapp_queue_processed", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logError("whatsapp_queue_failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error procesando la cola" },
      { status: 500 },
    );
  }
}
