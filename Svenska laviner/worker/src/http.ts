export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(data: unknown, origin: string, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

/** Error responses carry a Swedish message the app can show as-is. */
export function error(message: string, origin: string, status: number, extra?: Record<string, unknown>): Response {
  return json({ ...extra, error: message }, origin, status);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** More for the app to act on, sent next to the message. */
    public extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Ogiltig förfrågan.");
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
