"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Point = { level: string; count: number; color: string };

/**
 * Donut chart for student-level distribution. The `size` prop controls overall
 * height and indirectly the donut diameter — keep the container width fluid so
 * the chart never clips inside narrow grid columns.
 */
export function LevelDonutChart({
  data,
  size = 240,
}: {
  data: Point[];
  size?: number;
}) {
  const total = data.reduce((acc, point) => acc + point.count, 0);

  // Derive radii from the container size so a 160-px donut still looks right.
  const outer = Math.floor(size * 0.38);
  const inner = Math.floor(size * 0.27);
  const valueFontClass = size <= 180 ? "text-2xl" : "text-3xl";

  return (
    <div className="relative w-full" style={{ height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="level"
            innerRadius={inner}
            outerRadius={outer}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.level} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              fontSize: 12,
              boxShadow: "0 4px 12px -4px rgba(17,24,39,0.10)",
            }}
            formatter={(value, name) => [`${value} alumnos`, `Nivel ${name}`]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className={`${valueFontClass} font-bold leading-none`}>{total}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          alumnos
        </p>
      </div>
    </div>
  );
}
