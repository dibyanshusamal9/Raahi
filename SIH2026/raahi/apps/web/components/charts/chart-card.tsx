"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** A chart card whose chart can be switched to the same numbers as a table. */
export function ChartCard({ title, subtitle, chart, table, className }: {
  title: string;
  subtitle?: string;
  chart: React.ReactNode;
  table: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={cn("card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
        </div>
        <div role="group" aria-label="Show as" className="inline-flex rounded-full border border-line bg-white p-0.5 text-xs">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium transition",
                view === v ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200" : "text-ink-soft hover:text-ink",
              )}
            >
              {v === "chart" ? "Chart" : "Table"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">{view === "chart" ? chart : table}</div>
    </section>
  );
}

/** A plain two-column table: the table view of a one-series chart. */
export function MiniTable({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead className="table-head sticky top-0">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">{head[0]}</th>
            <th className="px-4 py-2 text-right font-semibold">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a} className="table-row">
              <td className="px-4 py-2 text-ink">{a}</td>
              <td className="px-4 py-2 text-right text-ink tabular-nums">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
