// Minimal server-side engine-rest client. The browser never imports this —
// it goes through the Next.js BE which proxies /api/engine/* to the engine
// (see next.config.mjs rewrite).

const ENGINE_URL = process.env.CAMUNDA_ENGINE_REST_URL ?? "http://localhost:8080/engine-rest";

export type EngineFetchOptions = RequestInit & {
  auth?: { username: string; password: string };
};

export async function engineFetch(path: string, init: EngineFetchOptions = {}): Promise<Response> {
  const url = `${ENGINE_URL}${path}`;
  const headers = new Headers(init.headers);

  if (init.auth) {
    const basic = Buffer.from(`${init.auth.username}:${init.auth.password}`).toString("base64");
    headers.set("Authorization", `Basic ${basic}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}

export type VerifyResponse = {
  authenticated: boolean;
  authenticatedUser?: string | null;
};

export async function engineGet<T>(path: string, init: EngineFetchOptions = {}): Promise<T> {
  const res = await engineFetch(path, { ...init, method: "GET" });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function identityVerify(username: string, password: string): Promise<VerifyResponse> {
  const res = await engineFetch("/identity/verify", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`identity/verify failed: ${res.status}`);
  }
  return (await res.json()) as VerifyResponse;
}
