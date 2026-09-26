import type { FilterState, MapRules, Marker, QuickFilter } from "./types.ts";

export function layerKey(marker: Marker): string {
  if (marker.category === "__path__") {
    return `path:${marker.subcategory || marker.title || "Path"}`;
  }
  return marker.category;
}

export function isPath(marker: Marker): boolean {
  return marker.type === "cpoint" || Array.isArray(marker.coordinates?.[0]);
}

export function primaryCoordinate(marker: Marker): [number, number] | null {
  const coords = marker.coordinates;
  if (!Array.isArray(coords) || coords.length < 1) return null;
  if (typeof coords[0] === "number") {
    const pair = coords as number[];
    if (typeof pair[1] !== "number") return null;
    return [pair[0], pair[1]];
  }
  const first = coords[0] as number[];
  if (!Array.isArray(first) || first.length < 2) return null;
  return [first[0], first[1]];
}

export function pathCoordinates(marker: Marker): [number, number][] {
  if (!Array.isArray(marker.coordinates?.[0])) return [];
  return (marker.coordinates as number[][])
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map((pair) => [pair[0], pair[1]]);
}

export function matchesQuery(marker: Marker, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [marker.title, marker.category, marker.subcategory, marker.info, marker.level, marker.difficulty]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function matchesDifficulty(marker: Marker, rules: MapRules, difficulty: string): boolean {
  const tag = marker.difficulty;
  const parent = rules.difficultyInheritance[difficulty];
  if (!tag) {
    if (!rules.hideUnassigned.includes(difficulty)) return true;
    return (rules.includeUnassigned[difficulty] ?? []).includes(marker.category);
  }
  if (tag === difficulty) return true;
  return Boolean(parent && tag === parent);
}

export function matchesFloor(marker: Marker, floor: string): boolean {
  if (floor === "all" || marker.showOnAllFloors || !marker.level) return true;
  return marker.level === floor;
}

const ESSENTIAL_GROUPS = new Set([
  "Locations",
  "Extracts",
  "Safes",
  "Interactions",
  "Paths",
  "Other",
]);

const ESSENTIAL_EXTRA = new Set(["Gold Item Spawn", "Red Item Spawn"]);

export type LayerMode = "essentials" | "all" | "loot";

const LOCKED_KEY = "Key";
const EXTRACTS = new Set(["Extract", "Covert Ops Extract", "No Backpack Extract", "Mission Extract"]);

export function isForbiddenTier(difficulty: string, rules: MapRules): boolean {
  if (difficulty === "Forbidden") return true;
  return rules.difficultyInheritance[difficulty] === "Forbidden";
}

/** Spawn is the player circle. Keys are locked rooms, not key-item drops. Exits are extract points. */
export function matchesQuick(marker: Marker, quick: QuickFilter): boolean {
  if (quick === "spawn") return marker.category === "Spawn";
  if (quick === "red") return marker.category === "Red Item Spawn";
  if (quick === "keys") return marker.category === LOCKED_KEY;
  return EXTRACTS.has(marker.category);
}

export function isEssentialLayer(key: string, group: string): boolean {
  // Stored paths stay in the layer list and start off. Generated profit runs are drawn on demand.
  if (key.startsWith("path:")) return false;
  if (ESSENTIAL_EXTRA.has(key)) return true;
  return ESSENTIAL_GROUPS.has(group);
}

export function defaultEnabled(
  markers: Marker[],
  groups: Record<string, string>,
  mode: LayerMode,
): Record<string, boolean> {
  const enabled: Record<string, boolean> = {};
  for (const marker of markers) {
    const key = layerKey(marker);
    if (key in enabled) continue;
    const group = key.startsWith("path:") ? "Paths" : groups[key] ?? "Other";
    if (mode === "all") enabled[key] = true;
    else if (mode === "loot") enabled[key] = group === "Loot";
    else enabled[key] = isEssentialLayer(key, group);
  }
  return enabled;
}

export function isVisible(marker: Marker, rules: MapRules, state: FilterState): boolean {
  if (state.quick) {
    if (!matchesQuick(marker, state.quick)) return false;
  } else if (state.enabled[layerKey(marker)] === false) {
    return false;
  }
  if (!matchesFloor(marker, state.floor)) return false;
  if (!matchesDifficulty(marker, rules, state.difficulty)) return false;
  if (!matchesQuery(marker, state.query)) return false;
  return true;
}
