import type { Group } from "@/lib/api";
import { TYPE_LABELS } from "@/lib/group-types";
import type { EsriFeature } from "./arcgis-types";

/** The attribute bag a group contributes to its point-layer graphic. */
export function groupAttributes(g: Group, oid: number): Record<string, unknown> {
  return {
    oid,
    id: g.id,
    name: g.name,
    gtype: g.type,
    region: g.region,
    status: g.status,
    focus: g.focusAreas.join(", "),
    description: g.description ?? "",
    website: g.website ?? "",
  };
}

/** Build the popup HTML for a single group feature. */
export function popupContent(feature: { graphic: EsriFeature }): string {
  const a = feature.graphic.attributes as Record<string, string>;
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
