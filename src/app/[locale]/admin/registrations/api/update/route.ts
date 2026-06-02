import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pendiente", "confirmada", "convertida"]),
});

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const body = await request.json();
    const data = Schema.parse(body);

    const { data: current, error: currentError } = await supabase
      .from("registrations")
      .select("id, status, student_id")
      .eq("id", data.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }
    if (data.status === "convertida" && !current.student_id) {
      return NextResponse.json(
        { ok: false, error: "Para convertir una solicitud, usa el botón Crear alumno." },
        { status: 409 },
      );
    }
    if (current.student_id && data.status !== "convertida") {
      return NextResponse.json(
        { ok: false, error: "Esta solicitud ya fue convertida en alumno." },
        { status: 409 },
      );
    }

    const { error } = await supabase
      .from("registrations")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw error;
    revalidatePath("/admin/registrations");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "fail" },
      { status: 400 },
    );
  }
}
