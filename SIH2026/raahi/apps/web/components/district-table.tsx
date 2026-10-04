"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmt } from "@/lib/format";
import { SearchIcon } from "@/components/ui";

export type DistrictRow = {
  district: string;
  state: string;
  calls: number;
  callers: number;
  openings: number;
  top_sector: string | null;
  top_skill: string | null;
  centres: number;
};

type Sort = "calls" | "openings" | "name";
const PAGE = 50;

export function DistrictTable({ rows }: { rows: DistrictRow[] }) {
  const [text, setText] = useState("");
  const [state, setState] = useState("");
  const [withCalls, setWithCalls] = useState(false);
  const [sort, setSort] = useState<Sort>("calls");
  const [limit, setLimit] = useState(PAGE);

  const states = useMemo(() => [...new Set(rows.map((r) => r.state))].sort(), [rows]);
  const shown = useMemo(() => {
    const needle = text.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (!state || r.state === state) &&
        (!withCalls || r.calls > 0) &&
        (!needle || `${r.district} ${r.state}`.toLowerCase().includes(needle)),
    );
    const byName = (a: DistrictRow, b: DistrictRow) => a.district.localeCompare(b.district);
    return list.sort(
      sort === "name"
        ? byName
        : sort === "calls"
          ? (a, b) => b.calls - a.calls || b.openings - a.openings || byName(a, b)
          : (a, b) => b.openings - a.openings || b.calls - a.calls || byName(a, b),
    );
  }, [rows, text, state, withCalls, sort]);

  // Filters change the list, so start again from its top.
  function filter<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setLimit(PAGE);
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            aria-label="Search districts"
            placeholder="Search a district or state"
            className="field rounded-full pl-10"
            value={text}
            onChange={(e) => filter(setText)(e.target.value)}
          />
        </div>
        <select
          aria-label="State"
          className="field w-auto rounded-full"
          value={state}
          onChange={(e) => filter(setState)(e.target.value)}
        >
          <option value="">All states</option>
          {states.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          aria-label="Sort by"
          className="field w-auto rounded-full"
          value={sort}
          onChange={(e) => filter(setSort)(e.target.value as Sort)}
        >
          <option value="calls">Most calls</option>
          <option value="openings">Most job openings</option>
          <option value="name">A to Z</option>
        </select>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            className="h-4 w-4 accent-violet-600"
            checked={withCalls}
            onChange={(e) => filter(setWithCalls)(e.target.checked)}
          />
          Only districts with calls
        </label>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">District</th>
                <th className="px-4 py-3 text-right font-semibold">Calls</th>
                <th className="px-4 py-3 text-right font-semibold">Callers</th>
                <th className="px-4 py-3 text-right font-semibold">Job openings</th>
                <th className="px-4 py-3 text-left font-semibold">Skill asked most</th>
                <th className="px-4 py-3 text-left font-semibold">Most openings in</th>
                <th className="px-5 py-3 text-right font-semibold">Centres</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((r) => (
                <tr key={r.district} className="table-row text-ink">
                  <td className="px-5 py-3">
                    <Link
                      href={`/districts/${encodeURIComponent(r.district)}`}
                      className="font-semibold hover:text-violet-700 hover:underline"
                    >
                      {r.district}
                    </Link>
                    <div className="text-xs text-ink-faint">{r.state}</div>
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${r.calls ? "font-semibold" : "text-ink-faint"}`}>
                    {fmt(r.calls)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{fmt(r.callers)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(r.openings)}</td>
                  <td className="px-4 py-3">{r.top_skill ?? <span className="text-ink-faint">—</span>}</td>
                  <td className="px-4 py-3 text-ink-soft">{r.top_sector ?? "—"}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink-soft">{fmt(r.centres)}</td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-ink-soft">No district matches.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
        <span>
          Showing {fmt(Math.min(limit, shown.length))} of {fmt(shown.length)} districts
        </span>
        {shown.length > limit && (
          <button type="button" className="btn-ghost" onClick={() => setLimit((l) => l + PAGE)}>
            Show {fmt(Math.min(PAGE, shown.length - limit))} more
          </button>
        )}
      </div>
    </div>
  );
}
