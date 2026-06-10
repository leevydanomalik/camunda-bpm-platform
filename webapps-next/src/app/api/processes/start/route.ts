import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { engineFetch } from "@/lib/camunda/engine";

type EngineVariable = { value: unknown; type?: string };
type StartBody = {
  key?: string;
  businessKey?: string;
  variables?: Record<string, EngineVariable>;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: StartBody = {};
  try {
    const parsed = (await req.json().catch(() => ({}))) as StartBody;
    if (parsed && typeof parsed === "object") body = parsed;
  } catch {
    // empty body is fine — engine accepts no variables
  }

  const key = String(body.key ?? "").trim();
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const enginePayload: { variables: Record<string, EngineVariable>; businessKey?: string } = {
    variables: body.variables ?? {},
  };
  if (body.businessKey?.trim()) enginePayload.businessKey = body.businessKey.trim();

  try {
    const res = await engineFetch(`/process-definition/key/${encodeURIComponent(key)}/start`, {
      method: "POST",
      body: JSON.stringify(enginePayload),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || `Engine returned ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Engine unreachable" }, { status: 502 });
  }
}
