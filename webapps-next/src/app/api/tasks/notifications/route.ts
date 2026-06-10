import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

// Tasks assigned to the signed-in user, newest first — feeds the header bell.
// The client polls this and diffs against its last-seen timestamp.

type TaskDto = {
  id: string;
  name: string | null;
  created: string;
  processDefinitionId: string | null;
  priority: number;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tasks = await engineGet<TaskDto[]>(
      `/task?assignee=${encodeURIComponent(session.username)}&sortBy=created&sortOrder=desc&maxResults=15`,
    );
    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name ?? t.id,
        created: t.created,
        processKey: t.processDefinitionId?.split(":")[0] ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Engine unreachable" }, { status: 502 });
  }
}
