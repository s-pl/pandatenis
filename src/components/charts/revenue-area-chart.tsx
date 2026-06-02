"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";

type Point = { month: string; ingresos: number; particulares: number };

export function RevenueAreaChart({ data }: { data: Point[] }) {
  return (
    <div className="-mx-2 sm:mx-0">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="grad-escuela" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f6f43" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#1f6f43" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-particular" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4b73f" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#f4b73f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
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
            tickFormatter={(v) => `${v}€`}
            width={44}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              boxShadow: "0 10px 25px -15px rgba(17,24,39,0.20)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted)", fontWeight: 600 }}
            formatter={(value, name) => [
              formatMoney(Number(value), true),
              labelFor(String(name)),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-[var(--muted)]">{labelFor(String(value))}</span>
            )}
          />
          <Area
            type="monotone"
            dataKey="ingresos"
            stroke="#1f6f43"
            strokeWidth={2.2}
            fill="url(#grad-escuela)"
          />
          <Area
            type="monotone"
            dataKey="particulares"
            stroke="#f4b73f"
            strokeWidth={2.2}
            fill="url(#grad-particular)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function labelFor(key: string) {
  if (key === "ingresos") return "Cuotas mensuales";
  if (key === "particulares") return "Clases particulares";
  return key;
}
