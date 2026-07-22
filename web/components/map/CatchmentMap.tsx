"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CatchmentMapProps } from "./CatchmentMapLazy";
import { SELECTED_MIN_ZOOM, NZ_EXTENT } from "./catchment-map/constants";
import { DISPLAY_MODES, HEATMAP_RENDERER, POINT_RENDERER, CLUSTER_REDUCTION } from "./catchment-map/renderers";
import type { DisplayMode } from "./catchment-map/renderers";
import { popupContent } from "./catchment-map/popup";
import { useMapView } from "./catchment-map/use-map-view";
import { CheckIcon, LinkIcon, MenuItem, RulerIcon } from "./catchment-map/icons";

/**
 * ArcGIS Maps SDK renderer (client-side only — ADR-0005), modelled on the
 * landcare.org.nz catchments map: a national point layer of catchment /
 * community / environmental groups with clustering, click-to-open popups, and
 * two-way selection sync with the side list.
 *
 * The SDK is loaded from ESRI's CDN at runtime (AMD loader) rather than bundled.
 * @arcgis/core is ~123MB and makes Turbopack saturate CPU compiling the whole
 * module graph before the route can return any HTML. The CDN loader keeps the
 * SDK out of the bundle entirely. See ./catchment-map for the loader, types,
 * constants and the map/widget setup hook.
 */
export function CatchmentMap({
  groups,
  visibleIds,
  selectedId,
  regionFilter,
  onSelect,
}: CatchmentMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prevRegionRef = useRef<string | undefined>(undefined);

  const {
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
  } = useMapView(ref, groups, onSelect);

  // Whether the measurement options popup (under the ruler button) is open.
  const [menuOpen, setMenuOpen] = useState(false);
  const measureRef = useRef<HTMLDivElement | null>(null);
  // How the point layer is drawn; the segmented control below switches this.
  const [displayMode, setDisplayMode] = useState<DisplayMode>("clusters");
  // Transient "link copied" feedback on the share button.
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Apply the chosen display mode: clustered markers (default), every
  // individual point, or a density heatmap. Clustering and the heatmap are
  // mutually exclusive, so heatmap mode also turns clustering off.
  useEffect(() => {
    const layer = layerRef.current;
    if (!ready || !layer) return;
    if (displayMode === "heatmap") {
      layer.featureReduction = null;
      layer.renderer = HEATMAP_RENDERER;
    } else {
      layer.renderer = POINT_RENDERER;
      layer.featureReduction = displayMode === "clusters" ? CLUSTER_REDUCTION : null;
    }
  }, [ready, displayMode, layerRef]);

  // Apply the active search/filters by hiding non-matching points.
  useEffect(() => {
    const layer = layerRef.current;
    if (!ready || !layer) return;
    layer.definitionExpression = visibleIds.length
      ? `id IN (${visibleIds.map((id) => `'${id}'`).join(",")})`
      : "1=0";
  }, [ready, visibleIds, layerRef]);

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
      if (prev) view.goTo(NZ_EXTENT).catch(() => undefined);
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
  }, [ready, regionFilter, groups, viewRef]);

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
  }, [ready, selectedId, groups, viewRef, graphicsRef]);

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

  // Write the current viewpoint into the URL hash and copy the link, so the
  // exact view can be shared (parseMapHash restores it on load).
  function copyShareLink() {
    const view = viewRef.current;
    const center = view?.center;
    if (!view || !center || center.latitude == null || center.longitude == null) return;
    const url = new URL(window.location.href);
    url.hash = `map=${view.zoom.toFixed(2)}/${center.latitude.toFixed(5)}/${center.longitude.toFixed(5)}`;
    window.history.replaceState(null, "", url);
    navigator.clipboard?.writeText(url.toString()).catch(() => undefined);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
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

      {shareSlot &&
        createPortal(
          <button
            type="button"
            aria-label={copied ? "Link copied to clipboard" : "Copy a link to this map view"}
            title={copied ? "Link copied!" : "Copy a link to this map view"}
            onClick={copyShareLink}
            className={`flex h-8 w-8 items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-colors ${
              copied ? "bg-neutral-900 text-white" : "bg-white text-[#6e6e6e] hover:bg-neutral-100"
            }`}
          >
            {copied ? <CheckIcon /> : <LinkIcon />}
          </button>,
          shareSlot,
        )}

      {ready && (
        <div
          role="radiogroup"
          aria-label="Point display mode"
          className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-0.5 rounded-md border border-neutral-200 bg-white/95 p-0.5 text-xs shadow-md backdrop-blur"
        >
          {DISPLAY_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={displayMode === mode}
              onClick={() => setDisplayMode(mode)}
              className={`rounded px-2.5 py-1 font-medium capitalize transition-colors ${
                displayMode === mode
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      )}

      {hover && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 max-w-[240px] rounded-md bg-neutral-900/90 px-2 py-1 text-xs font-medium text-white shadow-sm"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.label}
        </div>
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
