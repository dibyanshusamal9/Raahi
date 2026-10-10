"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  officerApi, OfficerApiError,
  type Course, type Job, type JobChange,
} from "@/lib/officer";
import { ArrowSquare, SearchIcon } from "@/components/ui";

const PLACE_KEY = "raahi.jobs.place";
const COUNTED_DAYS = 180;   // the recommender counts openings this recent
const MAX_AGE_DAYS = 365;   // the backend refuses anything older

const inr = new Intl.NumberFormat("en-IN");

function isoDay(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
}
function fmtDate(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}
function errorText(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}
const isLink = (url: string) => /^https?:\/\//i.test(url);
const digits = (s: string) => s.replace(/\D/g, "").slice(0, 6);
const plural = (n: number, one: string, many: string) => `${inr.format(n)} ${n === 1 ? one : many}`;

// The same limits the backend enforces, checked first for quicker feedback.
function checkEntry(
  { openings, wage, date, link }: { openings: string; wage: string; date: string; link: string },
  checkDate = true,
): string {
  const n = Number(openings);
  if (!openings || n < 1) return "Enter the number of openings.";
  if (n > 100_000) return "That's more than 1,00,000 openings. Please check the number.";
  if (wage && (Number(wage) < 1_000 || Number(wage) > 500_000))
    return "The monthly wage should be between ₹1,000 and ₹5,00,000.";
  if (checkDate) {
    if (!date) return "Enter the date of this information.";
    if (date > isoDay(new Date())) return "The date can't be in the future.";
    if (date < daysAgo(MAX_AGE_DAYS)) return "Only openings from the last 12 months can be added.";
  }
  if (link.trim() && !isLink(link.trim())) return "The source link must start with http:// or https://.";
  return "";
}

export function JobsDesk() {
  const [ready, setReady] = useState(false);
  const [stateName, setStateName] = useState("");
  const [district, setDistrict] = useState("");
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [jobsError, setJobsError] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    try {
      const place = JSON.parse(localStorage.getItem(PLACE_KEY) || "null");
      if (place?.state) {
        setStateName(place.state);
        setDistrict(place.district || "");
      }
    } catch {
      /* nothing remembered */
    }
    setReady(true);
  }, []);

  function choose(state: string, d: string) {
    setStateName(state);
    setDistrict(d);
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify({ state, district: d }));
    } catch {
      /* not remembered next time */
    }
  }

  const loadJobs = useCallback(async () => {
    const mine = ++request.current;   // a slower, older request must not win
    if (!district) return;
    try {
      const rows = await officerApi.jobs(district);
      if (mine === request.current) {
        setJobs(rows);
        setJobsError("");
      }
    } catch (e) {
      if (mine === request.current) setJobsError(errorText(e));
    }
  }, [district]);

  useEffect(() => {
    setJobs(null);
    setJobsError("");
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 4000);
    return () => clearTimeout(t);
  }, [fresh]);

  async function changed(id: string | null) {
    await loadJobs();
    setFresh(id);
  }

  if (!ready) return <div className="card text-sm text-ink-faint">Loading…</div>;

  return (
    <div className="space-y-6">
      <PlacePicker state={stateName} district={district} onChange={choose} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <AddOpenings state={stateName} district={district} onAdded={changed} />
        <OpeningsList
          district={district}
          jobs={jobs}
          error={jobsError}
          fresh={fresh}
          onChanged={changed}
          onRetry={loadJobs}
        />
      </div>
    </div>
  );
}

