"use client";

import { CATEGORIES, categoryMeta } from "@/lib/categories";
import { defaultEnabled, isForbiddenTier, isVisible, layerKey, primaryCoordinate, type LayerMode } from "@/lib/filter";
import { floorLabel, MAPS } from "@/lib/maps";
import type { ProfitRoute } from "@/lib/profit";
import type { AbiMap, Marker, QuickFilter } from "@/lib/types";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ProfitPanel from "./ProfitPanel";
import Sidebar, { type LayerRow } from "./Sidebar";

const MapStage = dynamic(() => import("./MapStage"), {
  ssr: false,
  loading: () => <div className="map-fallback">Loading map…</div>,
});

type Props = {
  spec: AbiMap;
  markers: Marker[];
};

function initialChoice(options: string[], requested: string | null, fallback: string): string {
  if (requested && (requested === "all" || options.includes(requested))) return requested;
  return fallback;
}

const QUICK_FILTERS: { id: QuickFilter; label: string; hint: string }[] = [
  { id: "spawn", label: "Spawn only", hint: "Player spawns" },
  { id: "red", label: "Red items only", hint: "Red item spawns" },
  { id: "keys", label: "Keys", hint: "Locked areas only" },
  { id: "exits", label: "Exits", hint: "Extracts on Forbidden" },
];

function parseQuick(value: string | null): QuickFilter | null {
  return QUICK_FILTERS.some((item) => item.id === value) ? (value as QuickFilter) : null;
}

