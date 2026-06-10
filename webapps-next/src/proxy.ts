import { type NextRequest, NextResponse } from "next/server";

import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";

// Next 16 always runs proxy.ts on Node.js — no runtime export needed.

const PUBLIC_PATH_PREFIXES = ["/login", "/landing", "/api/auth/login", "/api/auth/logout"];

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
  // Anonymous visitors hitting the front door get the landing page; deep
  // links still go to login with the destination preserved.
  if (pathname === "/") {
    url.pathname = "/landing";
    url.search = "";
    return NextResponse.redirect(url);
  }
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
