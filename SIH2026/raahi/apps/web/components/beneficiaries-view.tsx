"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { officerApi } from "@/lib/officer";
import { fmt, fmtDateTime, languageName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SearchIcon, Stat } from "@/components/ui";

export type Beneficiary = {
  id: string;
  name: string;
  district: string | null;
  state: string | null;
  age: number | null;
  education_note: string | null;
  education_class: number | null;
  interests: string[] | null;
  aspiration: string | null;
  social_category: string | null;
  language: string | null;
  skill: string | null;              // the skill they asked for, in English
  calls: number;
  rec_id: string | null;             // their latest recommendation
  top3: any[] | null;
  recommended_at: string | null;
  updated_at: string;
};

// Nothing was recorded: the caller hung up before giving any details.
const hasNoDetails = (b: Beneficiary) =>
  b.name === "—" && !b.district && !b.skill && b.age == null && !b.social_category;

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.1a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.1"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BeneficiariesView({ rows }: { rows: Beneficiary[] }) {
  const router = useRouter();
  const [qtext, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const states = useMemo(
    () => [...new Set(rows.map((r) => r.state).filter(Boolean))].sort() as string[],
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = qtext.trim().toLowerCase();
    return rows.filter((r) => {
      if (stateFilter && r.state !== stateFilter) return false;
      if (!needle) return true;
      const hay = [r.name, r.district, r.state, r.skill, r.social_category, languageName(r.language)]
        .join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, qtext, stateFilter]);

  // group by STATE, then the API already sorts district → skill → time
  const groups = useMemo(() => {
    const m = new Map<string, Beneficiary[]>();
    for (const b of filtered) {
      const k = b.state || "Unknown state";
      (m.get(k) || m.set(k, []).get(k)!).push(b);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const totalDistricts = useMemo(
    () => new Set(filtered.map((r) => r.district).filter(Boolean)).size,
    [filtered]
  );
  const noDetails = useMemo(() => rows.filter(hasNoDetails).map((b) => b.id), [rows]);
  const chosen = rows.filter((r) => selected.has(r.id));

  function choose(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
    setConfirming(false);
    setMessage(null);
  }

  async function remove() {
    const ids = [...selected];
    setBusy(true);
    setMessage(null);
    try {
      const n = await officerApi.deleteBeneficiaries(ids);
      setSelected(new Set());
      setConfirming(false);
      setMessage({
        ok: true,
        text: `Deleted ${fmt(n)} ${n === 1 ? "beneficiary" : "beneficiaries"}, with their calls and recommendations.`,
      });
      startRefresh(() => router.refresh());
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Couldn't delete. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const who = chosen.length === 1 && chosen[0].name !== "—" ? chosen[0].name : null;

  return (
    <div className={cn("space-y-5 transition-opacity", refreshing && "opacity-60")}>
      {/* summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Beneficiaries" value={filtered.length} />
        <Stat label="States" value={states.length} />
        <Stat label="Districts" value={totalDistricts} />
        <Stat label="Languages" value={new Set(filtered.map((r) => r.language).filter(Boolean)).size} />
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={qtext}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, district, skill…"
            aria-label="Search beneficiaries"
            className="field rounded-full pl-10"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          aria-label="State"
          className="field w-auto rounded-full"
        >
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(qtext || stateFilter) && (
          <button onClick={() => { setQ(""); setStateFilter(""); }}
            className="text-sm font-medium text-violet-700 underline-offset-2 hover:underline">clear</button>
        )}
      </div>

      {/* selection and delete */}
      {(selected.size > 0 || noDetails.length > 0 || message) && (
        <div className="sticky top-3 z-20 space-y-2">
          {confirming && selected.size > 0 ? (
            <div role="alertdialog" aria-label="Confirm delete"
                 className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-lift">
              <p className="min-w-0 flex-1 text-sm text-red-900">
                <span className="font-semibold">
                  Delete {who ?? `${fmt(selected.size)} ${selected.size === 1 ? "beneficiary" : "beneficiaries"}`}?
                </span>{" "}
                Their calls, recommendations and enrollments are deleted too. This can&apos;t be undone.
              </p>
              <button type="button" className="btn-danger" disabled={busy} onClick={remove}>
                {busy ? "Deleting…" : `Yes, delete ${fmt(selected.size)}`}
              </button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          ) : selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-white/95 px-4 py-3 shadow-lift backdrop-blur">
              <span className="text-sm font-semibold text-ink">{fmt(selected.size)} selected</span>
              <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>Delete</button>
              <button type="button" className="btn-ghost" onClick={() => choose([...selected], false)}>Clear selection</button>
            </div>
          ) : noDetails.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/90 px-4 py-3 backdrop-blur">
              <span className="text-sm text-ink-soft">
                {fmt(noDetails.length)} {noDetails.length === 1 ? "record has" : "records have"} no details: the
                caller hung up before saying anything.
              </span>
              <button type="button" className="btn-ghost" onClick={() => choose(noDetails, true)}>
                Select them
              </button>
            </div>
          ) : null}
          {message && (
            <p role="status" className={cn(
              "rounded-xl px-4 py-2.5 text-sm",
              message.ok ? "border border-green-100 bg-green-50 text-green-800" : "border border-red-100 bg-red-50 text-red-800",
            )}>
              {message.text}
            </p>
          )}
        </div>
      )}

      {groups.length === 0 && (
        <div className="card py-10 text-center text-ink-soft">
          No beneficiaries match. Complete an interview on the voice line and it appears here.
        </div>
      )}

      {groups.map(([state, list]) => {
        const ids = list.map((b) => b.id);
        const all = ids.every((id) => selected.has(id));
        return (
          <details key={state} open className="card group overflow-hidden p-0">
            <summary className="flex cursor-pointer select-none list-none items-center gap-2.5 px-5 py-4 transition-colors hover:bg-violet-50/40 [&::-webkit-details-marker]:hidden">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"
                   className="h-4 w-4 -rotate-90 text-ink-faint transition-transform group-open:rotate-0">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-semibold text-ink">{state}</span>
              <span className="chip tag-violet tabular-nums">{list.length}</span>
            </summary>
            {/* relative: keeps the table's screen-reader labels inside the scroll box */}
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head border-t">
                  <tr>
                    <th className="w-10 py-3 pl-5 pr-1 text-left">
                      <input
                        type="checkbox"
                        aria-label={`Select everyone in ${state}`}
                        className="h-4 w-4 accent-violet-600"
                        checked={all}
                        onChange={(e) => choose(ids, e.target.checked)}
                      />
                    </th>
                    {["Name", "District", "Skill", "Age", "Education", "Category", "Top pathway", "Language", "Seen"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 text-left font-semibold">{h}</th>
                    ))}
                    <th className="px-4 py-3"><span className="sr-only">Delete</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((b) => {
                    const top = Array.isArray(b.top3) && b.top3.length
                      ? (b.top3[0].qualification_name || b.top3[0].qp_code || "—") : "—";
                    const edu = b.education_note || (b.education_class != null ? `Class ${b.education_class}` : "—");
                    const label = b.name === "—" ? "this record" : b.name;
                    return (
                      <tr key={b.id} className={cn("table-row text-ink", selected.has(b.id) && "bg-violet-50/70")}>
                        <td className="py-3 pl-5 pr-1">
                          <input
                            type="checkbox"
                            aria-label={`Select ${label}`}
                            className="h-4 w-4 accent-violet-600"
                            checked={selected.has(b.id)}
                            onChange={(e) => choose([b.id], e.target.checked)}
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold">{b.name}</td>
                        <td className="px-4 py-3">{b.district || "—"}</td>
                        <td className="px-4 py-3">
                          {b.skill ? <span className="chip">{b.skill}</span> : <span className="text-ink-faint">—</span>}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{b.age ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3">{edu}</td>
                        <td className="px-4 py-3">{b.social_category || "—"}</td>
                        <td className="px-4 py-3">
                          {b.rec_id && top !== "—" ? (
                            <Link href={`/recommendations/${b.rec_id}`} className="font-medium text-violet-700 underline-offset-2 hover:underline">
                              {top}
                            </Link>
                          ) : top}
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{languageName(b.language)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-faint">{fmtDateTime(b.recommended_at || b.updated_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            aria-label={`Delete ${label}`}
                            title="Delete"
                            className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition hover:bg-red-50 hover:text-red-700"
                            onClick={() => {
                              setSelected(new Set([b.id]));
                              setMessage(null);
                              setConfirming(true);
                            }}
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}
