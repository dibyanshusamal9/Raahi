"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { fmt } from "@/lib/format";

export type DistrictPoint = {
  district: string;
  state: string;
  lat: number;
  lon: number;
  calls: number;
  openings: number;
};
type Measure = "calls" | "openings";

// Ordinal ramps, light → dark, checked with the dataviz validator (--ordinal)
// against the white card: violet for calls, teal for openings.
const RAMP: Record<Measure, string[]> = {
  calls: ["#b79cfb", "#9b74f7", "#7c3aed", "#6025c9", "#45198f"],
  openings: ["#3cbfae", "#14a090", "#0d8075", "#0b6159", "#0a453f"],
};
// Tooltip keys sit on the dark tooltip, so they use each ramp's light step.
const TOOLTIP_KEY: Record<Measure, string> = { calls: RAMP.calls[0], openings: RAMP.openings[0] };
const ZERO = "#E4E1EC";
const WORD: Record<Measure, [string, string]> = { calls: ["call", "calls"], openings: ["opening", "openings"] };

// Equirectangular, with longitude shrunk for India's mid-latitude.
const K = 16;
const COS = Math.cos((23 * Math.PI) / 180);
const PAD = 8;

function project(points: DistrictPoint[]) {
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  return {
    width: (maxLon - minLon) * K * COS + 2 * PAD,
    height: (maxLat - minLat) * K + 2 * PAD,
    xy: points.map((p) => [(p.lon - minLon) * K * COS + PAD, (maxLat - p.lat) * K + PAD] as const),
  };
}

function nice(v: number) {
  if (v < 20) return Math.round(v);
  const m = 10 ** (Math.floor(Math.log10(v)) - 1);
  return Math.round(v / m) * m;
}

/** Upper bounds of up to five classes over the non-zero values. */
function classBounds(values: number[]): number[] {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!nz.length) return [];
  const distinct = [...new Set(nz)];
  if (distinct.length <= 5) return distinct;
  const max = nz[nz.length - 1];
  const cuts = [0.2, 0.4, 0.6, 0.8].map((p) => nice(nz[Math.floor(p * (nz.length - 1))]));
  return [...new Set([...cuts.filter((c) => c > 0 && c < max), max])].sort((a, b) => a - b);
}

export function IndiaMap({ points, measure, title, subtitle }: {
  points: DistrictPoint[];
  measure: Measure;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => project(points), [points]);
  const bounds = useMemo(() => classBounds(points.map((p) => p[measure])), [points, measure]);
  // Classes spread across the ramp, so two classes are still far apart.
  const colorOf = (v: number) => {
    if (v <= 0) return ZERO;
    const i = bounds.findIndex((b) => v <= b);
    const step = bounds.length === 1 ? 2 : Math.round((i * 4) / (bounds.length - 1));
    return RAMP[measure][step];
  };
  // Zeros first, largest last, so the biggest values sit on top.
  const order = useMemo(
    () => points.map((_, i) => i).sort((a, b) => points[a][measure] - points[b][measure]),
    [points, measure],
  );
  const top = order.filter((i) => points[i][measure] > 0).slice(-5).reverse();
  const withValue = points.filter((p) => p[measure] > 0).length;

  function locate(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    // The nearest district within reach: a generous target, not a pinpoint.
    let best = -1;
    let bestDist = 12 * 12;
    geo.xy.forEach(([x, y], i) => {
      const d = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHover(best >= 0 ? best : null);
  }

  const h = hover != null ? points[hover] : null;
  const [hx, hy] = hover != null ? geo.xy[hover] : [0, 0];

  return (
    <section className="card">
      <h2 className="font-semibold text-ink">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>

      {/* scale legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: ZERO }} /> None
        </span>
        {bounds.map((b, i) => {
          const lo = i === 0 ? Math.min(...points.map((p) => p[measure]).filter((v) => v > 0)) : bounds[i - 1] + 1;
          return (
            <span key={b} className="inline-flex items-center gap-1.5 tabular-nums">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(b) }} />
              {lo >= b ? fmt(b) : `${fmt(lo)}–${fmt(b)}`}
            </span>
          );
        })}
      </div>

      <div className="relative mx-auto mt-3 max-w-[460px]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${geo.width.toFixed(1)} ${geo.height.toFixed(1)}`}
          role="img"
          aria-label={`Map of India's ${points.length} districts; ${withValue} have ${WORD[measure][1]}.`}
          className={hover != null ? "w-full cursor-pointer" : "w-full"}
          onPointerMove={locate}
          onPointerLeave={() => setHover(null)}
          onClick={() => h && router.push(`/districts/${encodeURIComponent(h.district)}`)}
        >
          {order.map((i) => {
            const v = points[i][measure];
            const [x, y] = geo.xy[i];
            return v > 0 ? (
              <circle key={i} cx={x} cy={y} r={3.6} fill={colorOf(v)} stroke="#fff" strokeWidth={1.2} />
            ) : (
              <circle key={i} cx={x} cy={y} r={2.2} fill={ZERO} />
            );
          })}
          {hover != null && (
            <circle cx={hx} cy={hy} r={5.5} fill={colorOf(points[hover][measure])} stroke="#14112B" strokeWidth={1.5} />
          )}
        </svg>

        {h && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-xl bg-ink px-3 py-2 text-xs text-white/75 shadow-lift"
            style={{
              left: `${(hx / geo.width) * 100}%`,
              top: `${(hy / geo.height) * 100}%`,
              transform: hy < 70 ? "translate(-50%, 14px)" : "translate(-50%, calc(-100% - 12px))",
            }}
          >
            <div className="font-semibold text-white">{h.district}</div>
            <div>{h.state}</div>
            {(["calls", "openings"] as const).map((m) => (
              <div key={m} className="mt-1 flex items-center gap-2">
                <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: TOOLTIP_KEY[m] }} />
                <span>
                  <span className="font-semibold text-white tabular-nums">{fmt(h[m])}</span>{" "}
                  {h[m] === 1 ? WORD[m][0] : WORD[m][1]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Most {WORD[measure][1]}
        </h3>
        {top.length ? (
          <ol className="mt-2 space-y-1.5 text-sm">
            {top.map((i, rank) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <Link href={`/districts/${encodeURIComponent(points[i].district)}`} className="min-w-0 truncate text-ink hover:text-violet-700 hover:underline">
                  <span className="mr-2 text-ink-faint tabular-nums">{rank + 1}</span>
                  {points[i].district}
                  <span className="text-ink-faint">, {points[i].state}</span>
                </Link>
                <span className="shrink-0 font-semibold text-ink tabular-nums">{fmt(points[i][measure])}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">No district has {WORD[measure][1]} yet.</p>
        )}
      </div>
    </section>
  );
}
