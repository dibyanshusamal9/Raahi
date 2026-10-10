import Link from "next/link";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

// One series of horizontal bars, value at each bar's tip. Colors are the
// validated pair used across the dashboard: violet = calls, teal = openings.
const FILL = { calls: "bg-violet-600", openings: "bg-teal-600" } as const;

export type BarRow = { label: string; value: number; href?: string; detail?: string };

export function BarList({ rows, measure, empty }: {
  rows: BarRow[];
  measure: keyof typeof FILL;
  empty: string;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-soft">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_1fr]"
        >
          <span className="min-w-0 text-sm leading-tight text-ink">
            {r.href ? (
              <Link href={r.href} className="block truncate hover:text-violet-700 hover:underline" title={r.label}>
                {r.label}
              </Link>
            ) : (
              <span className="block truncate" title={r.label}>{r.label}</span>
            )}
            {r.detail && <span className="block truncate text-xs text-ink-faint">{r.detail}</span>}
          </span>
          <span className="flex items-center gap-2">
            {/* bars are square at the baseline, rounded at the data end */}
            <span
              className={cn("h-2.5 rounded-r-[4px]", FILL[measure])}
              style={{ width: `max(3px, calc((100% - 4rem) * ${r.value / max}))` }}
            />
            <span className="text-sm font-semibold text-ink tabular-nums">{fmt(r.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
