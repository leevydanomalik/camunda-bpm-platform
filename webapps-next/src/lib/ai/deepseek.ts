// Minimal DeepSeek client (OpenAI-compatible chat completions). Server-only —
// reads DEEPSEEK_* from the environment. Used by the process "Ask AI" route.
//
//   POST {baseUrl}/chat/completions  (Authorization: Bearer <key>)
//   Models: deepseek-v4-flash (default), deepseek-chat, deepseek-reasoner.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function deepseekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.length >= 8);
}

function endpoint(): { url: string; key: string; model: string } {
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  // Accept base with or without a trailing /v1.
  const url = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  return {
    url,
    key: process.env.DEEPSEEK_API_KEY ?? "",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  };
}

/**
 * Stream a DeepSeek chat completion as NDJSON — one `{t,c}` object per line:
 *   {"t":"reasoning","c":"…"}  the model's chain-of-thought (v4-flash reasons)
 *   {"t":"answer","c":"…"}     the user-facing answer
 * Splitting the two lets the UI show a live "thinking" state instead of a
 * frozen spinner while the reasoning model works.
 */
export async function streamDeepSeek(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<ReadableStream<Uint8Array>> {
  const { url, key, model } = endpoint();

  const upstream = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1200,
    }),
    signal: opts.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`DeepSeek HTTP ${upstream.status}: ${detail || upstream.statusText}`);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by blank lines; each carries one `data:` line.
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        const line = evt.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
          };
          const delta = json.choices?.[0]?.delta;
          if (delta?.reasoning_content) {
            controller.enqueue(encoder.encode(`${JSON.stringify({ t: "reasoning", c: delta.reasoning_content })}\n`));
          }
          if (delta?.content) {
            controller.enqueue(encoder.encode(`${JSON.stringify({ t: "answer", c: delta.content })}\n`));
          }
        } catch {
          // Ignore keep-alive / partial frames.
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}
