import type { Group } from "./api";

/** Marker / legend colour per group type — shared by the map renderer and list. */
export const TYPE_COLORS: Record<Group["type"], string> = {
  catchment: "#2e7d32", // landcare green
  community: "#0277bd", // water blue
  environmental: "#ef6c00", // earth orange
};

export const TYPE_LABELS: Record<Group["type"], string> = {
  catchment: "Catchment group",
  community: "Community group",
  environmental: "Environmental group",
};
