import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

import { TaskDetailPane } from "../_components/task-detail-pane";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const username = session?.username ?? "guest";

  return (
    <div className="flex h-[calc(100svh-5rem)] flex-col gap-3 md:h-[calc(100svh-6rem)]">
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link href="/tasklist">
          <ArrowLeft className="mr-2 size-4" /> Back to inbox
        </Link>
      </Button>
      <div className="bg-card flex-1 overflow-hidden rounded-lg border shadow-sm">
        <TaskDetailPane taskId={id} username={username} />
      </div>
    </div>
  );
}
