const ARCGIS_VERSION = "4.31";
export const ARCGIS_BASE = `https://js.arcgis.com/${ARCGIS_VERSION}`;

// Full-country view (Aotearoa New Zealand). A geographic extent of the main
// islands (incl. Stewart Island) rather than a fixed centre/zoom, so the country
// fills the frame at any aspect ratio instead of floating in a sea of ocean.
export const NZ_EXTENT = {
  xmin: 166.0,
  ymin: -47.4,
  xmax: 178.8,
  ymax: -34.0,
  spatialReference: { wkid: 4326 },
};
export const SELECTED_MIN_ZOOM = 9;

// Esri's World Geocoder. The Search widget may call this anonymously for
// interactive search (no API key needed); we restrict it to NZ addresses.
export const GEOCODER_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

// Esri's public Export Web Map task, used by the Print widget to render the
// current map to PDF/image. Anonymous, no API key required.
export const PRINT_SERVICE_URL =
  "https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task";

// localStorage keys for session-persisted map annotations and bookmarks.
export const SKETCH_KEY = "catchmentmap:annotations";
export const BOOKMARKS_KEY = "catchmentmap:bookmarks";
