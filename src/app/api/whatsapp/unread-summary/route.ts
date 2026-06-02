import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dal";

export const dynamic = "force-dynamic";

type Row = {
  recipient_phone: string;
  recipient_name: string;
  body_text: string | null;
  template_name: string;
  created_at: string;
  payload: Record<string, unknown> | null;
};

export async function GET() {
  const { supabase } = await requireAdmin();

  // Traemos los entrantes no leídos. Para mostrar el "último mensaje" en la
  // notificación tomamos el body_text o el placeholder según el tipo.
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("recipient_phone, recipient_name, body_text, template_name, created_at, payload")
    .eq("direction", "inbound")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const byPhone = new Map<
    string,
    { phone: string; contactName: string; count: number; lastBody: string; lastAt: string }
  >();

  for (const row of (data ?? []) as Row[]) {
    const phone = row.recipient_phone;
    if (!phone) continue;
    const entry = byPhone.get(phone);
    const bodyText = row.body_text ?? "[Mensaje]";
    if (!entry) {
      byPhone.set(phone, {
        phone,
        contactName: row.recipient_name || `+${phone}`,
        count: 1,
        lastBody: bodyText,
        lastAt: row.created_at,
      });
    } else {
      entry.count++;
      // El más reciente (ya viene ordenado desc) determina el último mensaje
      if (new Date(row.created_at) > new Date(entry.lastAt)) {
        entry.lastBody = bodyText;
        entry.lastAt = row.created_at;
      }
    }
  }

  const conversations = Array.from(byPhone.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );

  return NextResponse.json({
    total: conversations.reduce((acc, conv) => acc + conv.count, 0),
    conversations,
  });
}
