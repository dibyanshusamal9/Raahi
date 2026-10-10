import { api } from "@/lib/server-api";
import { BeneficiariesView, type Beneficiary } from "@/components/beneficiaries-view";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Beneficiaries · RAAHI" };

export default async function BeneficiariesPage() {
  const { beneficiaries, count } = await api<{ beneficiaries: Beneficiary[]; count: number }>(
    "/admin/beneficiaries"
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Beneficiaries">
        The full, persistent record of everyone counselled ({count} total) —
        grouped by state, sorted by district, skill and most recent first.
        Not just the current session.
      </PageHeader>
      <BeneficiariesView rows={beneficiaries} />
    </div>
  );
}
