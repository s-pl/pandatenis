"use server";

import { requireStaff } from "@/lib/dal";

export type SearchResultType = "student" | "guardian" | "lead" | "payment";

export type GlobalSearchResult = {
  id: string;
  type: SearchResultType;
  label: string;
  sublabel?: string;
  href: string;
};

/** Limpia el término para que no rompa los filtros `.or()` de PostgREST. */
function sanitize(q: string): string {
  return q.replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Búsqueda global del panel (la usa la paleta de comandos). Busca alumnos,
 * tutores, leads y pagos en paralelo. Limita resultados por tipo y depende de
 * RLS para acotar lo que cada rol puede ver.
 */
export async function globalSearch(rawQuery: string): Promise<GlobalSearchResult[]> {
  const q = sanitize(rawQuery);
  if (q.length < 2) return [];

  const { supabase } = await requireStaff();
  const like = `%${q}%`;
  const digits = q.replace(/\D/g, "");
  const phoneOr = (col: string) =>
    digits.length >= 3 ? `,${col}.ilike.%${digits}%` : "";

  const [studentsRes, guardiansRes, leadsRes, paymentsRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, level")
      .or(`first_name.ilike.${like},last_name.ilike.${like}`)
      .limit(6),
    supabase
      .from("guardians")
      .select("id, student_id, full_name, phone")
      .or(`full_name.ilike.${like}${phoneOr("phone")}`)
      .limit(6),
    supabase
      .from("leads")
      .select("id, full_name, phone, status")
      .or(`full_name.ilike.${like}${phoneOr("phone")}`)
      .limit(6),
    supabase
      .from("payments")
      .select("id, concept, amount, status")
      .ilike("concept", like)
      .limit(5),
  ]);

  const results: GlobalSearchResult[] = [];

  for (const s of studentsRes.data ?? []) {
    results.push({
      id: s.id as string,
      type: "student",
      label: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Alumno",
      sublabel: (s.level as string | null) ?? undefined,
      href: `/admin/students/${s.id}`,
    });
  }
  for (const g of guardiansRes.data ?? []) {
    results.push({
      id: g.id as string,
      type: "guardian",
      label: (g.full_name as string) || "Tutor",
      sublabel: (g.phone as string | null) ?? undefined,
      href: g.student_id ? `/admin/students/${g.student_id}` : "/admin/students",
    });
  }
  for (const l of leadsRes.data ?? []) {
    results.push({
      id: l.id as string,
      type: "lead",
      label: (l.full_name as string) || "Contacto",
      sublabel: (l.phone as string | null) ?? undefined,
      href: "/admin/leads",
    });
  }
  for (const p of paymentsRes.data ?? []) {
    const amount = typeof p.amount === "number" ? `${p.amount} €` : undefined;
    results.push({
      id: p.id as string,
      type: "payment",
      label: (p.concept as string) || "Pago",
      sublabel: amount,
      href: "/admin/payments",
    });
  }

  return results;
}
