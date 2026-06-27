import { api } from "@/lib/api";
import { sampleGroups } from "@/lib/sample-groups";
import { CatchmentExplorer } from "@/components/map/CatchmentExplorer";

/**
 * Module 1 — Interactive Catchment Map. A single full-bleed national map of
 * catchment collectives, catchment groups and environmental community groups
 * across Aotearoa, modelled on landcare.org.nz/regions-groups/catchments-map.
 *
 * Groups come from the PHP API; when it returns nothing (no seed data / offline)
 * we fall back to a bundled sample so the map is never empty. All filtering and
 * search happen client-side in the explorer for an instant, map-like experience.
 */
export default async function MapPage() {
  const { groups } = await api.mapGroups().catch(() => ({ groups: [] }));
  const data = groups.length > 0 ? groups : sampleGroups;

  return <CatchmentExplorer groups={data} />;
}
