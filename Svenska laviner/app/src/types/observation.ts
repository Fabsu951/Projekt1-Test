export type ObservationType = "lavin" | "sprickor" | "kollaps" | "glidsprickor" | "snotacke" | "ovrigt";

export interface Observation {
  id: number;
  userId: number;
  author: string;
  type: ObservationType;
  lat: number;
  lon: number;
  regionId: string | null;
  observedAt: string;
  createdAt: string;
  description: string;
  imagePath: string | null;
  hidden: boolean;
  reportCount: number;
}

export interface User {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
}
