// Minimal structural types for the slice of the ArcGIS Maps SDK this map
// uses. The SDK itself is loaded at runtime from the CDN (see arcgis-loader),
// so these stand in for real @arcgis/core types.

export type AmdRequire = (modules: string[], onLoad: (...mods: unknown[]) => void) => void;

declare global {
  interface Window {
    require?: AmdRequire;
  }
}

export type Ctor<T> = new (o?: unknown) => T;
export type EsriFeature = { geometry: unknown; attributes: Record<string, unknown> };
export type EsriQuery = { where: string; returnGeometry: boolean; outFields: string[] };
export type EsriLayerView = { queryFeatures: (q: EsriQuery) => Promise<{ features: EsriFeature[] }> };
export type EsriLayer = {
  definitionExpression: string;
  createQuery: () => EsriQuery;
  featureReduction: unknown;
  renderer: unknown;
};
export type EsriMapPoint = { longitude: number | null; latitude: number | null };
export type EsriView = {
  zoom: number;
  center: EsriMapPoint | null;
  openPopup: (o: unknown) => Promise<unknown>;
  destroy: () => void;
  when: () => Promise<unknown>;
  goTo: (target: unknown, options?: unknown) => Promise<unknown>;
  hitTest: (e: unknown, opts?: unknown) => Promise<{ results: { graphic?: EsriFeature }[] }>;
  whenLayerView: (layer: unknown) => Promise<EsriLayerView>;
  on: (event: string, handler: (e: unknown) => void) => void;
  toMap: (screenPoint: unknown) => EsriMapPoint | null;
  ui: { add: (widget: unknown, position: string) => void };
};
// Combined measurement widget — `activeTool` switches between the 2D distance
// and area tools; `clear()` removes the current measurement graphics.
export type MeasureTool = "distance" | "area";
export type EsriMeasurement = {
  activeTool: MeasureTool | null;
  clear: () => void;
  destroy: () => void;
};

// JSON-serialisable map artefacts (Graphic / Bookmark both expose `toJSON`).
export type EsriJSONObject = { toJSON: () => Record<string, unknown> };
export type EsriCollection<T> = {
  toArray: () => T[];
  on: (event: string, handler: () => void) => void;
};
// `Graphic` constructor, plus the static `fromJSON` used to rehydrate drawings.
export type EsriGraphicCtor = Ctor<EsriFeature> & {
  fromJSON: (json: Record<string, unknown>) => EsriFeature;
};
export type EsriGraphicsLayer = {
  graphics: EsriCollection<EsriJSONObject>;
  addMany: (graphics: unknown[]) => void;
};
// Sketch fires create/update/delete; `state === "complete"` marks a finished edit.
export type EsriSketch = {
  on: (event: string, handler: (e: { state?: string }) => void) => void;
};
export type EsriBookmarks = { bookmarks: EsriCollection<EsriJSONObject> };
// Expand widgets sharing a `group` collapse each other automatically; watching
// `expanded` lets the custom measure popup join that exclusivity too.
export type EsriExpand = { expanded: boolean; watch: (prop: string, cb: (value: boolean) => void) => void };
