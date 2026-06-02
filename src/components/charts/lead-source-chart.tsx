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

type Point = { source: string; count: number };

export function LeadSourceChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted)" />
        <YAxis
          dataKey="source"
          type="category"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          stroke="var(--muted)"
          width={100}
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
          formatter={(value) => [`${value} contactos`, "Total"]}
        />
        <Bar dataKey="count" fill="#f4b73f" radius={[0, 8, 8, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
