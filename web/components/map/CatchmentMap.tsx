"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { CatchmentMapProps } from "./CatchmentMapLazy";
import { TYPE_COLORS, TYPE_LABELS } from "@/lib/group-types";

/**
 * ArcGIS Maps SDK renderer (client-side only — ADR-0005), modelled on the
 * landcare.org.nz catchments map: a national point layer of catchment /
 * community / environmental groups with clustering, click-to-open popups, and
 * two-way selection sync with the side list.
 *
 * The SDK is loaded from ESRI's CDN at runtime (AMD loader) rather than bundled.
 * @arcgis/core is ~123MB and makes Turbopack saturate CPU compiling the whole
 * module graph before the route can return any HTML. The CDN loader keeps the
 * SDK out of the bundle entirely.
 */
const ARCGIS_VERSION = "4.31";
const ARCGIS_BASE = `https://js.arcgis.com/${ARCGIS_VERSION}`;

// Full-country view (Aotearoa New Zealand).
const NZ_CENTER: [number, number] = [173.2, -41.0];
const NZ_ZOOM = 5;
const SELECTED_MIN_ZOOM = 9;

// Esri's World Geocoder. The Search widget may call this anonymously for
// interactive search (no API key needed); we restrict it to NZ addresses.
const GEOCODER_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

// Esri's public Export Web Map task, used by the Print widget to render the
// current map to PDF/image. Anonymous, no API key required.
const PRINT_SERVICE_URL =
  "https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task";

// localStorage keys for session-persisted map annotations and bookmarks.
const SKETCH_KEY = "catchmentmap:annotations";
const BOOKMARKS_KEY = "catchmentmap:bookmarks";

/** Read a JSON array from localStorage, tolerating missing/corrupt values. */
function loadStored(key: string): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist a JSON-serialisable value, swallowing quota/serialisation errors. */
function saveStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore — storage full or unavailable */
  }
}

type AmdRequire = (modules: string[], onLoad: (...mods: unknown[]) => void) => void;

declare global {
  interface Window {
    require?: AmdRequire;
  }
}

let loaderPromise: Promise<AmdRequire> | undefined;

