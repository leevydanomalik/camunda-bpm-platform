import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

// HMAC-signed cookie session. Stateless — no server store. Same shape works
// in both Node route handlers and Node-runtime middleware (we declare
// `runtime = "nodejs"` in middleware.ts so node:crypto is available).

export const SESSION_COOKIE = process.env.AUTH_SESSION_COOKIE ?? "camunda-next.session";
const SECRET = process.env.AUTH_SECRET ?? "dev-only-secret-change-me-via-env";
const TTL_SECONDS = 60 * 60 * 8; // 8 hours

export type Session = {
  username: string;
  iat: number;
  exp: number;
};

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function encodeSession(username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const session: Session = { username, iat: now, exp: now + TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  };
}
