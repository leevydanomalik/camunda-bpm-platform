import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

import { LandingContent, type LiveStats } from "./_components/landing-content";

// Public marketing/landing page. Everything "live" degrades gracefully when
// the engine is unreachable (nulls render as em dashes).

async function safeCount(path: string): Promise<number | null> {
  try {
    return (await engineGet<{ count: number }>(path)).count;
  } catch {
    return null;
  }
}

async function safeVersion(): Promise<string | null> {
  try {
    return (await engineGet<{ version: string }>("/version")).version;
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const session = await getSession();

  const [version, definitions, instances, tasks, decisions, deployments, incidents] = await Promise.all([
    safeVersion(),
    safeCount("/process-definition/count?latestVersion=true"),
    safeCount("/process-instance/count"),
    safeCount("/task/count"),
    safeCount("/decision-definition/count?latestVersion=true"),
    safeCount("/deployment/count"),
    safeCount("/incident/count"),
  ]);

  const live: LiveStats = { definitions, instances, tasks, decisions, deployments, incidents };

  return (
    <LandingContent
      authed={Boolean(session)}
      username={session?.username ?? null}
      engineVersion={version}
      live={live}
    />
  );
}
