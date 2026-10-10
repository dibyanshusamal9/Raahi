import type { Metadata } from "next";
import { api } from "@/lib/server-api";
import { fmt } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { DistrictTable, type DistrictRow } from "@/components/district-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Districts · RAAHI" };

export default async function DistrictsPage() {
  const { districts } = await api<{ districts: DistrictRow[] }>("/admin/districts");
  return (
    <div className="space-y-6">
      <PageHeader title="Districts">
        All {fmt(districts.length)} districts: the calls RAAHI received from each and the
        job openings recorded there. Open a district to compare its demand and supply
        by skill.
      </PageHeader>
      <DistrictTable rows={districts} />
    </div>
  );
}
