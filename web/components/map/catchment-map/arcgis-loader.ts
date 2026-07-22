import { ARCGIS_BASE } from "./constants";
import type { AmdRequire } from "./arcgis-types";

let loaderPromise: Promise<AmdRequire> | undefined;

/** Inject the ArcGIS CSS + AMD loader from the CDN once, then resolve `require`. */
export function loadArcgis(): Promise<AmdRequire> {
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
export function requireModules(req: AmdRequire, modules: string[]): Promise<unknown[]> {
  return new Promise((resolve) => req(modules, (...mods) => resolve(mods)));
}
