import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Every dashboard page needs a signed-in officer; without a session, go to
// the sign-in page and come back afterwards. (An expired or forged session is
// caught by the backend, which then sends the officer here too.)
export function middleware(req: NextRequest) {
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = req.nextUrl.clone();
  const back = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/signin";
  url.search = back === "/" ? "" : `?next=${encodeURIComponent(back)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!signin|voice-api|_next|favicon.ico).*)"],
};
