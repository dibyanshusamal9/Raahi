import type { Metadata } from "next";
import { JobsDesk } from "@/components/jobs-desk";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Job openings · RAAHI",
  description: "District officers record job openings for RAAHI's course suggestions",
};

export default function JobsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Job openings">
        Record the jobs open in your district. RAAHI suggests training to callers from
        a district based on its openings from the last 180 days, so a new entry counts
        from the next call.
      </PageHeader>
      <JobsDesk />
    </div>
  );
}
