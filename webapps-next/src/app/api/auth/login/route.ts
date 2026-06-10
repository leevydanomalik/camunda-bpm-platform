import { NextResponse } from "next/server";

import { encodeSession, sessionCookieOptions } from "@/lib/auth/session";
import { identityVerify } from "@/lib/camunda/engine";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = body.username?.trim();
  const password = body.password;
  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  let result;
  try {
    result = await identityVerify(username, password);
  } catch {
    return NextResponse.json({ error: "Engine unreachable" }, { status: 502 });
  }

  if (!result.authenticated) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const opts = sessionCookieOptions();
  const token = encodeSession(result.authenticatedUser ?? username);
  const res = NextResponse.json({ ok: true, username: result.authenticatedUser ?? username });
  res.cookies.set(opts.name, token, opts);
  return res;
}
