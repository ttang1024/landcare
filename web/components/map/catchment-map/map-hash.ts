/**
 * Viewpoint encoded in the URL hash as `#map=<zoom>/<lat>/<lng>` — written by
 * the "copy link" control, read here so a shared link reopens the same view.
 */
export function parseMapHash(): { center: [number, number]; zoom: number } | null {
  const m = window.location.hash.match(/map=(-?[\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)/);
  if (!m) return null;
  const zoom = Number(m[1]);
  const lat = Number(m[2]);
  const lng = Number(m[3]);
  // Reject out-of-range values (a doctored link with lat 999 or zoom 99 would
  // otherwise open onto a blank void) — fall back to the national view instead.
  if (![zoom, lat, lng].every(Number.isFinite)) return null;
  if (zoom < 0 || zoom > 23 || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { center: [lng, lat], zoom };
}
