import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Column = { key: string; label: string; tick: string; value: number };

/** Round a maximum up to a clean axis top: 3 → 4, 7 → 8, 13 → 15. */
function axisTop(max: number) {
  if (max <= 4) return Math.max(2, Math.ceil(max / 2) * 2);
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * step >= max && Number.isInteger((m * step) / 2)) return m * step;
  }
  return Math.ceil(max / step) * step;
}

/** One series of columns over time (violet = calls). Each column shows its
 *  value on hover or keyboard focus; the highest is labelled on its cap. */
export function ColumnChart({ columns, unit }: { columns: Column[]; unit: [string, string] }) {
  const max = Math.max(0, ...columns.map((c) => c.value));
  const top = axisTop(max);
  const ticks = [top, top / 2, 0];
  const peak = max > 0 ? columns.map((c) => c.value).lastIndexOf(max) : -1;
  const n = columns.length;
  const tickAt = [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <figure>
      <div className="relative h-48 pl-8">
        {/* gridlines + y-axis labels */}
        {ticks.map((t) => (
          <div key={t} className="absolute left-8 right-0 border-t border-line" style={{ bottom: `${(t / top) * 100}%` }}>
            <span className="absolute -left-8 -translate-y-1/2 text-[11px] text-ink-faint tabular-nums">{fmt(t)}</span>
          </div>
        ))}
        <ol className="absolute inset-y-0 left-8 right-0 flex items-end gap-[2px]">
          {columns.map((c, i) => {
            const h = (c.value / top) * 100;
            return (
              <li
                key={c.key}
                tabIndex={0}
                aria-label={`${c.label}: ${fmt(c.value)} ${c.value === 1 ? unit[0] : unit[1]}`}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center rounded-sm outline-none focus-visible:bg-violet-50"
              >
                <span
                  className="w-full max-w-[16px] rounded-t-[4px] bg-violet-600 transition-colors group-hover:bg-violet-700 group-focus-visible:bg-violet-700"
                  style={{ height: c.value ? `max(3px, ${h}%)` : 0 }}
                />
                {i === peak && (
                  <span
                    className="absolute text-xs font-semibold text-ink tabular-nums"
                    style={{ bottom: `calc(${h}% + 4px)` }}
                  >
                    {fmt(c.value)}
                  </span>
                )}
                <span
                  role="tooltip"
                  className={cn(
                    "pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white/80 shadow-lift group-hover:block group-focus-visible:block",
                    i < 4 ? "left-0" : i > n - 5 ? "right-0" : "left-1/2 -translate-x-1/2",
                  )}
                >
                  <span className="font-semibold text-white">
                    {fmt(c.value)} {c.value === 1 ? unit[0] : unit[1]}
                  </span>{" "}
                  · {c.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="relative mt-2 h-4 pl-8 text-[11px] text-ink-faint">
        {tickAt.map((i, k) => (
          <span
            key={i}
            className={cn("absolute", k === 0 ? "left-8" : k === 2 ? "right-0" : "left-1/2 -translate-x-1/2")}
          >
            {columns[i]?.tick}
          </span>
        ))}
      </div>
    </figure>
  );
}
