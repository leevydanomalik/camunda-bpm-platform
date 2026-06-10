import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

import { MatrixRain } from "./_components/matrix-rain";
import { WelcomeWheel } from "./_components/welcome-wheel";

async function safeCount(path: string): Promise<number | null> {
  try {
    return (await engineGet<{ count: number }>(path)).count;
  } catch {
    return null;
  }
}

export default async function WelcomePage() {
  const session = await getSession();
  // Layout already enforces session; this is defensive for type narrowing.
  const username = session?.username ?? "guest";

  const [yourTasks, allTasks] = await Promise.all([
    safeCount(`/task/count?assignee=${encodeURIComponent(username)}`),
    safeCount("/task/count"),
  ]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Matrix rain backdrop — faded at the center so the dial stays readable. */}
      <MatrixRain className="absolute inset-0 h-full w-full opacity-35 [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_75%)]" />

      <div className="relative z-10 space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">DEEPFLOW</h1>
        <p className="text-muted-foreground text-sm">Pick a destination — every slice is a door.</p>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center py-8">
        <WelcomeWheel username={username} yourTasks={yourTasks} allTasks={allTasks} />
      </div>
    </div>
  );
}
