import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { engineFetch } from "@/lib/camunda/engine";

/**
 * Update a task's due and/or follow-up date.
 *
 * The engine has no partial-update endpoint — `PUT /task/{id}` replaces the
 * whole task — so we read the current task, merge the requested date fields,
 * and write it back. Pass `null` for a field to clear it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { due?: string | null; followUp?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const current = await engineFetch(`/task/${encodeURIComponent(id)}`, { method: "GET" });
    if (!current.ok) {
      const errBody = await current.text();
      return NextResponse.json({ error: errBody || `Engine returned ${current.status}` }, { status: current.status });
    }
    const task = (await current.json()) as Record<string, unknown>;

    if ("due" in body) task.due = body.due ?? null;
    if ("followUp" in body) task.followUp = body.followUp ?? null;

    const res = await engineFetch(`/task/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(task),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ error: errBody || `Engine returned ${res.status}` }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Engine unreachable" }, { status: 502 });
  }
}
