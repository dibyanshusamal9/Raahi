// Browser-side client for the voice backend's /officer and /admin APIs.
// Requests go through this site's /voice-api proxy (next.config.mjs), which
// passes the officer's session cookie along; an ended session sends the
// officer back to the sign-in page.

export type Course = {
  qp_code: string;
  name: string;
  sector: string;
  nsqf_level: number | null;
};

export type Job = {
  id: string;
  district: string;
  state: string;
  sector: string;
  qp_code: string | null;
  role_title: string;
  vacancies_90d: number;
  median_wage_inr: number | null;
  source_url: string;
  source_note: string | null;
  entered_by: string | null;
  evidence_date: string;        // YYYY-MM-DD
  created_at: string;
  counted: boolean;             // recent enough for the recommender to count
  origin: "officer" | "seed" | "illustrative";
};

export type NewJob = {
  state: string;
  district: string;
  qp_code: string | null;
  role_title: string | null;
  sector: string | null;
  vacancies: number;
  median_wage_inr: number | null;
  evidence_date: string;
  source_url: string | null;
  source_note: string | null;
};

export type JobChange = Partial<
  Pick<NewJob, "role_title" | "vacancies" | "median_wage_inr" | "evidence_date" | "source_url" | "source_note">
>;

export class OfficerApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const BASE = "/voice-api";

const FIELD: Record<string, string> = {
  vacancies: "Openings", median_wage_inr: "Monthly wage", evidence_date: "Date",
  source_url: "Source link", source_note: "Note", role_title: "Job role",
  sector: "Sector", district: "District", state: "State",
};

async function failure(r: Response): Promise<string> {
  try {
    const { detail } = await r.json();
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      // FastAPI validation errors: [{loc: ["body", "vacancies"], msg}]
      return detail
        .map((d) => {
          const field = FIELD[d?.loc?.[d.loc.length - 1]];
          return field ? `${field}: ${d.msg}.` : `${d.msg}.`;
        })
        .join(" ");
    }
  } catch {
    /* not JSON: the proxy couldn't reach the backend, or it crashed */
  }
  return r.status >= 500
    ? "The RAAHI server isn't responding. Check that the backend is running, then try again."
    : `Request failed (${r.status}).`;
}

function signInAgain() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/signin?reason=expired&next=${encodeURIComponent(next)}`);
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}${path}`, {
      ...init,
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
      cache: "no-store",
    });
  } catch {
    throw new OfficerApiError("Can't reach this site's server. Check your connection.", 0);
  }
  if (r.status === 401) {
    signInAgain();
    throw new OfficerApiError("Your session has ended. Please sign in again.", 401);
  }
  if (!r.ok) throw new OfficerApiError(await failure(r), r.status);
  return r.json() as Promise<T>;
}

const q = encodeURIComponent;

export const officerApi = {
  states: () => call<{ states: string[] }>("/officer/states").then((r) => r.states),
  districts: (state: string) =>
    call<{ districts: string[] }>(`/officer/districts?state=${q(state)}`).then((r) => r.districts),
  sectors: () => call<{ sectors: string[] }>("/officer/sectors").then((r) => r.sectors),
  courses: (search: string) =>
    call<{ courses: Course[] }>(`/officer/courses?search=${q(search)}`).then((r) => r.courses),
  jobs: (district: string) =>
    call<{ jobs: Job[] }>(`/officer/jobs?district=${q(district)}`).then((r) => r.jobs),
  add: (job: NewJob) =>
    call<{ job: Job }>("/officer/jobs", { method: "POST", body: JSON.stringify(job) }).then((r) => r.job),
  update: (id: string, change: JobChange) =>
    call<{ job: Job }>(`/officer/jobs/${id}`, { method: "PATCH", body: JSON.stringify(change) })
      .then((r) => r.job),
  remove: (id: string) => call<{ deleted: string }>(`/officer/jobs/${id}`, { method: "DELETE" }),
  deleteBeneficiaries: (ids: string[]) =>
    call<{ deleted: number }>("/admin/beneficiaries/delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }).then((r) => r.deleted),
};
