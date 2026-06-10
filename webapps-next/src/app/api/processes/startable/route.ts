import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type ProcessDefinitionDto = {
  id: string;
  key: string;
  name: string | null;
  version: number;
  versionTag: string | null;
  description: string | null;
  startableInTasklist: boolean;
  suspended: boolean;
  tenantId: string | null;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const defs = await engineGet<ProcessDefinitionDto[]>(
      "/process-definition?latestVersion=true&startableInTasklist=true&active=true&sortBy=name&sortOrder=asc",
    );
    return NextResponse.json(defs);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Engine unreachable" }, { status: 502 });
  }
}
