import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { engineFetch } from "@/lib/camunda/engine";

// Camunda creates a comment scoped to a task. The author is taken from the
// engine's REST authentication context (Basic) or — when REST auth is off, as
// in the Run dev distro — defaults to the user-id explicitly set on the body
// or null. We pass `userId` in the body so the comment is attributed correctly.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { message?: string };
  try {
    body = (await req.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  try {
    const res = await engineFetch(`/task/${encodeURIComponent(id)}/comment/create`, {
      method: "POST",
      body: JSON.stringify({ message: body.message.trim(), userId: session.username }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ error: errBody || `Engine returned ${res.status}` }, { status: res.status });
    }
    const comment = (await res.json()) as unknown;
    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Engine unreachable" },
      { status: 502 },
    );
  }
}
