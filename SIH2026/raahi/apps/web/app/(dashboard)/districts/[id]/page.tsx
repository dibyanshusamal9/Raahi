import Link from "next/link";
import { notFound } from "next/navigation";
import { apiOrNull } from "@/lib/server-api";
import { fmt, fmtDateTime, languageName } from "@/lib/format";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { BarList } from "@/components/charts/bar-list";
import { DemandSupply, type Area } from "@/components/charts/demand-supply";
import { Funnel } from "@/components/funnel";

export const dynamic = "force-dynamic";

type Summary = {
  district: string;
  state: string;
  kpis: { calls: number; callers: number; openings: number; centres: number };
  areas: Area[];
  roles: { role_title: string; sector: string; openings: number }[];
  callers: {
    id: string;
    name: string;
    skill: string | null;
    language: string | null;
    updated_at: string;
    calls: number;
    rec_id: string | null;
    top_course: string | null;
  }[];
  centres: { name: string; address: string; sectors: string[] | null; courses: number }[];
  funnel: { state: string; n: number }[];
};

function decode(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `${decode(params.id)} · RAAHI` };
}

export default async function DistrictPage({ params }: { params: { id: string } }) {
  const name = decode(params.id);
  const s = await apiOrNull<Summary>(`/admin/districts/${encodeURIComponent(name)}/summary`);
  if (!s) notFound();
  const { kpis } = s;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="district view" title={s.district}>{s.state}</PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Calls received" value={kpis.calls} />
        <Stat label="Callers" value={kpis.callers} />
        <Stat label="Job openings" value={kpis.openings} note="last 180 days" />
        <Stat label="Training centres" value={kpis.centres} />
      </div>

      <Panel
        title="Demand vs supply by skill area"
        subtitle={`Calls from ${s.district} asking for a skill, against job openings in that skill's sector here`}
      >
        <DemandSupply areas={s.areas} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Top job openings"
          subtitle="By role, last 180 days"
          action={
            <Link href="/jobs" className="text-sm font-medium text-violet-700 underline-offset-2 hover:underline">
              Add or edit openings
            </Link>
          }
        >
          <BarList
            measure="openings"
            rows={s.roles.map((r) => ({ label: r.role_title, value: r.openings, detail: r.sector }))}
            empty="No job openings recorded here in the last 180 days."
          />
        </Panel>

        <Panel title={`Callers from ${s.district}`} subtitle="Most recent first">
          {s.callers.length ? (
            <ul className="divide-y divide-line">
              {s.callers.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{c.name}</div>
                    <div className="mt-0.5 text-xs text-ink-soft">
                      {c.skill ?? "No skill named"} · {languageName(c.language)} · {fmt(c.calls)}{" "}
                      {c.calls === 1 ? "call" : "calls"}
                    </div>
                    {c.top_course && (
                      <div className="mt-1 text-xs text-ink-soft">
                        Suggested:{" "}
                        {c.rec_id ? (
                          <Link href={`/recommendations/${c.rec_id}`} className="font-medium text-violet-700 underline-offset-2 hover:underline">
                            {c.top_course}
                          </Link>
                        ) : (
                          c.top_course
                        )}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint">{fmtDateTime(c.updated_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-ink-soft">No calls from {s.district} yet.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Training centres" subtitle={`${fmt(kpis.centres)} active here, most courses first`}>
          {s.centres.length ? (
            <ul className="divide-y divide-line">
              {s.centres.map((c) => (
                <li key={c.name} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{c.name}</div>
                    <div className="mt-0.5 truncate text-xs text-ink-faint">{c.address}</div>
                    {c.sectors?.length ? (
                      <div className="mt-1 text-xs text-ink-soft">{c.sectors.join(", ")}</div>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-right text-xs text-ink-soft">
                    <span className="block text-sm font-semibold text-ink tabular-nums">{fmt(c.courses)}</span>
                    {c.courses === 1 ? "course" : "courses"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-ink-soft">No training centre recorded in {s.district}.</p>
          )}
        </Panel>
        <Funnel counts={s.funnel} />
      </div>
    </div>
  );
}
