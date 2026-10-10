import type { Metadata } from "next";
import { SignInForm } from "@/components/signin-form";
import { RaahiLogo } from "@/components/ui";
import { PLATFORM } from "@/lib/brand";

export const metadata: Metadata = { title: `Sign in · RAAHI ${PLATFORM}` };

export default function SignInPage({ searchParams }: {
  searchParams: { next?: string; reason?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <RaahiLogo size="lg" />
        <span className="eyebrow mt-5">{PLATFORM}</span>
      </div>
      <SignInForm next={searchParams.next ?? "/"} expired={searchParams.reason === "expired"} />
      <p className="mt-6 text-center text-xs text-ink-soft">
        For district officers. Ask your administrator for the access code.
      </p>
    </main>
  );
}
