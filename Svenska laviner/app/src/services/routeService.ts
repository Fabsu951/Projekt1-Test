import { api } from "./api";
import { shareableUrl } from "./native";
import type { PlannedRoute } from "../types/route";
import type { LatLon } from "../utils/routePlan";

export interface RouteInput {
  title: string;
  waypoints: LatLon[];
  ascentM: number | null;
  descentM: number | null;
  shared?: boolean;
}

export async function fetchMyRoutes(token: string): Promise<PlannedRoute[]> {
  return (await api<{ routes: PlannedRoute[] }>("/routes", { token })).routes;
}

export async function fetchRoute(id: number, token: string | null): Promise<PlannedRoute> {
  return (await api<{ route: PlannedRoute }>(`/routes/${id}`, { token })).route;
}

export async function createRoute(token: string, route: RouteInput): Promise<PlannedRoute> {
  return (await api<{ route: PlannedRoute }>("/routes", { method: "POST", token, json: route })).route;
}

export async function updateRoute(token: string, id: number, changes: Partial<RouteInput>): Promise<PlannedRoute> {
  return (await api<{ route: PlannedRoute }>(`/routes/${id}`, { method: "POST", token, json: changes })).route;
}

export async function deleteRoute(token: string, id: number): Promise<void> {
  await api(`/routes/${id}`, { method: "DELETE", token });
}

/** The link that opens a route in the map planner. */
export function routeLink(id: number): string {
  return shareableUrl(`/karta?rutt=${id}`);
}
