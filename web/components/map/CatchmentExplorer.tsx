"use client";

import { useMemo, useState } from "react";
import type { Group } from "@/lib/api";
import { TYPE_COLORS, TYPE_LABELS } from "@/lib/group-types";
import { CatchmentMapLazy } from "./CatchmentMapLazy";

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values)).sort();
}

/**
 * Client-side catchment explorer: a searchable, filterable national list paired
 * with the interactive map. Selecting a group (in the list or on the map) keeps
 * the two views in sync. The list is the accessible, keyboard-navigable fallback
 * for the map (WCAG AA, Module 1).
 */
export function CatchmentExplorer({ groups }: { groups: Group[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [type, setType] = useState("");
  const [focus, setFocus] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const regions = useMemo(() => unique(groups.map((g) => g.region)), [groups]);
  const focuses = useMemo(() => unique(groups.flatMap((g) => g.focusAreas)), [groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => {
      if (region && g.region !== region) return false;
      if (type && g.type !== type) return false;
      if (status && g.status !== status) return false;
      if (focus && !g.focusAreas.includes(focus)) return false;
      if (q) {
        const haystack = `${g.name} ${g.region} ${g.description ?? ""} ${g.focusAreas.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [groups, query, region, type, focus, status]);

  const visibleIds = useMemo(() => filtered.map((g) => g.id), [filtered]);
  const hasFilters = Boolean(query || region || type || focus || status);

  function clearFilters() {
    setQuery("");
    setRegion("");
    setType("");
    setFocus("");
    setStatus("");
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside
        aria-label="Catchment groups — search, filters and results"
        className="flex max-h-[45vh] w-full shrink-0 flex-col border-b border-neutral-200 lg:max-h-none lg:w-[360px] lg:border-r lg:border-b-0"
      >
        <div className="space-y-3 border-b border-neutral-200 p-4">
          <p className="text-sm text-neutral-600">
            A national view of catchment collectives, catchment groups and environmental community
            groups across Aotearoa. Search or filter, then select a group to locate it on the map.
          </p>

          <label className="block">
            <span className="sr-only">Search groups</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, region or focus…"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Select label="Region" value={region} onChange={setRegion} options={regions} />
            <Select
              label="Type"
              value={type}
              onChange={setType}
              options={["catchment", "community", "environmental"]}
            />
            <Select label="Focus" value={focus} onChange={setFocus} options={focuses} />
            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={["active", "forming", "dormant"]}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span aria-live="polite">
              {filtered.length} of {groups.length} groups
            </span>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="underline hover:no-underline">
                Clear filters
              </button>
            )}
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
            {(Object.keys(TYPE_COLORS) as Group["type"][]).map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[t] }}
                />
                {TYPE_LABELS[t]}
              </li>
            ))}
          </ul>
        </div>

        <ul aria-label="Matching groups" className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="p-4 text-sm text-neutral-500">No groups match these filters.</li>
          )}
          {filtered.map((g) => {
            const isSelected = g.id === selectedId;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(g.id)}
                  className={`block w-full px-4 py-3 text-left transition-colors hover:bg-neutral-50 ${
                    isSelected ? "bg-neutral-100" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[g.type] }}
                    />
                    <span className="font-medium text-neutral-900">{g.name}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {g.region} · {g.status}
                  </span>
                  {g.focusAreas.length > 0 && (
                    <span className="mt-1 block text-xs text-neutral-400">{g.focusAreas.join(", ")}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="relative min-h-0 flex-1">
        <CatchmentMapLazy
          groups={groups}
          visibleIds={visibleIds}
          selectedId={selectedId}
          regionFilter={region}
          onSelect={setSelectedId}
        />
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-neutral-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm capitalize"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
