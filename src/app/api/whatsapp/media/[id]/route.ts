import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dal";
import { downloadMediaStream, fetchMediaInfo, isWhatsappConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Los media IDs de Meta son numéricos. Validamos para evitar SSRF si alguien
// intentara pasar una URL o un valor arbitrario.
const ID_REGEX = /^\d{10,20}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;

  if (!ID_REGEX.test(id)) {
    return NextResponse.json({ error: "Id de media inválido" }, { status: 400 });
  }

  if (!isWhatsappConfigured()) {
    return NextResponse.json({ error: "Meta WhatsApp no configurado" }, { status: 503 });
  }

  const info = await fetchMediaInfo(id);
  if (!info) {
    return NextResponse.json({ error: "Media no disponible" }, { status: 404 });
  }
  if (info.expired) {
    return NextResponse.json(
      { error: "El media ha caducado en Meta y ya no se puede descargar", expired: true },
      { status: 410 },
    );
  }

  const upstream = await downloadMediaStream(info.url);
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: text || `Meta respondió ${upstream.status}` },
      { status: upstream.status },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? info.mimeType,
      "Content-Length": upstream.headers.get("content-length") ?? "",
      "Cache-Control": "private, max-age=300",
    },
  });
}