/** Inject the ArcGIS CSS + AMD loader from the CDN once, then resolve `require`. */
function loadArcgis(): Promise<AmdRequire> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.require) return Promise.resolve(window.require);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<AmdRequire>((resolve, reject) => {
    if (!document.querySelector("link[data-arcgis]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${ARCGIS_BASE}/esri/themes/light/main.css`;
      link.dataset.arcgis = "true";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = `${ARCGIS_BASE}/init.js`;
    script.async = true;
    script.onload = () =>
      window.require ? resolve(window.require) : reject(new Error("ArcGIS loader missing"));
    script.onerror = () => reject(new Error("Failed to load ArcGIS SDK"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

/** Promisified AMD require for the modules we need. */
function requireModules(req: AmdRequire, modules: string[]): Promise<unknown[]> {
  return new Promise((resolve) => req(modules, (...mods) => resolve(mods)));
}

type Ctor<T> = new (o?: unknown) => T;
type EsriFeature = { geometry: unknown; attributes: Record<string, string> };
type EsriQuery = { where: string; returnGeometry: boolean; outFields: string[] };
type EsriLayerView = { queryFeatures: (q: EsriQuery) => Promise<{ features: EsriFeature[] }> };
type EsriLayer = { definitionExpression: string; createQuery: () => EsriQuery };
type EsriMapPoint = { longitude: number; latitude: number };
type EsriView = {
  zoom: number;
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
type MeasureTool = "distance" | "area";
type EsriMeasurement = {
  activeTool: MeasureTool | null;
  clear: () => void;
  destroy: () => void;
};

// JSON-serialisable map artefacts (Graphic / Bookmark both expose `toJSON`).
type EsriJSONObject = { toJSON: () => Record<string, unknown> };
type EsriCollection<T> = {
  toArray: () => T[];
  on: (event: string, handler: () => void) => void;
};
// `Graphic` constructor, plus the static `fromJSON` used to rehydrate drawings.
type EsriGraphicCtor = Ctor<EsriFeature> & {
  fromJSON: (json: Record<string, unknown>) => EsriFeature;
};
type EsriGraphicsLayer = {
  graphics: EsriCollection<EsriJSONObject>;
  addMany: (graphics: unknown[]) => void;
};
// Sketch fires create/update/delete; `state === "complete"` marks a finished edit.
type EsriSketch = {
  on: (event: string, handler: (e: { state?: string }) => void) => void;
};
type EsriBookmarks = { bookmarks: EsriCollection<EsriJSONObject> };

function markerSymbol(color: string) {
  return {
    type: "simple-marker",
    color,
    size: 9,
    outline: { color: "#ffffff", width: 1 },
  };
}

/** Build the popup HTML for a single group feature. */
function popupContent(feature: { graphic: EsriFeature }): string {
  const a = feature.graphic.attributes;
  const rows: [string, string][] = [
    ["Type", TYPE_LABELS[a.gtype as keyof typeof TYPE_LABELS] ?? a.gtype],
    ["Region", a.region],
    ["Status", a.status],
    ["Focus areas", a.focus || "—"],
  ];
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><th style="text-align:left;padding:2px 12px 2px 0;color:#525252;font-weight:500;vertical-align:top">${k}</th><td style="padding:2px 0">${v}</td></tr>`,
    )
    .join("");
  const desc = a.description ? `<p style="margin:8px 0 0">${a.description}</p>` : "";
  const site = a.website
    ? `<p style="margin:8px 0 0"><a href="${a.website}" target="_blank" rel="noopener">Visit website ↗</a></p>`
    : "";
  return `<table style="font-size:13px"><tbody>${table}</tbody></table>${desc}${site}`;
}

export function CatchmentMap({
  groups,
  visibleIds,
  selectedId,
  regionFilter,
  onSelect,
}: CatchmentMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EsriView | null>(null);
  const layerRef = useRef<EsriLayer | null>(null);
  const onSelectRef = useRef(onSelect);
  // Keep the ref pointing at the latest callback without re-running map setup.
  useEffect(() => {
    onSelectRef.current = onSelect;
  });
  const prevRegionRef = useRef<string | undefined>(undefined);
  // id → source graphic, so selecting a group can locate it without an async
  // layer query (which proved unreliable with client-side source + clustering).
  const graphicsRef = useRef<Map<string, EsriFeature>>(new Map());
  const measurementRef = useRef<EsriMeasurement | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [activeTool, setActiveTool] = useState<MeasureTool | null>(null);
  // Whether the measurement options popup (under the ruler button) is open.
  const [menuOpen, setMenuOpen] = useState(false);
  const measureRef = useRef<HTMLDivElement | null>(null);
  // Host node for the custom measure control, slotted into the ESRI widget stack.
  // Held in state (not a ref) so the portal renders once the node exists.
  const [measureSlot, setMeasureSlot] = useState<HTMLDivElement | null>(null);
  // Map longitude/latitude under the cursor, shown in the coordinate readout.
  const [pointer, setPointer] = useState<{ lng: number; lat: number } | null>(null);

  // Build the map + point layer once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!ref.current) return;
      const req = await loadArcgis().catch(() => undefined);
      if (!req) {
        setError(true);
        return;
      }
      const [
        EsriMap,
        MapView,
        FeatureLayer,
        Graphic,
        Search,
        Measurement,
        BasemapToggle,
        Home,
        Locate,
        Fullscreen,
        Legend,
        Expand,
        ScaleBar,
        GraphicsLayer,
        Sketch,
        Bookmarks,
        Print,
      ] = (await requireModules(req, [
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/FeatureLayer",
        "esri/Graphic",
        "esri/widgets/Search",
        "esri/widgets/Measurement",
        "esri/widgets/BasemapToggle",
        "esri/widgets/Home",
        "esri/widgets/Locate",
        "esri/widgets/Fullscreen",
        "esri/widgets/Legend",
        "esri/widgets/Expand",
        "esri/widgets/ScaleBar",
        "esri/layers/GraphicsLayer",
        "esri/widgets/Sketch",
        "esri/widgets/Bookmarks",
        "esri/widgets/Print",
      ])) as [
        Ctor<unknown>,
        Ctor<EsriView>,
        Ctor<EsriLayer>,
        EsriGraphicCtor,
        Ctor<unknown>,
        Ctor<EsriMeasurement>,
        Ctor<unknown>,
        Ctor<unknown>,
        Ctor<unknown>,
        Ctor<unknown>,
        Ctor<unknown>,
        Ctor<unknown>,
        Ctor<unknown>,
        Ctor<EsriGraphicsLayer>,
        Ctor<EsriSketch>,
        Ctor<EsriBookmarks>,
        Ctor<unknown>,
      ];
      if (cancelled || !ref.current) return;

      const graphics = new Map<string, EsriFeature>();
      const source = groups
        .filter((g) => g.location)
        .map((g, i) => {
          const graphic = new Graphic({
            geometry: { type: "point", longitude: g.location!.lng, latitude: g.location!.lat },
            attributes: {
              oid: i + 1,
              id: g.id,
              name: g.name,
              gtype: g.type,
              region: g.region,
              status: g.status,
              focus: g.focusAreas.join(", "),
              description: g.description ?? "",
              website: g.website ?? "",
            },
          }) as EsriFeature;
          graphics.set(g.id, graphic);
          return graphic;
        });
      graphicsRef.current = graphics;

      const layer = new FeatureLayer({
        source,
        objectIdField: "oid",
        geometryType: "point",
        spatialReference: { wkid: 4326 },
        fields: [
          { name: "oid", type: "oid" },
          { name: "id", type: "string" },
          { name: "name", type: "string" },
          { name: "gtype", type: "string" },
          { name: "region", type: "string" },
          { name: "status", type: "string" },
          { name: "focus", type: "string" },
          { name: "description", type: "string" },
          { name: "website", type: "string" },
        ],
        renderer: {
          type: "unique-value",
          field: "gtype",
          uniqueValueInfos: [
            { value: "catchment", symbol: markerSymbol(TYPE_COLORS.catchment) },
            { value: "community", symbol: markerSymbol(TYPE_COLORS.community) },
            { value: "environmental", symbol: markerSymbol(TYPE_COLORS.environmental) },
          ],
        },
        popupTemplate: { title: "{name}", content: popupContent },
        featureReduction: {
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
        },
      });
      layerRef.current = layer;

      // Empty layer the Sketch tool draws annotations onto, kept above the
      // group points so markups stay visible. Any drawings saved in a previous
      // session are rehydrated from localStorage.
      const sketchLayer = new GraphicsLayer({ title: "Annotations" });
      const storedGraphics = loadStored(SKETCH_KEY);
      if (storedGraphics.length) {
        sketchLayer.addMany(storedGraphics.map((g) => Graphic.fromJSON(g)));
      }
      const map = new EsriMap({ basemap: "topo-vector", layers: [layer, sketchLayer] });
      const view = new MapView({
        container: ref.current,
        map,
        center: NZ_CENTER,
        zoom: NZ_ZOOM,
        popup: { dockEnabled: false, collapseEnabled: false },
        constraints: { minZoom: 4 },
      });
      viewRef.current = view;

      // Address search, constrained to Aotearoa New Zealand. The single locator
      // source uses Esri's World Geocoder with `countryCode: "NZL"` so only NZ
      // addresses are suggested and returned; a found address zooms the view to
      // that location.
      const search = new Search({
        view,
        includeDefaultSources: false,
        popupEnabled: false,
        locationEnabled: false,
        allPlaceholder: "Search a New Zealand address…",
        sources: [
          {
            url: GEOCODER_URL,
            name: "New Zealand addresses",
            placeholder: "Search a New Zealand address…",
            // `countryCode` limits the geocoder to NZ precisely (incl. offshore
            // areas like the Chatham Islands). We deliberately avoid a bounding
            // box, which would wrongly exclude valid addresses near the edges.
            countryCode: "NZL",
            singleLineFieldName: "SingleLine",
          },
        ],
      });
      view.ui.add(search, "top-right");

      // Measurement tools (distance + area). The widget renders the running
      // result panel; the toolbar below the map switches `activeTool`. Drawing
      // happens by clicking points on the map: two points for a distance line,
      // three or more for an area polygon (which also reports its perimeter).
      const measurement = new Measurement({ view, activeTool: null });
      view.ui.add(measurement, "bottom-right");
      measurementRef.current = measurement;

      // Map-mode switch: toggle between the topographic basemap and satellite
      // aerial imagery. The widget shows a thumbnail of the inactive mode.
      const basemapToggle = new BasemapToggle({ view, nextBasemap: "satellite" });
      view.ui.add(basemapToggle, "bottom-left");

      // Home: one click returns the view to the national extent (the same
      // centre/zoom the map opens at), so users can recover after panning away.
      const home = new Home({ view });
      view.ui.add(home, "top-left");

      // Locate ("Near me"): geolocates the browser and zooms to the user's
      // position, the quickest way to find catchment groups near you. Uses the
      // standard Geolocation API — the browser prompts for permission.
      const locate = new Locate({ view });
      view.ui.add(locate, "top-left");

      // Fullscreen: expand the map element to fill the screen for an immersive
      // view, then restore. Targets the map container's wrapper.
      const fullscreen = new Fullscreen({ view });
      view.ui.add(fullscreen, "top-left");

      // Legend, tucked inside an Expand so it stays out of the way until needed.
      // It reads the layer renderer, so the group-type colours stay in sync with
      // the map automatically.
      const legend = new Legend({ view });
      const legendExpand = new Expand({
        view,
        content: legend,
        expanded: false,
        expandTooltip: "Legend",
        // Shared `group` makes the top-left expandables mutually exclusive:
        // opening one collapses whichever was previously open.
        group: "top-left",
      });
      view.ui.add(legendExpand, "top-left");

      // Scale bar (metric + imperial) for distance context at the current zoom.
      const scaleBar = new ScaleBar({ view, unit: "dual" });
      view.ui.add(scaleBar, "bottom-left");

      // Sketch: draw points, lines, polygons and rectangles onto the annotation
      // layer to mark up the map (e.g. an area of interest). Includes select,
      // reshape and delete; tucked inside an Expand to keep the toolbar compact.
      const sketch = new Sketch({
        view,
        layer: sketchLayer,
        creationMode: "update",
        visibleElements: { settingsMenu: false },
      });
      const sketchExpand = new Expand({
        view,
        content: sketch,
        expanded: false,
        expandTooltip: "Draw on the map",
        group: "top-left",
      });
      view.ui.add(sketchExpand, "top-left");

      // Persist drawings to localStorage whenever an edit completes (a shape is
      // finished, moved/reshaped, or deleted) so they survive a page reload.
      const persistSketch = () =>
        saveStored(SKETCH_KEY, sketchLayer.graphics.toArray().map((g) => g.toJSON()));
      sketch.on("create", (e) => {
        if (e.state === "complete") persistSketch();
      });
      sketch.on("update", (e) => {
        if (e.state === "complete") persistSketch();
      });
      sketch.on("delete", persistSketch);

      // Bookmarks: save the current viewpoint and jump back to it later. Editing
      // is enabled so users can capture their own spots; saved entries are loaded
      // from localStorage and re-persisted whenever the collection changes.
      const bookmarks = new Bookmarks({
        view,
        editingEnabled: true,
        visibleElements: { addBookmarkButton: true, editBookmarkButton: true },
        bookmarks: loadStored(BOOKMARKS_KEY),
      });
      bookmarks.bookmarks.on("change", () =>
        saveStored(BOOKMARKS_KEY, bookmarks.bookmarks.toArray().map((b) => b.toJSON())),
      );
      const bookmarksExpand = new Expand({
        view,
        content: bookmarks,
        expanded: false,
        expandTooltip: "Bookmarks",
        group: "top-left",
      });
      view.ui.add(bookmarksExpand, "top-left");

      // Print / export: render the current map (extent, layers, annotations) to a
      // downloadable PDF or image via Esri's anonymous Export Web Map service.
      const print = new Print({ view, printServiceUrl: PRINT_SERVICE_URL });
      const printExpand = new Expand({
        view,
        content: print,
        expanded: false,
        expandTooltip: "Print / export map",
        group: "top-left",
      });
      view.ui.add(printExpand, "top-left");

      // Slot the custom measurement control into the same top-left widget stack
      // so the ruler sits with the other tool icons. The button + popup are
      // rendered into this node via a React portal (see render below).
      const slot = document.createElement("div");
      setMeasureSlot(slot);
      view.ui.add(slot, "top-left");

      // Live coordinate readout: track the pointer and surface the map
      // longitude/latitude under the cursor in the custom overlay below.
      view.on("pointer-move", (event) => {
        const point = view.toMap(event);
        if (point) setPointer({ lng: point.longitude, lat: point.latitude });
      });
      view.on("pointer-leave", () => setPointer(null));

      // Map click → select the underlying group (clusters have no `id`, so they
      // fall through to the default cluster popup).
      view.on("click", (event) => {
        view.hitTest(event, { include: layer }).then((resp) => {
          const graphic = resp.results.find((r) => r.graphic?.attributes?.id)?.graphic;
          if (graphic) onSelectRef.current(graphic.attributes.id);
        });
      });

      await view.when().catch(() => undefined);
      if (cancelled) return;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
      layerRef.current = null;
      measurementRef.current = null;
      setMeasureSlot(null);
      setReady(false);
      setActiveTool(null);
      setMenuOpen(false);
      setPointer(null);
    };
  }, [groups]);

  // Apply the active search/filters by hiding non-matching points.
  useEffect(() => {
    const layer = layerRef.current;
    if (!ready || !layer) return;
    layer.definitionExpression = visibleIds.length
      ? `id IN (${visibleIds.map((id) => `'${id}'`).join(",")})`
      : "1=0";
  }, [ready, visibleIds]);

  // When a region is chosen, zoom the map in and centre it on that region; when
  // the region filter is cleared (after having been set), zoom back out to the
  // whole country. The target is computed directly from the group coordinates
  // (rather than an async layer query) so it's deterministic. Selecting a single
  // group still takes precedence (its own effect runs after and zooms in further).
  useEffect(() => {
    const view = viewRef.current;
    if (!ready || !view) return;
    const prev = prevRegionRef.current;
    prevRegionRef.current = regionFilter;

    if (!regionFilter) {
      // Only reset the view when a region was previously active.
      if (prev) view.goTo({ center: NZ_CENTER, zoom: NZ_ZOOM }).catch(() => undefined);
      return;
    }

    const points = groups
      .filter((g) => g.region === regionFilter && g.location)
      .map((g) => g.location!);
    if (points.length === 0) return;

    const lngs = points.map((p) => p.lng);
    const lats = points.map((p) => p.lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

    // Derive a zoom from the geographic spread of the region's groups so the
    // whole region fits while still zooming in from the national view. A lone
    // point (span clamped to the floor) lands at a city-level zoom.
    const span = Math.max(maxLng - minLng, maxLat - minLat, 0.08);
    const zoom = Math.max(6, Math.min(12, Math.round(Math.log2(360 / span)) - 1));

    view.goTo({ center, zoom }, { duration: 800 }).catch(() => undefined);
  }, [ready, regionFilter, groups]);

  // Zoom to and open the popup for the selected group.
  useEffect(() => {
    const view = viewRef.current;
    if (!ready || !view || !selectedId) return;
    const group = groups.find((g) => g.id === selectedId);
    const graphic = graphicsRef.current.get(selectedId);
    if (!group?.location || !graphic) return;
    let cancelled = false;

    // Zoom in and centre on the selected group (computed directly from its
    // coordinates so it's deterministic), then open its popup. Never zoom out:
    // keep the current zoom if it's already deeper than the per-group minimum.
    view
      .goTo({
        center: [group.location.lng, group.location.lat],
        zoom: Math.max(view.zoom, SELECTED_MIN_ZOOM),
      })
      .then(() => {
        if (cancelled) return;
        view.openPopup({
          location: graphic.geometry,
          title: group.name,
          content: popupContent({ graphic }),
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [ready, selectedId, groups]);

  // Close the options popup on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (measureRef.current && !measureRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Activate a measurement tool, or toggle it off (clearing any drawing) when
  // the same tool is tapped again.
  function toggleTool(tool: MeasureTool) {
    const m = measurementRef.current;
    if (!m) return;
    setActiveTool((current) => {
      if (current === tool) {
        m.clear();
        m.activeTool = null;
        return null;
      }
      m.activeTool = tool;
      return tool;
    });
  }

  function clearMeasurements() {
    const m = measurementRef.current;
    if (!m) return;
    m.clear();
    m.activeTool = null;
    setActiveTool(null);
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-neutral-500">
        The interactive map could not be loaded. Use the list on the left to browse catchment groups.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={ref}
        role="application"
        aria-label="Interactive catchment map of Aotearoa New Zealand"
        className="h-full w-full"
      />

      {measureSlot &&
        createPortal(
          <div ref={measureRef} className="relative">
            <button
              type="button"
              aria-label="Measurement tools"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-pressed={activeTool !== null}
              onClick={() => setMenuOpen((open) => !open)}
              // Match the 32px square ESRI widget buttons it sits beside.
              className={`flex h-8 w-8 items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-colors ${
                activeTool !== null
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-[#6e6e6e] hover:bg-neutral-100"
              }`}
            >
              <RulerIcon />
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="Map measurement tools"
                // Open to the right so it doesn't cover the icons stacked below.
                className="absolute left-full top-0 ml-1.5 flex flex-col gap-0.5 rounded-md border border-neutral-200 bg-white/95 p-1 text-sm shadow-md backdrop-blur"
              >
                <MenuItem
                  active={activeTool === "distance"}
                  onClick={() => toggleTool("distance")}
                >
                  Measure distance
                </MenuItem>
                <MenuItem active={activeTool === "area"} onClick={() => toggleTool("area")}>
                  Measure area
                </MenuItem>
                <button
                  type="button"
                  role="menuitem"
                  onClick={clearMeasurements}
                  disabled={!activeTool}
                  className="rounded px-2.5 py-1.5 text-left font-medium text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            )}
          </div>,
          measureSlot,
        )}

      {ready && pointer && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md border border-neutral-200 bg-white/95 px-2.5 py-1 font-mono text-xs tabular-nums text-neutral-600 shadow-sm backdrop-blur"
        >
          {pointer.lat.toFixed(4)}°, {pointer.lng.toFixed(4)}°
        </div>
      )}
    </div>
  );
}

function MenuItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`whitespace-nowrap rounded px-2.5 py-1.5 text-left font-medium transition-colors ${
        active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

// Simple ruler glyph for the measurement tools trigger.
function RulerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.6 8.5 8.5 3.6a1.5 1.5 0 0 1 2.1 0l9.8 9.8a1.5 1.5 0 0 1 0 2.1l-4.9 4.9a1.5 1.5 0 0 1-2.1 0L3.6 10.6a1.5 1.5 0 0 1 0-2.1Z" />
      <path d="m8 6 2 2M11 9l1.5 1.5M14 6l2 2M9 11l1.5 1.5" />
    </svg>
  );
}
