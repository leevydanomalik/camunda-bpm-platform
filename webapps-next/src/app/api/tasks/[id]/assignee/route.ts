import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { engineFetch } from "@/lib/camunda/engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { userId?: string | null };
  try {
    body = (await req.json()) as { userId?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const res = await engineFetch(`/task/${encodeURIComponent(id)}/assignee`, {
      method: "POST",
      body: JSON.stringify({ userId: body.userId ?? null }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ error: errBody || `Engine returned ${res.status}` }, { status: res.status });
    }
    return NextResponse.json({ ok: true, assignee: body.userId ?? null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Engine unreachable" },
      { status: 502 },
    );
  }
}
