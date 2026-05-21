import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, decodeSession } from "@/lib/auth/session";

// Use Node runtime so node:crypto is available for HMAC verification.
export const runtime = "nodejs";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
