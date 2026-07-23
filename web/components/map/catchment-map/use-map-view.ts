"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Group } from "@/lib/api";
import {
  BOOKMARKS_KEY,
  GEOCODER_URL,
  NZ_EXTENT,
  PRINT_SERVICE_URL,
  SKETCH_KEY,
} from "./constants";
import { loadArcgis, requireModules } from "./arcgis-loader";
import { parseMapHash } from "./map-hash";
import { groupAttributes, popupContent } from "./popup";
import { CLUSTER_REDUCTION, POINT_RENDERER } from "./renderers";
import { loadStored, saveStored } from "./storage";
import type {
  Ctor,
  EsriBookmarks,
  EsriExpand,
  EsriFeature,
  EsriGraphicCtor,
  EsriGraphicsLayer,
  EsriLayer,
  EsriMeasurement,
  EsriSketch,
  EsriView,
  MeasureTool,
} from "./arcgis-types";

/**
 * Builds the ArcGIS map + point layer + widget stack once per `groups`
 * identity, and exposes the refs/state the rest of CatchmentMap needs to
 * react to it (selection sync, display-mode switching, the measurement
 * toolbar, hover tooltip, coordinate readout).
 */
export function useMapView(
  ref: RefObject<HTMLDivElement | null>,
  groups: Group[],
  onSelect: (id: string) => void,
  onExpandOpen: () => void,
) {
  const viewRef = useRef<EsriView | null>(null);
  const layerRef = useRef<EsriLayer | null>(null);
  const onSelectRef = useRef(onSelect);
  const onExpandOpenRef = useRef(onExpandOpen);
  // Keep the refs pointing at the latest callbacks without re-running map setup.
  useEffect(() => {
    onSelectRef.current = onSelect;
    onExpandOpenRef.current = onExpandOpen;
  });
  // id → source graphic, so selecting a group can locate it without an async
  // layer query (which proved unreliable with client-side source + clustering).
  const graphicsRef = useRef<Map<string, EsriFeature>>(new Map());
  const measurementRef = useRef<EsriMeasurement | null>(null);
  // The top-left Expand widgets (legend/sketch/bookmarks/print) collapse each
  // other via their shared `group`; kept here so the custom measure popup,
  // which lives outside that widget group, can join the same exclusivity.
  const expandWidgetsRef = useRef<EsriExpand[]>([]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [activeTool, setActiveTool] = useState<MeasureTool | null>(null);
  // Host node for the custom measure control, slotted into the ESRI widget stack.
  // Held in state (not a ref) so the portal renders once the node exists.
  const [measureSlot, setMeasureSlot] = useState<HTMLDivElement | null>(null);
  // Host node for the "copy link" button, slotted into the ESRI widget stack.
  const [shareSlot, setShareSlot] = useState<HTMLDivElement | null>(null);
  // Map longitude/latitude under the cursor, shown in the coordinate readout.
  const [pointer, setPointer] = useState<{ lng: number; lat: number } | null>(null);
  // Group (or cluster) under the cursor — drives the hover tooltip.
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);

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
        BasemapGallery,
        Home,
        Compass,
        Locate,
        Fullscreen,
        Legend,
        Expand,
        ScaleBar,
        GraphicsLayer,
        Sketch,
        Bookmarks,
        Bookmark,
        Print,
      ] = (await requireModules(req, [
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/FeatureLayer",
        "esri/Graphic",
        "esri/widgets/Search",
        "esri/widgets/Measurement",
        "esri/widgets/BasemapGallery",
        "esri/widgets/Home",
        "esri/widgets/Compass",
        "esri/widgets/Locate",
        "esri/widgets/Fullscreen",
        "esri/widgets/Legend",
        "esri/widgets/Expand",
        "esri/widgets/ScaleBar",
        "esri/layers/GraphicsLayer",
        "esri/widgets/Sketch",
        "esri/widgets/Bookmarks",
        "esri/webmap/Bookmark",
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
        Ctor<EsriExpand>,
        Ctor<unknown>,
        Ctor<EsriGraphicsLayer>,
        Ctor<EsriSketch>,
        Ctor<EsriBookmarks>,
        { fromJSON: (json: Record<string, unknown>) => unknown },
        Ctor<unknown>,
      ];
      if (cancelled || !ref.current) return;

      const graphics = new Map<string, EsriFeature>();
      // objectId → source group, so the popup can recover full attributes for
      // a lone point ArcGIS represents as a single-member "cluster" (see
      // popupContentResilient below).
      const byOid = new Map<number, Group>();
      const source = groups
        .filter((g) => g.location)
        .map((g, i) => {
          const oid = i + 1;
          byOid.set(oid, g);
          const graphic = new Graphic({
            geometry: { type: "point", longitude: g.location!.lng, latitude: g.location!.lat },
            attributes: groupAttributes(g, oid),
          }) as EsriFeature;
          graphics.set(g.id, graphic);
          return graphic;
        });
      graphicsRef.current = graphics;

      // Clustering (the default display mode) represents *every* point as an
      // aggregate graphic for rendering/hit-testing purposes, even a lone
      // point with no neighbours. That aggregate only carries fields ArcGIS
      // can statically detect are needed (e.g. `cluster_count`, and `gtype`
      // since the renderer references it) — not the ones only read inside
      // this opaque content function (`region`, `status`, `focus`, `id`...),
      // which come back undefined. Resolve those cases back to the real
      // group via `oid` (always present) before rendering.
      const popupContentResilient = (feature: { graphic: EsriFeature }): string => {
        const attrs = feature.graphic.attributes;
        if (attrs.id) return popupContent(feature);
        const group = byOid.get(Number(attrs.oid));
        if (!group) return popupContent(feature);
        return popupContent({ graphic: { ...feature.graphic, attributes: groupAttributes(group, Number(attrs.oid)) } });
      };

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
        renderer: POINT_RENDERER,
        popupTemplate: { title: "{name}", content: popupContentResilient },
        featureReduction: CLUSTER_REDUCTION,
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
      const map = new EsriMap({ basemap: "satellite", layers: [layer, sketchLayer] });
      // A shared link (`#map=zoom/lat/lng`) reopens at that exact viewpoint;
      // otherwise start at the national extent.
      const sharedView = parseMapHash();
      const view = new MapView({
        container: ref.current,
        map,
        ...(sharedView ?? { extent: NZ_EXTENT }),
        popup: { dockEnabled: false, visibleElements: { collapseButton: false } },
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

      // Basemap picker: choose from Esri's gallery of basemaps (satellite,
      // topographic, streets, terrain, etc.). The map opens on satellite
      // imagery; the gallery lets users switch to any other view. Tucked inside
      // an Expand so it stays a single icon until opened.
      const basemapGallery = new BasemapGallery({ view });
      const basemapExpand = new Expand({
        view,
        content: basemapGallery,
        expanded: false,
        expandTooltip: "Change basemap",
      });
      view.ui.add(basemapExpand, "bottom-left");

      // Home: one click returns the view to the national extent (the same
      // centre/zoom the map opens at), so users can recover after panning away.
      const home = new Home({ view });
      view.ui.add(home, "top-left");

      // Compass: shows the current heading once the map is rotated (right-click
      // drag, or two-finger twist on touch); clicking it snaps back to north.
      const compass = new Compass({ view });
      view.ui.add(compass, "top-left");

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
        dragEnabled: true,
        visibleElements: { addBookmarkButton: true, editBookmarkButton: true },
        bookmarks: loadStored(BOOKMARKS_KEY).map((b) => Bookmark.fromJSON(b)),
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

      // Watch the group so the custom measure popup (outside the Expand
      // widgets' own `group` mechanism) can join the same exclusivity: notify
      // CatchmentMap to close its popup whenever one of these opens.
      const expandWidgets = [legendExpand, sketchExpand, bookmarksExpand, printExpand];
      expandWidgetsRef.current = expandWidgets;
      expandWidgets.forEach((widget) => {
        widget.watch("expanded", (expanded) => {
          if (expanded) onExpandOpenRef.current();
        });
      });

      // Slot the custom measurement control into the same top-left widget stack
      // so the ruler sits with the other tool icons. The button + popup are
      // rendered into this node via a React portal (see CatchmentMap's render).
      const slot = document.createElement("div");
      setMeasureSlot(slot);
      view.ui.add(slot, "top-left");

      // Same pattern for the "copy a link to this view" button.
      const share = document.createElement("div");
      setShareSlot(share);
      view.ui.add(share, "top-left");

      // Live coordinate readout + hover tooltip: track the pointer, surface the
      // map longitude/latitude under the cursor, and name the group (or size of
      // the cluster) being hovered. hitTest results also drive the pointer
      // cursor so points read as clickable.
      let hitPending = false;
      view.on("pointer-move", (event) => {
        const point = view.toMap(event);
        // `toMap` can return a point with null lng/lat when the cursor is over
        // an area outside the projected map; skip those so the readout (which
        // calls `toFixed`) never sees a null coordinate.
        if (point && point.longitude != null && point.latitude != null) {
          setPointer({ lng: point.longitude, lat: point.latitude });
        }

        // At most one hitTest in flight — pointer-move fires far faster than
        // the test resolves, and a stale tooltip one frame behind is fine.
        if (hitPending) return;
        hitPending = true;
        const { x, y } = event as { x: number; y: number };
        view
          .hitTest(event, { include: layer })
          .then((resp) => {
            hitPending = false;
            const attrs = resp.results.find((r) => r.graphic?.attributes)?.graphic?.attributes;
            const count = Number(attrs?.cluster_count);
            const label = attrs?.id
              ? String(attrs.name)
              : count >= 1
                ? `${count} ${count === 1 ? "group" : "groups"} — click to zoom in`
                : null;
            setHover(label ? { x, y, label } : null);
            if (ref.current) ref.current.style.cursor = label ? "pointer" : "";
          })
          .catch(() => {
            hitPending = false;
          });
      });
      view.on("pointer-leave", () => {
        setPointer(null);
        setHover(null);
      });

      // Map click → select the underlying group (clusters have no `id`, so they
      // fall through to the default cluster popup).
      view.on("click", (event) => {
        view.hitTest(event, { include: layer }).then((resp) => {
          const graphic = resp.results.find((r) => r.graphic?.attributes?.id)?.graphic;
          if (graphic) onSelectRef.current(String(graphic.attributes.id));
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
      setShareSlot(null);
      setReady(false);
      setActiveTool(null);
      setPointer(null);
      setHover(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

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

  // Collapse the top-left Expand widgets (legend/sketch/bookmarks/print), so
  // opening the custom measure popup hides whichever of them was open.
  function collapseExpandGroup() {
    expandWidgetsRef.current.forEach((widget) => {
      widget.expanded = false;
    });
  }

  return {
    viewRef,
    layerRef,
    graphicsRef,
    ready,
    error,
    activeTool,
    toggleTool,
    clearMeasurements,
    measureSlot,
    shareSlot,
    pointer,
    hover,
    collapseExpandGroup,
  };
}
