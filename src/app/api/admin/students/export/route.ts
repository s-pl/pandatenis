import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dal";

export const dynamic = "force-dynamic";

type StudentRow = {
  first_name: string;
  last_name: string;
  birth_date: string;
  level: string;
  active: boolean;
  group_id: string | null;
  preferred_days: string[] | null;
  preferred_time_blocks: string[] | null;
  groups: { name: string | null } | { name: string | null }[] | null;
  guardians: Array<{ full_name: string; phone: string; email: string | null; relationship: string }> | null;
};

const WEEKDAY_LABEL: Record<string, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miércoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sábado",
  D: "Domingo",
};

function ageFromBirthDate(birthDate: string): number {
  const d = new Date(birthDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Excel-friendly: usar coma para escape estándar CSV.
  if (/[";\n,\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function GET() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("students")
    .select(
      "first_name, last_name, birth_date, level, active, group_id, preferred_days, preferred_time_blocks, groups(name), guardians(full_name, phone, email, relationship)",
    )
    .order("first_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as StudentRow[];

  const headers = [
    "Nombre",
    "Apellidos",
    "Edad",
    "Nivel",
    "Grupo",
    "Activo",
    "Tutor",
    "Parentesco",
    "Teléfono",
    "Email",
    "Días preferidos",
    "Franjas preferidas",
  ];

  const lines: string[] = [headers.map(csvCell).join(";")];

  for (const row of rows) {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    const guardian = row.guardians?.[0] ?? null;
    const days = (row.preferred_days ?? []).map((d) => WEEKDAY_LABEL[d] ?? d).join(", ");
    const blocks = (row.preferred_time_blocks ?? []).join(", ");

    const line = [
      row.first_name,
      row.last_name,
      ageFromBirthDate(row.birth_date),
      row.level,
      group?.name ?? "Sin grupo",
      row.active ? "Sí" : "No",
      guardian?.full_name ?? "",
      guardian?.relationship ?? "",
      guardian?.phone ?? "",
      guardian?.email ?? "",
      days,
      blocks,
    ]
      .map(csvCell)
      .join(";");
    lines.push(line);
  }

  // BOM UTF-8 para que Excel en Windows abra el CSV con tildes correctas.
  const body = "﻿" + lines.join("\r\n");
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alumnos-pandatenis-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
