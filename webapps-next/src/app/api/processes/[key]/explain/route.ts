import { deepseekConfigured, streamDeepSeek } from "@/lib/ai/deepseek";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type ProcessDef = {
  id: string;
  key: string;
  name: string | null;
  version: number;
  resource: string;
};
type ActivityStat = {
  id: string;
  instances: number;
  incidents?: Array<{ incidentType: string; incidentCount: number }>;
};
type Instance = { id: string; businessKey: string | null; suspended: boolean };

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    return await engineGet<T>(path);
  } catch {
    return fallback;
  }
}

const attr = (tag: string, name: string): string => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? "";

const FLOW_NODE =
  /(userTask|serviceTask|scriptTask|sendTask|receiveTask|manualTask|businessRuleTask|callActivity|subProcess|task|startEvent|endEvent|intermediateCatchEvent|intermediateThrowEvent|boundaryEvent|exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway|complexGateway)/;

/**
 * Compact, token-cheap summary of a BPMN file (nodes, flows, lanes, pools)
 * instead of shipping ~40KB of raw XML to the model. Returns the summary text
 * plus an id→name map so runtime stats can be labelled with real names.
 */
function summarizeBpmn(xml: string): { text: string; names: Record<string, string> } {
  const names: Record<string, string> = {};
  const nodes: string[] = [];
  const lanes: string[] = [];
  const flows: string[] = [];

  for (const m of xml.matchAll(/<(?:\w+:)?(\w+)\b([^>]*?)\/?>/g)) {
    const local = m[1];
    const tag = m[2];
    const id = attr(tag, "id");
    const name = attr(tag, "name");
    if (id && name) names[id] = name;

    if (FLOW_NODE.test(local)) {
      nodes.push(`${name || id} [${local}]`);
    } else if (local === "lane" || local === "participant") {
      if (name) lanes.push(name);
    } else if (local === "sequenceFlow") {
      const src = names[attr(tag, "sourceRef")] ?? attr(tag, "sourceRef");
      const tgt = names[attr(tag, "targetRef")] ?? attr(tag, "targetRef");
      flows.push(`${src} -${name ? ` ${name} ` : ""}-> ${tgt}`);
    }
  }

  const text = [
    lanes.length ? `Lanes/Pools: ${lanes.join(", ")}` : "",
    nodes.length ? `Activities & events:\n- ${nodes.join("\n- ")}` : "",
    flows.length ? `Flow:\n- ${flows.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { text, names };
}

const SYSTEM_PROMPT = `You are a BPMN process analyst embedded in a Camunda Cockpit.
You explain a deployed process and its CURRENT runtime situation to an operations user who may not read BPMN.
You are given the process BPMN XML plus live engine data: how many process instances are currently waiting at each activity, any incidents, and the list of running instances.

Write a tight interpretation in markdown with these sections (use ## headings):
## What this process does
2-4 plain-language sentences describing the end-to-end flow across the lanes/pools.
## Where things stand now
Where the running instances are sitting right now (name the activities), what that implies, and call out the busiest / bottleneck activity. If there are zero running instances, say so plainly.
## Risks & incidents
Any incidents, stuck points, or things worth a second look. If none, say "No incidents." in one line.
## Suggested next step
One concrete, actionable suggestion for the operator.

Be concise and specific — reference real activity names from the diagram. No preamble, no repetition of these instructions.`;

export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await getSession();
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  if (!deepseekConfigured()) {
    return new Response(JSON.stringify({ error: "AI is not configured (set DEEPSEEK_API_KEY)." }), { status: 503 });
  }

  const { key } = await params;

  const defs = await get<ProcessDef[]>(`/process-definition?key=${encodeURIComponent(key)}&latestVersion=true`, []);
  const def = defs[0];
  if (!def) return new Response(JSON.stringify({ error: "Process definition not found" }), { status: 404 });

  const [stats, instances, xmlRes] = await Promise.all([
    get<ActivityStat[]>(`/process-definition/${encodeURIComponent(def.id)}/statistics?incidents=true`, []),
    get<Instance[]>(`/process-instance?processDefinitionId=${encodeURIComponent(def.id)}&maxResults=50`, []),
    get<{ bpmn20Xml: string }>(`/process-definition/${encodeURIComponent(def.id)}/xml`, { bpmn20Xml: "" }),
  ]);

  const { text: diagram, names } = summarizeBpmn(xmlRes.bpmn20Xml ?? "");

  const activityLines = stats.length
    ? stats
        .map((s) => {
          const inc = (s.incidents ?? []).reduce((a, b) => a + b.incidentCount, 0);
          const label = names[s.id] ? `${names[s.id]} (${s.id})` : s.id;
          return `- ${label}: ${s.instances} waiting${inc > 0 ? `, ${inc} incident(s)` : ""}`;
        })
        .join("\n")
    : "(no activities currently hold tokens)";

  const instanceLines = instances.length
    ? instances
        .slice(0, 20)
        .map((i) => `- ${i.id}${i.businessKey ? ` (key: ${i.businessKey})` : ""}${i.suspended ? " [suspended]" : ""}`)
        .join("\n")
    : "(none)";

  const userPrompt = `Process: ${def.name ?? def.key} (key: ${def.key}, version ${def.version})

DIAGRAM STRUCTURE
${diagram}

RUNTIME
Currently running instances: ${instances.length}
Activity instance counts (where tokens are waiting):
${activityLines}

Running instances:
${instanceLines}`;

  try {
    const stream = await streamDeepSeek([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ]);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "AI request failed" }), {
      status: 502,
    });
  }
}
