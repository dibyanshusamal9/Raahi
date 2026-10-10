import Link from "next/link";
import { api } from "@/lib/server-api";
import { PLATFORM } from "@/lib/brand";
import { fmt, languageName } from "@/lib/format";
import { ArrowCircle, ArrowIcon, PageHeader, Panel, Stat } from "@/components/ui";
import { BarList } from "@/components/charts/bar-list";
import { ChartCard, MiniTable } from "@/components/charts/chart-card";
import { ColumnChart } from "@/components/charts/column-chart";
import { DemandSupply, type Area } from "@/components/charts/demand-supply";
import { IndiaMap, type DistrictPoint } from "@/components/charts/india-map";

export const dynamic = "force-dynamic";

type Overview = {
  kpis: {
    calls: number;
    callers: number;
    districts_reached: number;
    openings: number;
    districts_with_openings: number;
    centres: number;
  };
  calls_by_day: { day: string; calls: number }[];
  languages: { language: string; calls: number }[];
  skills: { skill: string; calls: number }[];
  areas: Area[];
  districts: DistrictPoint[];
};

const day = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", opts);

export default async function OverviewPage() {
  const o = await api<Overview>("/admin/overview");
  const { kpis } = o;
  const days = o.calls_by_day.map((d) => ({
    key: d.day,
    label: day(d.day, { weekday: "short", day: "numeric", month: "short" }),
    tick: day(d.day, { day: "numeric", month: "short" }),
    value: d.calls,
  }));
  const lastMonth = days.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={PLATFORM}>
        Calls to RAAHI and job openings across India: where callers are, the skills
        they ask for, and whether there are jobs for them.
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Calls received" value={kpis.calls} note={`${fmt(kpis.callers)} people on record`} />
        <Stat label="Districts reached" value={kpis.districts_reached} note="callers' home districts" />
        <Stat
          label="Job openings"
          value={kpis.openings}
          note={`last 180 days, in ${fmt(kpis.districts_with_openings)} districts`}
        />
        <Stat label="Training centres" value={kpis.centres} />
      </div>

      <Panel
        title="Demand vs supply by skill area"
        subtitle="Calls asking for a skill, against job openings in that skill's sector, across India"
      >
        <DemandSupply areas={o.areas} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <IndiaMap
          points={o.districts}
          measure="calls"
          title="Calls by district"
          subtitle="Where callers live. Click a district to open it."
        />
        <IndiaMap
          points={o.districts}
          measure="openings"
          title="Job openings by district"
          subtitle="Openings recorded in the last 180 days."
        />
      </div>
      <p className="-mt-3 text-xs text-ink-soft">
        Dot positions are approximate for some districts.{" "}
        <Link href="/districts" className="font-medium text-violet-700 underline-offset-2 hover:underline">
          See every district as a table
        </Link>
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Most-wanted skills" subtitle="Calls by the skill the caller asked for">
          <BarList
            measure="calls"
            rows={o.skills.map((s) => ({ label: s.skill, value: s.calls }))}
            empty="No caller has named a skill yet."
          />
        </Panel>
        <Panel title="Calls by language" subtitle="The language each call was in">
          <BarList
            measure="calls"
            rows={o.languages.map((l) => ({ label: languageName(l.language), value: l.calls }))}
            empty="No calls yet."
          />
        </Panel>
      </div>

      <ChartCard
        title="Calls per day"
        subtitle={`Last 30 days: ${fmt(lastMonth)} ${lastMonth === 1 ? "call" : "calls"}`}
        chart={<ColumnChart columns={days} unit={["call", "calls"]} />}
        table={<MiniTable head={["Day", "Calls"]} rows={[...days].reverse().map((d) => [d.label, fmt(d.value)])} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Link
          href="/jobs"
          className="group relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[24px] bg-gradient-to-r from-violet-700 via-violet-600 to-violet-500 px-6 py-6 text-white shadow-lift transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 sm:px-8 lg:col-span-2"
        >
          <span aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-60 w-60 rounded-full bg-white/15 blur-2xl" />
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <span className="relative">
            <span className="block text-sm text-white/85">For district officers</span>
            <span className="mt-1 block text-xl font-semibold tracking-tight sm:text-2xl">Add job openings</span>
          </span>
          <span className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-violet-700 transition group-hover:scale-105">
            <ArrowIcon className="h-4 w-4" />
          </span>
        </Link>
        <Link href="/beneficiaries" className="card group flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-ink-faint">Records</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">All beneficiaries ({fmt(kpis.callers)})</div>
          </div>
          <ArrowCircle />
        </Link>
      </div>
    </div>
  );
}
