"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { week: string; asistencia: number };

export function AttendanceBarChart({ data }: { data: Point[] }) {
  return (
    <div className="-mx-2 sm:mx-0">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="week"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="var(--muted)"
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="var(--muted)"
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)", opacity: 0.5 }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              fontSize: 12,
              boxShadow: "0 4px 12px -4px rgba(17,24,39,0.10)",
            }}
            formatter={(value) => [`${value}%`, "Asistencia"]}
            labelStyle={{ color: "var(--muted)", fontWeight: 600 }}
          />
          <Bar dataKey="asistencia" fill="#1f6f43" radius={[8, 8, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
