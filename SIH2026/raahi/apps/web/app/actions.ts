"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { VOICE_API } from "@/lib/server-api";
import { SESSION_COOKIE } from "@/lib/session";

export type SignInResult = { error: string } | undefined;

/** Check the officer's name and access code with the backend, keep the
 *  session it returns in an httpOnly cookie, and go to the page they wanted. */
export async function signIn(form: FormData): Promise<SignInResult> {
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim();
  const code = String(form.get("code") ?? "").trim();
  if (!name) return { error: "Please enter your name." };
  if (!code) return { error: "Please enter the officer access code." };

  let r: Response;
  try {
    r = await fetch(`${VOICE_API}/officer/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code }),
      cache: "no-store",
    });
  } catch {
    return { error: "Can't reach the RAAHI server. Check that the backend is running." };
  }
  if (!r.ok) {
    const detail = await r.json().then((b) => b?.detail).catch(() => null);
    return { error: typeof detail === "string" ? detail : "Sign-in didn't work. Please try again." };
  }
  const { token, expires_in } = await r.json();
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: expires_in,
    secure: (headers().get("origin") ?? "").startsWith("https://"),
  });

  // Only ever a page on this site.
  const next = String(form.get("next") ?? "");
  redirect(/^\/(?!\/)/.test(next) && !next.startsWith("/signin") ? next : "/");
}

export async function signOut() {
  cookies().delete(SESSION_COOKIE);
  redirect("/signin");
}
