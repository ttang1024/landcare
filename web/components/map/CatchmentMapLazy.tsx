"use client";

import dynamic from "next/dynamic";
import type { Group } from "@/lib/api";

/**
 * Client-only, lazily-loaded wrapper for the ArcGIS map. The @arcgis/core
 * package is large; loading it via next/dynamic with ssr:false keeps it out of
 * the route's critical compile — the page renders instantly with the accessible
 * GroupList fallback, and the map chunk loads on demand in the browser.
 */
const CatchmentMap = dynamic(
  () => import("./CatchmentMap").then((m) => m.CatchmentMap),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-live="polite"
        className="flex h-full w-full items-center justify-center text-sm text-neutral-500"
      >
        Loading map…
      </div>
    ),
  },
);

export type CatchmentMapProps = {
  /** Full dataset — the map's point source is built from this once. */
  groups: Group[];
  /** Ids currently passing the active search/filters; the rest are hidden. */
  visibleIds: string[];
  /** Currently selected group — the map zooms to it and opens its popup. */
  selectedId?: string;
  /** Active region filter — the map zooms to fit that region's groups. */
  regionFilter?: string;
  /** Called when a point is clicked on the map. */
  onSelect: (id: string) => void;
};

export function CatchmentMapLazy(props: CatchmentMapProps) {
  return <CatchmentMap {...props} />;
}