export default function MapExplorer({ spec, markers }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const groups = useMemo(() => {
    const table: Record<string, string> = {};
    for (const [name, meta] of Object.entries(CATEGORIES)) table[name] = meta.group;
    return table;
  }, []);

  const [quick, setQuick] = useState<QuickFilter | null>(() => parseQuick(params.get("qs")));
  const [difficulty, setDifficulty] = useState(() => {
    const requested = params.get("d");
    if (!requested && parseQuick(params.get("qs")) === "exits" && spec.difficulties.includes("Forbidden")) {
      return "Forbidden";
    }
    return initialChoice(spec.difficulties, requested, spec.defaultDifficulty);
  });
  const [floor, setFloor] = useState(() => initialChoice([...spec.levels, "all"], params.get("floor"), spec.defaultLevel));
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => defaultEnabled(markers, groups, "essentials"));
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("m"));
  const [focusToken, setFocusToken] = useState(() => (params.get("m") ? 1 : 0));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [profitOpen, setProfitOpen] = useState(false);
  const [routes, setRoutes] = useState<ProfitRoute[]>([]);
  const [activeRoute, setActiveRoute] = useState<string | null>(null);
  const [routeFit, setRouteFit] = useState(0);

  const rules = useMemo(
    () => ({
      hideUnassigned: spec.hideUnassigned,
      includeUnassigned: spec.includeUnassigned,
      difficultyInheritance: spec.difficultyInheritance,
    }),
    [spec],
  );

  const state = useMemo(
    () => ({ floor, difficulty, enabled, query, quick }),
    [floor, difficulty, enabled, query, quick],
  );

  const visible = useMemo(() => {
    const list = markers.filter((marker) => isVisible(marker, rules, state));
    if (!selectedId || list.some((marker) => String(marker.id) === selectedId)) return list;
    const pinned = markers.find((marker) => String(marker.id) === selectedId);
    return pinned ? [...list, pinned] : list;
  }, [markers, rules, state, selectedId]);

  const layers: LayerRow[] = useMemo(() => {
    const counts = new Map<string, { count: number; sample: Marker }>();
    const countState = { ...state, enabled: {} as Record<string, boolean> };
    for (const marker of markers) {
      if (!isVisible(marker, rules, { ...countState, enabled: { [layerKey(marker)]: true } })) continue;
      const key = layerKey(marker);
      const current = counts.get(key);
      if (current) current.count += 1;
      else counts.set(key, { count: 1, sample: marker });
    }
    return [...counts.entries()]
      .map(([key, value]) => {
        if (key.startsWith("path:")) {
          return {
            key,
            label: key.slice(5),
            group: "Paths",
            icon: value.sample.icon || "/icons/path.webp",
            info: "",
            count: value.count,
          };
        }
        const meta = categoryMeta(key);
        return { key, label: key, group: meta.group, icon: meta.icon, info: meta.info, count: value.count };
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [markers, rules, state]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return markers
      .filter((marker) => isVisible(marker, rules, { ...state, floor: "all" }))
      .filter((marker) => marker.type !== "label" && primaryCoordinate(marker))
      .slice(0, 40)
      .map((marker) => ({
        id: String(marker.id),
        title: marker.title || marker.category,
        category: marker.category === "__path__" ? marker.subcategory || "Path" : marker.category,
        level: marker.level,
      }));
  }, [markers, query, rules, state]);

  const selected = markers.find((marker) => String(marker.id) === selectedId) ?? null;

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("d", difficulty);
    url.searchParams.set("floor", floor);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    if (quick) url.searchParams.set("qs", quick);
    else url.searchParams.delete("qs");
    if (selectedId) url.searchParams.set("m", selectedId);
    else url.searchParams.delete("m");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [difficulty, floor, query, quick, selectedId]);

  useEffect(() => {
    setRoutes([]);
    setActiveRoute(null);
    setRouteFit((token) => token + 1);
  }, [spec.slug, floor, difficulty]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".search input")?.focus();
      }
      if (event.key === "Escape") {
        setSelectedId(null);
        setFiltersOpen(false);
        setProfitOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pick(id: string) {
    const marker = markers.find((item) => String(item.id) === id);
    if (marker?.level && floor !== "all" && marker.level !== floor && !marker.showOnAllFloors) {
      setFloor(marker.level);
    }
    setSelectedId(id);
    setFocusToken((token) => token + 1);
    setFiltersOpen(false);
  }

  function changeDifficulty(next: string) {
    setDifficulty(next);
    if (quick === "exits" && !isForbiddenTier(next, rules)) setQuick(null);
    if (next === "Distortion" || next === "Deep Distortion") {
      setEnabled((prev) => {
        const copy = { ...prev };
        for (const marker of markers) {
          const key = layerKey(marker);
          const group = groups[key] ?? "Other";
          if (group === "Distortion") copy[key] = true;
        }
        return copy;
      });
    }
  }

  function applyPreset(mode: LayerMode) {
    setEnabled(defaultEnabled(markers, groups, mode));
  }

  function toggleQuick(next: QuickFilter) {
    const turningOn = quick !== next;
    setQuick(turningOn ? next : null);
    if (turningOn && next === "exits" && spec.difficulties.includes("Forbidden")) {
      setDifficulty("Forbidden");
    }
  }

  function toggleGroup(group: string, on: boolean) {
    setEnabled((prev) => {
      const copy = { ...prev };
      for (const layer of layers) {
        if (layer.group === group) copy[layer.key] = on;
      }
      return copy;
    });
  }

  const floors = spec.levels;

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/abi" className="brand">Arenka</Link>
        <label className="map-jump">
          <span className="sr">Map</span>
          <select
            value={spec.slug}
            onChange={(event) => router.push(`/abi/${event.target.value}`)}
          >
            {MAPS.map((map) => (
              <option key={map.slug} value={map.slug}>{map.name}</option>
            ))}
          </select>
        </label>
        <div className="diffs" role="group" aria-label="Difficulty">
          {spec.difficulties.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === difficulty}
              onClick={() => changeDifficulty(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="quick-sep" aria-hidden="true">|</span>
        <div className="quick-sets" role="group" aria-label="Quick settings">
          {QUICK_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.hint}
              aria-pressed={quick === item.id}
              onClick={() => toggleQuick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="profit-toggle"
          aria-pressed={profitOpen}
          onClick={() => setProfitOpen((open) => !open)}
        >
          Profit
        </button>
        <p className="count">{visible.length} shown</p>
        <button type="button" className="filters-button" onClick={() => setFiltersOpen((open) => !open)}>
          {filtersOpen ? "Close" : "Layers"}
        </button>
      </header>
      <div className="workspace">
        <Sidebar
          open={filtersOpen}
          query={query}
          onQuery={setQuery}
          layers={layers}
          enabled={enabled}
          onToggle={(key) => setEnabled((prev) => ({ ...prev, [key]: prev[key] === false }))}
          onToggleGroup={toggleGroup}
          onPreset={applyPreset}
          results={results}
          onPick={pick}
        />
        <div className="map-wrap">
          <MapStage
            spec={spec}
            markers={visible}
            layoutMarkers={markers}
            floor={floor}
            selectedId={selectedId}
            focusToken={focusToken}
            onSelect={setSelectedId}
            onTilesFailed={() => setTilesFailed(true)}
            routes={routes}
            activeRouteId={activeRoute}
            routeFit={routeFit}
            onRoute={setActiveRoute}
          />
          {profitOpen ? (
            <ProfitPanel
              markers={markers}
              rules={rules}
              floor={floor}
              difficulty={difficulty}
              routes={routes}
              activeId={activeRoute}
              onGenerate={(next) => {
                setRoutes(next);
                setActiveRoute(next[0]?.id ?? null);
                if (next.length) setRouteFit((token) => token + 1);
              }}
              onClear={() => {
                setRoutes([]);
                setActiveRoute(null);
                setRouteFit((token) => token + 1);
              }}
              onActive={(id) => {
                setActiveRoute(id);
                setRouteFit((token) => token + 1);
              }}
            />
          ) : null}
          <div className="floors" role="group" aria-label="Floor">
            <button type="button" aria-pressed={floor === "all"} onClick={() => setFloor("all")}>All</button>
            {floors.map((level) => (
              <button key={level} type="button" aria-pressed={floor === level} onClick={() => setFloor(level)}>
                <strong>{floorLabel(level)}</strong>
                <small>{level}</small>
              </button>
            ))}
          </div>
          {tilesFailed ? (
            <p className="tile-error" role="status">Map images did not load. Check the connection and refresh.</p>
          ) : null}
          {selected ? <Detail marker={selected} onClose={() => setSelectedId(null)} /> : null}
          <p className="tile-credit">Tiles: maps.tcno.co</p>
        </div>
      </div>
    </div>
  );
}

function Detail({ marker, onClose }: { marker: Marker; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const meta = marker.category === "__path__" ? marker.subcategory || "Path" : marker.category;
  const clip = marker.youtube || marker.video;
  const loot = marker.loot ? Object.entries(marker.loot) : [];

  async function copyLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("m", String(marker.id));
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
  }

  return (
    <article className="detail">
      <header>
        <p>{meta}{marker.level ? ` · ${floorLabel(marker.level)}` : ""}{marker.difficulty ? ` · ${marker.difficulty}` : ""}</p>
        <button type="button" onClick={onClose} aria-label="Close details">×</button>
      </header>
      <h2>{marker.title || meta}</h2>
      {marker.info ? <p className="detail-info">{marker.info}</p> : null}
      {loot.length ? (
        <ul className="loot">
          {loot.map(([name, count]) => (
            <li key={name}>{name}{count > 1 ? ` ×${count}` : ""}</li>
          ))}
        </ul>
      ) : null}
      {marker.images?.length ? (
        <div className="shots">
          {marker.images.slice(0, 3).map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer">
              <img src={src} alt="" />
            </a>
          ))}
        </div>
      ) : null}
      <footer>
        {clip ? (
          <a href={clip} target="_blank" rel="noreferrer">Open clip</a>
        ) : null}
        <button type="button" onClick={() => void copyLink()}>{copied ? "Copied" : "Copy link"}</button>
      </footer>
    </article>
  );
}
