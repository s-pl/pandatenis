import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dal";

export const dynamic = "force-dynamic";

const WEEKDAY_ORDER: Array<"L" | "M" | "X" | "J" | "V" | "S" | "D"> = [
  "L", "M", "X", "J", "V", "S", "D",
];
const WEEKDAY_LABEL: Record<string, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miércoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sábado",
  D: "Domingo",
};

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[";\n,\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

type GroupRow = {
  id: string;
  name: string;
  level: string;
  capacity: number;
  weekdays: string[] | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
};

type StudentRow = {
  first_name: string;
  last_name: string;
  group_id: string | null;
};

export async function GET() {
  const { supabase } = await requireAdmin();

  const [groupsRes, studentsRes] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, level, capacity, weekdays, start_time, end_time, location"),
    supabase
      .from("students")
      .select("first_name, last_name, group_id")
      .eq("active", true),
  ]);

  if (groupsRes.error) {
    return NextResponse.json({ error: groupsRes.error.message }, { status: 500 });
  }

  const groups = (groupsRes.data ?? []) as GroupRow[];
  const students = (studentsRes.data ?? []) as StudentRow[];

  const enrolledByGroup = new Map<string, string[]>();
  for (const g of groups) enrolledByGroup.set(g.id, []);
  for (const s of students) {
    if (s.group_id && enrolledByGroup.has(s.group_id)) {
      enrolledByGroup.get(s.group_id)!.push(`${s.first_name} ${s.last_name}`);
    }
  }

  const headers = [
    "Día",
    "Hora",
    "Grupo",
    "Nivel",
    "Pista",
    "Plazas (ocupadas/total)",
    "Alumnos",
  ];
  const lines: string[] = [headers.map(csvCell).join(";")];

  // Expandir cada grupo a una fila por día.
  type Row = {
    day: string;
    start: string;
    end: string;
    name: string;
    level: string;
    location: string;
    occupied: number;
    capacity: number;
    students: string;
    sortKey: string;
  };
  const rows: Row[] = [];

  for (const g of groups) {
    const days = (g.weekdays ?? []).filter((d): d is string => !!d);
    const enrolled = enrolledByGroup.get(g.id) ?? [];
    const sorted = enrolled.slice().sort((a, b) => a.localeCompare(b));
    const start = g.start_time ? String(g.start_time).slice(0, 5) : "";
    const end = g.end_time ? String(g.end_time).slice(0, 5) : "";
    const baseRow = {
      start,
      end,
      name: g.name,
      level: g.level,
      location: g.location ?? "",
      occupied: enrolled.length,
      capacity: g.capacity,
      students: sorted.join(", "),
    };
    if (days.length === 0) {
      rows.push({ ...baseRow, day: "Sin día", sortKey: `Z-${start}` });
    } else {
      for (const d of days) {
        rows.push({
          ...baseRow,
          day: WEEKDAY_LABEL[d] ?? d,
          sortKey: `${WEEKDAY_ORDER.indexOf(d as "L")}-${start}`,
        });
      }
    }
  }

  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  for (const row of rows) {
    lines.push(
      [
        row.day,
        row.start && row.end ? `${row.start} – ${row.end}` : row.start || row.end,
        row.name,
        row.level,
        row.location,
        `${row.occupied}/${row.capacity}`,
        row.students,
      ]
        .map(csvCell)
        .join(";"),
    );
  }

  const body = "﻿" + lines.join("\r\n");
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="horario-pandatenis-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
