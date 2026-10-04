"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mt-10 max-w-xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink">This page couldn&apos;t load</h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        The RAAHI server didn&apos;t answer. Check that the backend is running, then try again.
      </p>
      <button type="button" className="btn-primary mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
