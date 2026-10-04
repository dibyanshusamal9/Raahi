const ORDER = ["counselled","enrolled","in_training","certified","placed","dropped"];

export function Funnel({ counts }: { counts: { state: string; n: number }[] }) {
  const map = Object.fromEntries(counts.map((c) => [c.state, c.n]));
  const max = Math.max(1, ...ORDER.map((s) => map[s] || 0));
  return (
    <div className="card">
      <div className="font-semibold text-ink">Cohort funnel</div>
      <div className="mt-4 space-y-3">
        {ORDER.map((s) => {
          const n = map[s] || 0;
          return (
            <div key={s}>
              <div className="flex justify-between text-xs">
                <span className="font-mono uppercase tracking-wide text-ink-faint">{s}</span>
                <span className="font-semibold text-ink tabular-nums">{n}</span>
              </div>
              <div className="bar-track mt-1.5">
                {/* the largest stage is solid violet, the rest grey, as in a bar chart */}
                <div
                  className={n > 0 && n === max ? "h-full rounded-full bg-violet-600" : "bar-grey"}
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
