"use client";
import { useId, useState, useTransition } from "react";
import { signIn } from "@/app/actions";
import { ArrowSquare } from "@/components/ui";

export function SignInForm({ next, expired }: { next: string; expired: boolean }) {
  const uid = useId();
  const [error, setError] = useState(expired ? "Your session has ended. Please sign in again." : "");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    startTransition(async () => {
      const result = await signIn(form);   // on success it moves to the next page
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6 sm:p-8" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          See calls, skills and job openings for every district, and keep the job
          openings up to date.
        </p>
      </div>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor={`${uid}-name`} className="label">Your name</label>
        <input id={`${uid}-name`} name="name" className="field mt-1.5" autoComplete="name" maxLength={80} />
      </div>
      <div>
        <label htmlFor={`${uid}-code`} className="label">Officer access code</label>
        <input
          id={`${uid}-code`}
          name="code"
          type="password"
          className="field mt-1.5"
          autoComplete="current-password"
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn-primary btn-go w-full justify-between" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
        <ArrowSquare />
      </button>
    </form>
  );
}
