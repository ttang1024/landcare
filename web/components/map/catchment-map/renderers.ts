import { TYPE_COLORS } from "@/lib/group-types";

function markerSymbol(color: string) {
  return {
    type: "simple-marker",
    color,
    size: 9,
    outline: { color: "#ffffff", width: 1 },
  };
}

// One coloured marker per group type — the layer's default renderer, restored
// when leaving heatmap mode.
export const POINT_RENDERER = {
  type: "unique-value",
  field: "gtype",
  uniqueValueInfos: [
    { value: "catchment", symbol: markerSymbol(TYPE_COLORS.catchment) },
    { value: "community", symbol: markerSymbol(TYPE_COLORS.community) },
    { value: "environmental", symbol: markerSymbol(TYPE_COLORS.environmental) },
  ],
};

// Cluster display (the default) — nearby points merge into a counted circle.
export const CLUSTER_REDUCTION = {
  type: "cluster",
  clusterRadius: "80px",
  clusterMinSize: "22px",
  clusterMaxSize: "44px",
  labelingInfo: [
    {
      deconflictionStrategy: "none",
      labelExpressionInfo: { expression: "Text($feature.cluster_count, '#,###')" },
      symbol: { type: "text", color: "#ffffff", font: { weight: "bold", size: "11px" } },
      labelPlacement: "center-center",
    },
  ],
  popupTemplate: { content: "This cluster contains {cluster_count} groups. Zoom in to see them." },
};

// Density surface for heatmap mode. The dataset is a few dozen national points,
// so a generous radius and low max density keep regional concentrations visible
// at the country-wide zoom.
export const HEATMAP_RENDERER = {
  type: "heatmap",
  radius: 40,
  maxDensity: 0.001,
  minDensity: 0,
  colorStops: [
    { ratio: 0, color: "rgba(46, 125, 50, 0)" },
    { ratio: 0.3, color: "rgba(46, 125, 50, 0.55)" },
    { ratio: 0.65, color: "rgba(255, 179, 0, 0.8)" },
    { ratio: 1, color: "rgba(216, 67, 21, 0.95)" },
  ],
};

/** How the group points are drawn: clustered, individual, or a density heatmap. */
export type DisplayMode = "clusters" | "points" | "heatmap";
export const DISPLAY_MODES: DisplayMode[] = ["clusters", "points", "heatmap"];
