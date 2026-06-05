"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, ChevronDown, TrendingUp, UserPlus, Users } from "lucide-react";
import type { CampusLeadMetrics } from "@/lib/admin/queries";

export function LeadsMetrics({ data }: { data: CampusLeadMetrics }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-[14px] font-bold text-[var(--ink)]">
          <BarChart3 className="h-4 w-4 text-[var(--primary)]" />
          Métricas de captación y conversión
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-4 grid gap-4">
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Leads totales"
              value={data.totalLeads}
              tone="info"
            />
            <StatCard
              icon={<UserPlus className="h-4 w-4" />}
              label="Inscripciones"
              value={data.totalInscripciones}
              tone="success"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Conversión"
              value={`${data.conversionRate}%`}
              tone="primary"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Leads por mes */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Leads por mes
              </p>
              {data.byMonth.some((m) => m.leads > 0) ? (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={data.byMonth} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted)" />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted)" allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "var(--surface-muted)", opacity: 0.5 }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        fontSize: 12,
                      }}
                      formatter={(value) => [`${value} leads`, "Leads"]}
                    />
                    <Bar dataKey="leads" fill="#f4b73f" radius={[6, 6, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="grid h-[190px] place-items-center text-[12.5px] text-[var(--muted)]">
                  Aún no hay leads en los últimos meses.
                </p>
              )}
            </div>

            {/* Conversión por origen */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Por origen · Leads vs Inscripciones
              </p>
              {data.bySource.length > 0 ? (
                <div className="grid gap-2.5">
                  {data.bySource.map((row) => {
                    const max = Math.max(...data.bySource.map((s) => s.leads), 1);
                    return (
                      <div key={row.source}>
                        <div className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="truncate font-semibold text-[var(--ink)]">{row.source}</span>
                          <span className="shrink-0 tabular-nums text-[var(--muted)]">
                            {row.leads} · {row.inscripciones} insc · {row.rate}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                          <div
                            className="h-full rounded-full bg-[#f4b73f]"
                            style={{ width: `${(row.leads / max) * 100}%` }}
                          >
                            <div
                              className="h-full rounded-full bg-[var(--success)]"
                              style={{ width: `${row.leads > 0 ? Math.min((row.inscripciones / row.leads) * 100, 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-1 flex items-center gap-3 text-[10.5px] text-[var(--muted)]">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#f4b73f]" /> Leads
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Inscripciones
                    </span>
                  </div>
                </div>
              ) : (
                <p className="grid h-[190px] place-items-center text-[12.5px] text-[var(--muted)]">
                  Sin datos de origen todavía.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "info" | "success" | "primary";
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--success)] bg-[var(--success-soft)]"
      : tone === "primary"
        ? "text-[var(--primary)] bg-[var(--primary-soft)]"
        : "text-[var(--info)] bg-[var(--info-soft)]";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
      <span className={`inline-grid h-7 w-7 place-items-center rounded-lg ${toneClass}`}>{icon}</span>
      <p className="mt-2 text-[20px] font-extrabold leading-none text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-[11.5px] text-[var(--muted)]">{label}</p>
    </div>
  );
}
