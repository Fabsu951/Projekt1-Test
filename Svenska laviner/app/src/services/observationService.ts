import type { Observation } from "../types/observation";
import { api } from "./api";
import { cached, USER_SCOPE } from "./cache";

export interface ObservationFilter {
  region?: string;
  /** One of the observation types; omitted means all. */
  type?: string;
  /** Only observations from the last this many days; omitted means all. */
  days?: number;
  limit?: number;
}

export async function fetchObservations(opts: ObservationFilter = {}): Promise<Observation[]> {
  const params = new URLSearchParams();
  if (opts.region) params.set("region", opts.region);
  if (opts.type) params.set("type", opts.type);
  if (opts.days) params.set("days", String(opts.days));
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return cached(`observations:${qs}`, async () => (await api<{ observations: Observation[] }>(`/observations${qs ? `?${qs}` : ""}`)).observations);
}

export async function fetchMyObservations(token: string): Promise<Observation[]> {
  return cached(`${USER_SCOPE}observations`, async () =>
    (await api<{ observations: Observation[] }>("/observations?mine=1&limit=200", { token })).observations
  );
}

export async function fetchReported(token: string): Promise<Observation[]> {
  return (await api<{ observations: Observation[] }>("/admin/reported", { token })).observations;
}

export interface NewObservation {
  type: string;
  lat: number;
  lon: number;
  regionId: string | null;
  observedAt: Date;
  description: string;
  image: Blob | null;
  dangerSigns: string[];
  /** Whole centimetres, or null when not given. */
  snowDepthCm: number | null;
  /** The app's own id, so sending again after lost coverage doesn't store it twice. */
  clientId?: string;
}

export async function createObservation(token: string, obs: NewObservation): Promise<Observation> {
  const form = new FormData();
  form.set("type", obs.type);
  form.set("lat", String(obs.lat));
  form.set("lon", String(obs.lon));
  if (obs.regionId) form.set("regionId", obs.regionId);
  form.set("observedAt", obs.observedAt.toISOString());
  form.set("description", obs.description);
  if (obs.image) form.set("image", obs.image, "bild.jpg");
  for (const sign of obs.dangerSigns) form.append("dangerSigns", sign);
  if (obs.snowDepthCm !== null) form.set("snowDepthCm", String(obs.snowDepthCm));
  if (obs.clientId) form.set("clientId", obs.clientId);
  return (await api<{ observation: Observation }>("/observations", { method: "POST", token, form })).observation;
}

export async function deleteObservation(token: string, id: number): Promise<void> {
  await api(`/observations/${id}`, { method: "DELETE", token });
}

export async function reportObservation(token: string, id: number, reason: string): Promise<void> {
  await api(`/observations/${id}/report`, { method: "POST", token, json: { reason } });
}

export async function restoreObservation(token: string, id: number): Promise<void> {
  await api(`/observations/${id}/restore`, { method: "POST", token });
}
