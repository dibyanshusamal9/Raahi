import { notFound } from "next/navigation";
import { apiOrNull } from "@/lib/server-api";
import { ReasonTree } from "@/components/reason-tree";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Recommendation · RAAHI" };

export default async function RecPage({ params }: { params: { id: string } }) {
  const data = await apiOrNull<any>(`/admin/explain/${encodeURIComponent(params.id)}`);
  if (!data) notFound();
  const rec = data.recommendation;
  const top = (rec.top3 as any[])[0];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Recommendation" title={`${rec.id.slice(0, 8)}…`} titleClassName="font-mono">
        made {new Date(rec.created_at).toLocaleString()}
      </PageHeader>

      <ReasonTree
        top={top}
        profile={rec.profile_snapshot}
        demandEvidence={data.demand_evidence}
      />

      <section className="card">
        <div className="font-semibold text-ink">Composer transcript</div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{rec.composer_text}</p>
      </section>

      <section className="card">
        <div className="font-semibold text-ink">Session turns</div>
        {/* a timeline: one node per turn on a thin vertical line */}
        <ol className="relative mt-4 space-y-5 text-sm before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-line">
          {(data.session_turns || []).map((t: any) => (
            <li key={t.turn_no} className="relative flex gap-4">
              <span className="z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-white text-xs font-semibold text-violet-700 shadow-sm">
                t{t.turn_no}
              </span>
              <div className="min-w-0 flex-1 rounded-2xl border border-line bg-canvas/60 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">asked</div>
                <div className="mt-0.5 text-ink">{t.asked}</div>
                <div className="mt-2.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
                  heard <span className="chip normal-case tracking-normal">{t.stt_provider}</span>
                </div>
                <div className="mt-0.5 text-ink">{t.heard_text}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
