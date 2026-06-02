import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dal";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { downloadMediaStream, fetchMediaInfo, isWhatsappConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  await requireAdmin();
  const { messageId } = await params;
  if (!UUID_REGEX.test(messageId)) {
    return NextResponse.json({ error: "Id de mensaje inválido" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: message, error } = await service
    .from("whatsapp_messages")
    .select("payload")
    .eq("id", messageId)
    .maybeSingle();
  if (error) throw error;
  if (!message) return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });

  const payload = (message.payload as Record<string, unknown>) ?? {};
  const storagePath = typeof payload.mediaStoragePath === "string" ? payload.mediaStoragePath : null;
  const mimeType = typeof payload.mediaMime === "string" ? payload.mediaMime : "application/octet-stream";

  if (storagePath) {
    const { data, error: downloadError } = await service.storage
      .from("whatsapp-media")
      .download(storagePath);
    if (!downloadError && data) {
      return new Response(data.stream(), {
        headers: {
          "Content-Type": data.type || mimeType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  const mediaId = typeof payload.mediaId === "string" ? payload.mediaId : null;
  if (!mediaId) return NextResponse.json({ error: "Media no disponible" }, { status: 404 });
  if (!isWhatsappConfigured()) {
    return NextResponse.json({ error: "Meta WhatsApp no configurado" }, { status: 503 });
  }

  const info = await fetchMediaInfo(mediaId);
  if (!info || info.expired) {
    return NextResponse.json({ error: "Media caducado o no disponible" }, { status: info?.expired ? 410 : 404 });
  }
  const upstream = await downloadMediaStream(info.url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `Meta respondió ${upstream.status}` }, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? info.mimeType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