function PlacePicker({ state, district, onChange }: {
  state: string;
  district: string;
  onChange: (state: string, district: string) => void;
}) {
  const uid = useId();
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    officerApi.states().then(setStates).catch((e) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    setDistricts([]);
    if (!state) return;
    let live = true;
    officerApi
      .districts(state)
      .then((d) => live && setDistricts(d))
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [state]);

  return (
    <div className="card flex flex-wrap items-end gap-4">
      <div className="w-full sm:w-60">
        <label htmlFor={`${uid}-state`} className="label">State</label>
        <select
          id={`${uid}-state`}
          className="field mt-1.5"
          value={state}
          onChange={(e) => onChange(e.target.value, "")}
        >
          <option value="">Choose a state</option>
          {states.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="w-full sm:w-60">
        <label htmlFor={`${uid}-district`} className="label">District</label>
        <select
          id={`${uid}-district`}
          className="field mt-1.5"
          value={district}
          disabled={!state}
          onChange={(e) => onChange(state, e.target.value)}
        >
          <option value="">{state ? "Choose a district" : "Choose a state first"}</option>
          {districts.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </div>
  );
}

function AddOpenings({ state, district, onAdded }: {
  state: string;
  district: string;
  onAdded: (id: string) => Promise<void>;
}) {
  const uid = useId();
  const [course, setCourse] = useState<Course | null>(null);
  const [custom, setCustom] = useState(false);
  const [role, setRole] = useState("");
  const [sector, setSector] = useState("");
  const [sectors, setSectors] = useState<string[]>([]);
  const [openings, setOpenings] = useState("");
  const [wage, setWage] = useState("");
  const [date, setDate] = useState(() => isoDay(new Date()));
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (custom && !sectors.length) officerApi.sectors().then(setSectors).catch((e) => setError(errorText(e)));
  }, [custom, sectors.length]);

  useEffect(() => {
    setError("");
    setDone("");
  }, [district]);

  // Any edit clears the last message.
  function touch() {
    setError("");
    setDone("");
  }

  if (!district) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Add job openings</h2>
        <p className="mt-1 text-sm text-ink-soft">Choose the state and district above to start.</p>
      </section>
    );
  }

  const roleName = course?.name ?? (custom ? role.trim() : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = !course && !custom
      ? "Pick the job role from the course list, or enter it yourself."
      : custom && role.trim().length < 3
        ? "Enter the job role."
        : custom && !sector
          ? "Choose the sector this job belongs to."
          : checkEntry({ openings, wage, date, link });
    if (problem) return setError(problem);
    setBusy(true);
    touch();
    try {
      const job = await officerApi.add({
        state,
        district,
        qp_code: course?.qp_code ?? null,
        role_title: course ? null : role.trim(),
        sector: course ? null : sector,
        vacancies: Number(openings),
        median_wage_inr: wage ? Number(wage) : null,
        evidence_date: date,
        source_url: link.trim() || null,
        source_note: note.trim() || null,
      });
      // Date, link and note usually stay the same for the next role.
      setCourse(null);
      setCustom(false);
      setRole("");
      setSector("");
      setOpenings("");
      setWage("");
      setDone(`Added ${plural(job.vacancies_90d, "opening", "openings")} for ${job.role_title} in ${job.district}.`);
      await onAdded(job.id);
      document.getElementById(`${uid}-role`)?.focus();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5" noValidate>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Add job openings in {district}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Callers from {district} are offered training for the jobs open here.
        </p>
      </div>

      <div>
        <label htmlFor={`${uid}-role`} className="label">Job role</label>
        {custom ? (
          <div className="mt-1.5 space-y-2">
            <input
              id={`${uid}-role`}
              className="field"
              value={role}
              maxLength={120}
              placeholder="e.g. Makhana processing helper"
              onChange={(e) => { setRole(e.target.value); touch(); }}
            />
            <select
              aria-label="Sector"
              className="field"
              value={sector}
              onChange={(e) => { setSector(e.target.value); touch(); }}
            >
              <option value="">Choose the sector</option>
              {sectors.map((s) => <option key={s}>{s}</option>)}
            </select>
            <p className="text-xs leading-relaxed text-ink-faint">
              A role typed here counts towards its sector only.{" "}
              <button
                type="button"
                className="font-medium text-violet-700 underline-offset-2 hover:underline"
                onClick={() => { setCustom(false); setRole(""); touch(); }}
              >
                Search the official list instead
              </button>
            </p>
          </div>
        ) : (
          <div className="mt-1.5">
            <CoursePicker
              id={`${uid}-role`}
              value={course}
              onPick={(c) => { setCourse(c); touch(); }}
              onCustom={(text) => { setCustom(true); setRole(text); touch(); }}
            />
            {!course && (
              <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                Choose from the official NSQF course list so callers are offered that exact
                course. Not listed?{" "}
                <button
                  type="button"
                  className="font-medium text-violet-700 underline-offset-2 hover:underline"
                  onClick={() => { setCustom(true); touch(); }}
                >
                  Enter the role yourself
                </button>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-openings`} label="Number of openings">
          <input
            id={`${uid}-openings`}
            className="field"
            inputMode="numeric"
            placeholder="e.g. 25"
            value={openings}
            onChange={(e) => { setOpenings(digits(e.target.value)); touch(); }}
          />
        </Field>
        <Field id={`${uid}-wage`} label="Monthly wage (₹)" optional>
          <input
            id={`${uid}-wage`}
            className="field"
            inputMode="numeric"
            placeholder="e.g. 12000"
            value={wage}
            onChange={(e) => { setWage(digits(e.target.value)); touch(); }}
          />
        </Field>
      </div>

      <Field
        id={`${uid}-date`}
        label="Date of this information"
        hint={`Openings count towards suggestions for ${COUNTED_DAYS} days from this date.`}
      >
        <input
          id={`${uid}-date`}
          type="date"
          className="field"
          min={daysAgo(MAX_AGE_DAYS)}
          max={isoDay(new Date())}
          value={date}
          onChange={(e) => { setDate(e.target.value); touch(); }}
        />
      </Field>

      <Field id={`${uid}-link`} label="Source link" optional>
        <input
          id={`${uid}-link`}
          type="url"
          inputMode="url"
          className="field"
          placeholder="https://www.ncs.gov.in/…"
          value={link}
          maxLength={500}
          onChange={(e) => { setLink(e.target.value); touch(); }}
        />
      </Field>

      <Field id={`${uid}-note`} label="Note" optional>
        <input
          id={`${uid}-note`}
          className="field"
          placeholder="Employer or job fair, e.g. Rozgar Mela, 3 Oct"
          value={note}
          maxLength={300}
          onChange={(e) => { setNote(e.target.value); touch(); }}
        />
      </Field>

      {roleName && Number(openings) > 0 && !error && (
        <p className="rounded-xl border border-violet-100 bg-violet-50 px-3.5 py-2.5 text-sm text-ink-soft">
          This adds <span className="font-semibold text-ink">{plural(Number(openings), "opening", "openings")}</span> for{" "}
          <span className="font-semibold text-ink">{roleName}</span> in {district}, {state}.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {done && (
        <p role="status" className="rounded-xl border border-green-100 bg-green-50 px-3.5 py-2.5 text-sm text-green-800">
          {done}
        </p>
      )}

      <button type="submit" className="btn-primary btn-go" disabled={busy}>
        {busy ? "Adding…" : "Add openings"}
        <ArrowSquare />
      </button>
    </form>
  );
}

function CoursePicker({ id, value, onPick, onCustom }: {
  id: string;
  value: Course | null;
  onPick: (c: Course | null) => void;
  onCustom: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<Course[]>([]);
  const [searched, setSearched] = useState("");   // the search `options` answer
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState("");
  const term = text.trim().replace(/\s+/g, " ");

  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      officerApi
        .courses(term)
        .then((c) => {
          if (!live) return;
          setOptions(c);
          setSearched(term);
          setActive(0);
          setError("");
        })
        .catch((e) => live && setError(errorText(e)));
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{value.name}</div>
          <div className="text-xs text-ink-soft">
            {value.sector}{value.nsqf_level ? ` · NSQF level ${value.nsqf_level}` : ""}
          </div>
          <div className="mt-0.5 break-all font-mono text-[11px] text-ink-faint">{value.qp_code}</div>
        </div>
        <button
          type="button"
          className="shrink-0 text-sm font-medium text-violet-700 underline-offset-2 hover:underline"
          onClick={() => {
            onPick(null);
            requestAnimationFrame(() => document.getElementById(id)?.focus());
          }}
        >
          Change
        </button>
      </div>
    );
  }

  const shown = searched === term ? options : [];
  const listId = `${id}-list`;
  const showList = open && term.length >= 2;

  function pick(c: Course) {
    onPick(c);
    setText("");
    setOpen(false);
  }

  function keys(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "Enter" && showList) {
      e.preventDefault();   // pick, don't submit the form
      if (shown.length) pick(shown[Math.min(active, shown.length - 1)]);
      return;
    }
    if (!shown.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + shown.length) % shown.length);
    }
  }

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        id={id}
        className="field pl-10"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && shown.length ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Search: tailor, electrician, sewing machine…"
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={keys}
      />
      {showList && (
        <div
          className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-lift"
          onMouseDown={(e) => e.preventDefault()}   // keep focus in the search box
        >
          {shown.length ? (
            <ul id={listId} role="listbox" aria-label="Official courses">
              {shown.map((c, i) => (
                <li
                  key={c.qp_code}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={cn("cursor-pointer rounded-xl px-3 py-2", i === active && "bg-violet-50")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(c)}
                >
                  <div className={cn("text-sm", i === active ? "font-medium text-violet-700" : "text-ink")}>
                    {c.name}
                  </div>
                  <div className="text-xs text-ink-faint">
                    {c.sector}{c.nsqf_level ? ` · level ${c.nsqf_level}` : ""}
                    <span className="break-all font-mono text-[11px]"> · {c.qp_code}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-sm text-ink-soft">
              {error ? (
                <span className="text-red-700">{error}</span>
              ) : searched !== term ? (
                "Searching…"
              ) : (
                <>
                  No official course matches “{term}”.{" "}
                  <button
                    type="button"
                    className="font-medium text-violet-700 underline-offset-2 hover:underline"
                    onClick={() => onCustom(term)}
                  >
                    Enter it as a new role
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OpeningsList({ district, jobs, error, fresh, onChanged, onRetry }: {
  district: string;
  jobs: Job[] | null;
  error: string;
  fresh: string | null;
  onChanged: (id: string | null) => Promise<void>;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "officer">("all");
  const [text, setText] = useState("");

  if (!district) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Openings</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Choose a state and district to see the job openings recorded there.
        </p>
      </section>
    );
  }
  if (error || !jobs) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Openings in {district}</h2>
        {error ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-red-700">{error}</p>
            <button type="button" className="btn-ghost" onClick={onRetry}>Try again</button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-faint">Loading…</p>
        )}
      </section>
    );
  }

  const counted = jobs.filter((j) => j.counted);
  const total = counted.reduce((sum, j) => sum + j.vacancies_90d, 0);
  const byOfficers = jobs.filter((j) => j.origin === "officer").length;
  const needle = text.trim().toLowerCase();
  const shown = jobs.filter(
    (j) =>
      (filter === "all" || j.origin === "officer") &&
      (!needle ||
        [j.role_title, j.sector, j.qp_code, j.entered_by, j.source_note]
          .join(" ").toLowerCase().includes(needle)),
  );

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Openings in {district}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {plural(total, "opening", "openings")} from the last {COUNTED_DAYS} days count towards
          suggestions. {byOfficers ? `${plural(byOfficers, "entry", "entries")} added by officers.` : "None added by officers yet."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-line bg-white p-1 text-sm" role="group" aria-label="Show">
          {(["all", "officer"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition",
                filter === f
                  ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
                  : "text-ink-soft hover:text-ink",
              )}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? <ListIcon /> : <PersonIcon />}
              {f === "all" ? `All (${jobs.length})` : `Added by officers (${byOfficers})`}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:ml-auto sm:w-60">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            aria-label="Filter openings"
            className="field rounded-full py-2 pl-10"
            placeholder="Filter by role or sector"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>

      {shown.length ? (
        <ul className="divide-y divide-line">
          {shown.map((j) => (
            <OpeningRow key={j.id} job={j} fresh={fresh === j.id} onChanged={onChanged} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">
          {jobs.length ? "No openings match." : `No openings recorded for ${district} yet.`}
        </p>
      )}
      {jobs.length >= 300 && <p className="text-xs text-ink-faint">Showing the latest 300 entries.</p>}
    </section>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M5.5 4h7M5.5 8h7M5.5 12h7M3 4h.01M3 8h.01M3 12h.01" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 13.5c.6-2.3 2.4-3.5 4.5-3.5s3.9 1.2 4.5 3.5" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Origin({ job }: { job: Job }) {
  if (job.origin === "officer") {
    return (
      <span className="chip tag-pass" title={`Added ${new Date(job.created_at).toLocaleString("en-IN")}`}>
        added by {job.entered_by}
      </span>
    );
  }
  if (job.origin === "illustrative") {
    return <span className="chip" title="Generated for the demo, not real openings">sample data</span>;
  }
  return <span className="chip" title="Loaded with the system">pre-loaded</span>;
}

function OpeningRow({ job, fresh, onChanged }: {
  job: Job;
  fresh: boolean;
  onChanged: (id: string | null) => Promise<void>;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canChange = job.origin === "officer";

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await officerApi.remove(job.id);
      await onChanged(null);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
      if (e instanceof OfficerApiError && e.status === 404) await onChanged(null);
    }
  }

  return (
    <li className={cn("py-3.5 transition-colors", fresh && "-mx-3 rounded-xl bg-violet-50 px-3")}>
      {mode === "edit" ? (
        <EditOpening
          job={job}
          onDone={async (saved) => {
            if (saved) await onChanged(job.id);
            setMode("view");
          }}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-semibold text-ink">{job.role_title}</div>
              <div className="mt-0.5 text-sm text-ink-soft">
                {job.sector}
                {job.qp_code && (
                  <span className="break-all font-mono text-[11px] text-ink-faint"> · {job.qp_code}</span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xl font-semibold leading-tight tracking-tight text-violet-700 tabular-nums">
                {inr.format(job.vacancies_90d)}
              </div>
              <div className="text-xs text-ink-faint">{job.vacancies_90d === 1 ? "opening" : "openings"}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-soft">
            <Origin job={job} />
            <span>{fmtDate(job.evidence_date)}</span>
            {!job.counted && <span className="chip tag-unk">over {COUNTED_DAYS} days old: not counted</span>}
            {job.median_wage_inr != null && <span>₹{inr.format(job.median_wage_inr)} a month</span>}
            {isLink(job.source_url) && (
              <a
                className="font-medium text-violet-700 underline-offset-2 hover:underline"
                href={job.source_url}
                target="_blank"
                rel="noreferrer"
              >
                source
              </a>
            )}
            {job.source_note && <span className="italic">{job.source_note}</span>}
          </div>
          {canChange && mode === "view" && (
            <div className="mt-2.5 flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setMode("edit")}>Edit</button>
              <button type="button" className="btn-ghost" onClick={() => setMode("delete")}>Delete</button>
            </div>
          )}
          {mode === "delete" && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-ink">
              <span>Delete these {plural(job.vacancies_90d, "opening", "openings")}?</span>
              <button type="button" disabled={busy} className="btn-danger" onClick={remove}>
                {busy ? "Deleting…" : "Yes, delete"}
              </button>
              <button type="button" disabled={busy} className="btn-ghost" onClick={() => setMode("view")}>
                Keep
              </button>
            </div>
          )}
          {error && <p role="alert" className="mt-1.5 text-sm text-red-700">{error}</p>}
        </>
      )}
    </li>
  );
}

function EditOpening({ job, onDone }: {
  job: Job;
  onDone: (saved: boolean) => Promise<void>;
}) {
  const uid = useId();
  const [role, setRole] = useState(job.role_title);
  const [openings, setOpenings] = useState(String(job.vacancies_90d));
  const [wage, setWage] = useState(job.median_wage_inr != null ? String(job.median_wage_inr) : "");
  const [date, setDate] = useState(job.evidence_date);
  const [link, setLink] = useState(isLink(job.source_url) ? job.source_url : "");
  const [note, setNote] = useState(job.source_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dateChanged = date !== job.evidence_date;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const problem =
      (!job.qp_code && role.trim().length < 3 ? "Enter the job role." : "") ||
      checkEntry({ openings, wage, date, link }, dateChanged);
    if (problem) return setError(problem);
    const change: JobChange = {
      vacancies: Number(openings),
      median_wage_inr: wage ? Number(wage) : null,
      source_url: link.trim(),      // empty = no link
      source_note: note.trim(),     // empty = no note
    };
    if (dateChanged) change.evidence_date = date;
    if (!job.qp_code) change.role_title = role.trim();
    setBusy(true);
    setError("");
    try {
      await officerApi.update(job.id, change);
      await onDone(true);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-4" noValidate>
      <div className="text-sm font-semibold text-ink">Edit: {job.role_title}</div>
      {!job.qp_code && (
        <Field id={`${uid}-role`} label="Job role">
          <input
            id={`${uid}-role`}
            className="field"
            value={role}
            maxLength={120}
            onChange={(e) => setRole(e.target.value)}
          />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id={`${uid}-openings`} label="Openings">
          <input
            id={`${uid}-openings`}
            className="field"
            inputMode="numeric"
            value={openings}
            onChange={(e) => setOpenings(digits(e.target.value))}
          />
        </Field>
        <Field id={`${uid}-wage`} label="Monthly wage (₹)" optional>
          <input
            id={`${uid}-wage`}
            className="field"
            inputMode="numeric"
            value={wage}
            onChange={(e) => setWage(digits(e.target.value))}
          />
        </Field>
        <Field id={`${uid}-date`} label="Date">
          <input
            id={`${uid}-date`}
            type="date"
            className="field"
            min={daysAgo(MAX_AGE_DAYS)}
            max={isoDay(new Date())}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${uid}-link`} label="Source link" optional>
          <input
            id={`${uid}-link`}
            type="url"
            className="field"
            value={link}
            maxLength={500}
            onChange={(e) => setLink(e.target.value)}
          />
        </Field>
        <Field id={`${uid}-note`} label="Note" optional>
          <input
            id={`${uid}-note`}
            className="field"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary px-4 py-2" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  );
}

function Field({ id, label, optional, hint, children }: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="font-normal text-ink-faint"> (optional)</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
