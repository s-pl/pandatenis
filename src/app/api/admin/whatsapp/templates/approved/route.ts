import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dal";

export const dynamic = "force-dynamic";

/**
 * Devuelve las plantillas WhatsApp aprobadas por Meta.
 * Lo consume <QuickTemplateButton> para que el admin pueda enviar a una
 * familia sin abandonar la pantalla donde está.
 */
export async function GET() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("message_templates")
    .select("id, name, body, language, category, components_schema")
    .eq("meta_status", "approved")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const templates = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    body: row.body as string,
    language: (row.language as string) ?? "es",
    category: row.category as string,
    componentsSchema: (row.components_schema ?? null) as
      | {
          body?: { variables?: string[] };
          header?: {
            type: "DOCUMENT" | "IMAGE" | "VIDEO";
            storagePath: string;
            filename: string;
            mimeType: string;
          } | null;
          raw?: unknown;
        }
      | null,
  }));

  return NextResponse.json(
    { templates },
    {
      headers: {
        "Cache-Control":
          "private, max-age=30, stale-while-revalidate=120",
      },
    },
  );
}
