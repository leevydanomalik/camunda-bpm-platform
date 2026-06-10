import { deepseekChat, deepseekConfigured, deepseekModel } from "@/lib/ai/deepseek";
import { getSession } from "@/lib/auth/session";

// Generic "Key Insights" endpoint used by the ExecutiveReport AI hook. Takes a
// metrics snapshot + focus/context, asks DeepSeek for a board-ready summary,
// insights, and recommendations as strict JSON. On any failure the client hook
// falls back to the rule-based bundle it already holds.

type Body = {
  report?: string;
  focus?: string;
  context?: string;
  metrics?: Record<string, unknown>;
};

const SYSTEM = `You are a senior operations analyst writing a board-ready report.
Given a JSON metrics snapshot, respond with STRICT JSON only (no markdown, no prose outside JSON) of the exact shape:
{
  "summary": "2-3 sentence executive summary referencing the real numbers",
  "insights": [{ "tone": "positive|warning|critical|neutral", "title": "short", "detail": "one sentence" }],
  "recommendations": [{ "priority": "High|Medium|Low", "text": "concrete action" }]
}
Provide 3-5 insights and 2-4 recommendations. Be specific and reference the actual metric values. No other keys.`;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

  if (!deepseekConfigured()) {
    return Response.json({ success: true, source: "fallback" });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const userPrompt = [
    body.report ? `Report: ${body.report}` : "",
    body.context ? `Context: ${body.context}` : "",
    body.focus ? `Focus on: ${body.focus}` : "",
    `Metrics snapshot:\n${JSON.stringify(body.metrics ?? {}, null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const text = await deepseekChat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      { json: true, maxTokens: 1400 },
    );
    const parsed = JSON.parse(text) as {
      summary?: string;
      insights?: unknown[];
      recommendations?: unknown[];
    };
    if (!Array.isArray(parsed.insights) || parsed.insights.length === 0) {
      return Response.json({ success: true, source: "fallback", model: deepseekModel() });
    }
    return Response.json({
      success: true,
      source: "deepseek",
      model: deepseekModel(),
      summary: parsed.summary,
      insights: parsed.insights,
      recommendations: parsed.recommendations ?? [],
    });
  } catch {
    return Response.json({ success: true, source: "fallback", model: deepseekModel() });
  }
}
