import { t } from "../i18n";
/**
 * The Cloudflare Worker hosts the map proxy, forecast scraper, and the
 * accounts/observations API, all under one base URL.
 */
export const WORKER_BASE = ((import.meta.env.VITE_MAP_PROXY_URL as string | undefined) ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ApiOptions {
  method?: string;
  token?: string | null;
  json?: unknown;
  form?: FormData;
}

export async function api<T>(path: string, { method = "GET", token, json, form }: ApiOptions = {}): Promise<T> {
  if (!WORKER_BASE) throw new ApiError(0, t("Servern är inte konfigurerad."));
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (form) body = form;
  else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(`${WORKER_BASE}${path}`, { method, headers, body });
  } catch {
    throw new ApiError(0, t("Ingen kontakt med servern. Kontrollera din uppkoppling."));
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? t("Något gick fel ({status}).", { status: res.status }));
  return data as T;
}

export function imageUrl(path: string): string {
  return `${WORKER_BASE}${path}`;
}
