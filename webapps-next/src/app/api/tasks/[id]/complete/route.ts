import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { engineFetch } from "@/lib/camunda/engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { variables?: Record<string, { value: unknown; type?: string }> } = {};
  try {
    const parsed = (await req.json().catch(() => ({}))) as typeof body;
    if (parsed && typeof parsed === "object") body = parsed;
  } catch {
    // Empty body is fine — `/task/{id}/complete` accepts no variables.
  }

  try {
    const res = await engineFetch(`/task/${encodeURIComponent(id)}/complete`, {
      method: "POST",
      body: JSON.stringify({ variables: body.variables ?? {} }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ error: errBody || `Engine returned ${res.status}` }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Engine unreachable" },
      { status: 502 },
    );
  }
}
