import { env } from "./env";

/** Thin typed client for the PHP REST API. Used from Server Components/Actions. */
export type Group = {
  id: string;
  name: string;
  type: "catchment" | "community" | "environmental";
  region: string;
  status: "active" | "forming" | "dormant";
  focusAreas: string[];
  description: string | null;
  website: string | null;
  location: { lat: number; lng: number } | null;
  // Present only when publishable (server enforces ADR-0006).
  contactEmail?: string | null;
  contactPhone?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  /** All groups for the national map; filtering/search happen client-side. */
  mapGroups: () => request<{ groups: Group[] }>(`/v1/map/groups`),
};
