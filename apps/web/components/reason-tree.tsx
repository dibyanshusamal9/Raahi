"use client";

type Signal = { key: string; score: number };

export function ReasonTree({
  top,
  profile,
  demandEvidence,
}: {
  top: any;
  profile: any;
  demandEvidence: any[];
}) {
  const signals: Signal[] = [
    { key: "aspiration",   score: Number(top.score_aspiration) },
    { key: "demand",       score: Number(top.score_demand) },
    { key: "mobility",     score: Number(top.score_mobility) },
    { key: "gap",          score: Number(top.score_gap) },
    { key: "centre_hist",  score: Number(top.score_history) },
  ].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-sm text-ink-faint">Chosen pathway</div>
        <div className="mt-1 text-xl font-semibold tracking-tight text-ink">{top.qualification_name}</div>
        <div className="mt-0.5 text-sm text-ink-soft">
          {top.sector} · L{top.nsqf_level} · {top.duration_hours}h
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`chip ${top.hard_filter === "PASS" ? "tag-pass" : top.hard_filter === "FAIL" ? "tag-fail" : "tag-unk"}`}>
            {top.hard_filter}
          </span>
          <span className="chip tabular-nums">total {Number(top.total_score).toFixed(3)}</span>
          {top.distance_km != null && <span className="chip tabular-nums">{top.distance_km} km</span>}
        </div>
      </div>

      <div className="card">
        <div className="font-semibold text-ink">Per-signal scores</div>
        <div className="mt-4 space-y-3">
          {signals.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3 text-sm">
              <div className="w-28 shrink-0 font-mono text-xs text-ink-soft sm:w-32">{s.key}</div>
              <div className="bar-track bar-track-hatch flex-1">
                {/* the strongest signal is solid violet */}
                <div
                  className={i === 0 ? "h-full rounded-full bg-violet-600" : "bar-fill"}
                  style={{ width: `${s.score * 100}%` }}
                />
              </div>
              <div className="w-12 shrink-0 text-right font-semibold text-ink tabular-nums">{s.score.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="font-semibold text-ink">Profile snapshot at recommendation time</div>
        <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-line bg-canvas p-4 font-mono text-xs leading-relaxed text-ink-soft">
{JSON.stringify(profile, null, 2)}
        </pre>
      </div>

      <div className="card">
        <div className="font-semibold text-ink">Demand evidence used</div>
        {demandEvidence?.length ? (
          <ul className="mt-3 divide-y divide-line text-sm">
            {demandEvidence.map((d: any) => (
              <li key={d.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="chip tag-violet max-w-[45%] shrink-0 break-all">{d.qp_code || d.sector}</span>
                <div className="min-w-0">
                  <div className="text-ink">
                    {d.role_title} — <span className="font-semibold tabular-nums">{d.vacancies_90d}</span> vacancies (90d)
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {d.district} · {d.evidence_date} ·{" "}
                    <a href={d.source_url} target="_blank" rel="noreferrer"
                       className="font-medium text-violet-700 underline-offset-2 hover:underline">source</a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 text-sm text-ink-soft">No demand rows contributed to this recommendation.</div>
        )}
      </div>
    </div>
  );
}
