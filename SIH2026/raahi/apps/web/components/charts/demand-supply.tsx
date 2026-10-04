"use client";
import { useState } from "react";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Area = {
  sector: string;
  calls: number;                                   // demand: calls asking for a skill in it
  openings: number;                                // supply: job openings, last 180 days
  skills: { skill: string; calls: number }[];      // what those callers asked for
};

// Calls and openings differ by orders of magnitude, so each has its own
// column and scale (never one shared axis).
function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-16 shrink-0 sm:w-28">
        {value > 0 && (
          <div
            className={cn("h-full rounded-r-[4px]", className)}
            style={{ width: `max(3px, ${(value / max) * 100}%)` }}
          />
        )}
      </div>
      <span className={cn("tabular-nums", value ? "font-semibold text-ink" : "text-ink-faint")}>{fmt(value)}</span>
    </div>
  );
}

const STATUS = {
  good: { pill: "tag-pass", icon: "M3.5 8.5l3 3 6-7" },
  warn: { pill: "tag-unk", icon: "M8 4v5M8 11.5v.5" },
  bad: { pill: "tag-fail", icon: "M5 5l6 6M11 5l-6 6" },
  none: { pill: "", icon: "M4.5 8h7" },
} as const;

function balance(a: Area): { tone: keyof typeof STATUS; text: string } {
  if (a.calls === 0) return { tone: "none", text: "No calls yet" };
  if (a.openings === 0) return { tone: "bad", text: "No openings" };
  const perCall = a.openings / a.calls;
  if (perCall < 1) return { tone: "warn", text: "More calls than openings" };
  return { tone: "good", text: `${fmt(Math.round(perCall))} openings per call` };
}

export function DemandSupply({ areas, initial = 8 }: { areas: Area[]; initial?: number }) {
  const [all, setAll] = useState(false);
  if (!areas.length) {
    return <p className="py-6 text-center text-sm text-ink-soft">No calls or job openings recorded yet.</p>;
  }
  const maxCalls = Math.max(1, ...areas.map((a) => a.calls));
  const maxOpenings = Math.max(1, ...areas.map((a) => a.openings));
  // Rows arrive sorted by calls, then openings: every area callers asked
  // about is shown, then the areas with the most openings.
  const count = all ? areas.length : Math.max(initial, areas.filter((a) => a.calls > 0).length);
  const shown = areas.slice(0, count);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-3.5 rounded-r-[3px] bg-violet-600" /> Calls (demand)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-3.5 rounded-r-[3px] bg-teal-600" /> Openings, last 180 days (supply)
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Skill area</th>
              <th className="px-4 py-3 text-left font-semibold">Calls</th>
              <th className="px-4 py-3 text-left font-semibold">Openings</th>
              <th className="px-4 py-3 text-left font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => {
              const b = balance(a);
              return (
                <tr key={a.sector} className="table-row align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{a.sector}</div>
                    {a.skills.length > 0 && (
                      <div className="mt-0.5 text-xs text-ink-soft">
                        {a.skills.map((s) => `${s.skill} (${fmt(s.calls)})`).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3"><Bar value={a.calls} max={maxCalls} className="bg-violet-600" /></td>
                  <td className="px-4 py-3"><Bar value={a.openings} max={maxOpenings} className="bg-teal-600" /></td>
                  <td className="px-4 py-3">
                    <span className={cn("chip whitespace-nowrap", STATUS[b.tone].pill)}>
                      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3 w-3">
                        <path d={STATUS[b.tone].icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {b.text}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {areas.length > count && (
        <button type="button" className="btn-ghost mt-3" onClick={() => setAll(true)}>
          Show all {areas.length} skill areas
        </button>
      )}
    </div>
  );
}
