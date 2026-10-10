// Server-side access to the voice backend as the signed-in officer.
// Server components and actions only (reads the session cookie).
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session";

export const VOICE_API = process.env.VOICE_API_URL || "http://localhost:8000";

async function get(path: string): Promise<Response> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const r = await fetch(`${VOICE_API}${path}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (r.status === 401) redirect("/signin?reason=expired");
  return r;
}

/** GET a backend path; signs the officer out when their session has ended. */
export async function api<T>(path: string): Promise<T> {
  const r = await get(path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

/** Like api(), but null when the backend says 404. */
export async function apiOrNull<T>(path: string): Promise<T | null> {
  const r = await get(path);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

/** The signed-in officer's name, read from the session for display only
 *  (the backend checks the session itself on every request). */
export function officerName(): string | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
    return typeof claims.name === "string" ? claims.name : null;
  } catch {
    return null;
  }
}
