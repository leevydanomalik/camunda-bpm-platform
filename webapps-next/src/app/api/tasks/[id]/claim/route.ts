import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { engineFetch } from "@/lib/camunda/engine";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const res = await engineFetch(`/task/${encodeURIComponent(id)}/claim`, {
      method: "POST",
      body: JSON.stringify({ userId: session.username }),
    });
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: body || `Engine returned ${res.status}` }, { status: res.status });
    }
    return NextResponse.json({ ok: true, assignee: session.username });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Engine unreachable" },
      { status: 502 },
    );
  }
}
