"use client";

import { asset } from "@/lib/asset";
import { GROUP_ORDER } from "@/lib/categories";
import type { LayerMode } from "@/lib/filter";
import { useMemo, useState } from "react";

export type LayerRow = {
  key: string;
  label: string;
  group: string;
  icon: string;
  info: string;
  count: number;
};

type Result = {
  id: string;
  title: string;
  category: string;
  level?: string;
};

type Props = {
  open: boolean;
  query: string;
  onQuery: (value: string) => void;
  layers: LayerRow[];
  enabled: Record<string, boolean>;
  onToggle: (key: string) => void;
  onToggleGroup: (group: string, on: boolean) => void;
  onPreset: (mode: LayerMode) => void;
  results: Result[];
  onPick: (id: string) => void;
};

export default function Sidebar({
  open,
  query,
  onQuery,
  layers,
  enabled,
  onToggle,
  onToggleGroup,
  onPreset,
  results,
  onPick,
}: Props) {
  const [closed, setClosed] = useState<Record<string, boolean>>({
    Loot: true,
    Distortion: true,
    Other: true,
    Interactions: true,
  });

  const groups = useMemo(() => {
    const known = new Set(GROUP_ORDER);
    const names = [...GROUP_ORDER, ...layers.map((layer) => layer.group).filter((group) => !known.has(group))];
    return names
      .map((name) => ({ name, rows: layers.filter((layer) => layer.group === name && layer.count > 0) }))
      .filter((group) => group.rows.length > 0);
  }, [layers]);

  return (
    <aside className={open ? "sidebar is-open" : "sidebar"}>
      <label className="search">
        <span className="sr">Search markers</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search keys, extracts, loot"
          autoComplete="off"
        />
      </label>
      <div className="presets" role="group" aria-label="Layer presets">
        <button type="button" onClick={() => onPreset("essentials")}>Essentials</button>
        <button type="button" onClick={() => onPreset("all")}>All</button>
        <button type="button" onClick={() => onPreset("loot")}>Loot</button>
      </div>
      {query.trim() ? (
        <ul className="results">
          {results.length === 0 ? <li className="empty">Nothing matches.</li> : null}
          {results.map((result) => (
            <li key={result.id}>
              <button type="button" onClick={() => onPick(result.id)}>
                <strong>{result.title}</strong>
                <span>{result.category}{result.level ? ` · ${result.level}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="groups">
        {groups.map((group) => {
          const onCount = group.rows.filter((row) => enabled[row.key] !== false).length;
          const allOn = onCount === group.rows.length;
          return (
            <section key={group.name}>
              <header>
                <button type="button" className="group-name" onClick={() => setClosed((prev) => ({ ...prev, [group.name]: !prev[group.name] }))}>
                  <span>{closed[group.name] ? "▸" : "▾"}</span>
                  {group.name}
                </button>
                <button type="button" className="group-toggle" onClick={() => onToggleGroup(group.name, !allOn)}>
                  {allOn ? "Hide" : "Show"}
                </button>
              </header>
              {closed[group.name] ? null : (
                <ul>
                  {group.rows.map((row) => (
                    <li key={row.key}>
                      <label title={row.info || row.label}>
                        <input
                          type="checkbox"
                          checked={enabled[row.key] !== false}
                          onChange={() => onToggle(row.key)}
                        />
                        <img src={asset(row.icon)} alt="" width={18} height={18} />
                        <span>{row.label}</span>
                        <em>{row.count}</em>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="sidebar-note">Map images are loaded through this app from the public tile host.</p>
    </aside>
  );
}
