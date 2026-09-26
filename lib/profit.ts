import { matchesDifficulty, matchesFloor, primaryCoordinate } from "./filter.ts";
import type { MapRules, Marker } from "./types.ts";

export type ProfitTarget = "red" | "safe" | "safe-red";
export type ProfitKeyMode = "all" | "none" | "custom";

export type ProfitStop = {
  id: string;
  title: string;
  category: string;
  point: [number, number];
};

export type ProfitRoute = {
  id: string;
  label: string;
  color: string;
  floor: string;
  points: [number, number][];
  stops: ProfitStop[];
  spawnTitle: string;
  extractTitle: string;
};

export type ProfitRequest = {
  markers: Marker[];
  rules: MapRules;
  floor: string;
  difficulty: string;
  target: ProfitTarget;
  keys: ProfitKeyMode;
  customKeyIds: string[];
  count?: number;
};

export const PROFIT_COLORS = ["#ffd24a", "#4ad2ff", "#ff6ad5"];

const SAFES = new Set([
  "Safe",
  "Safe (Behind Key)",
  "Secret Safe",
  "Retro Safe",
  "Electronic Safe",
  "Small Safe",
]);

const EXTRACTS = new Set([
  "Extract",
  "Covert Ops Extract",
  "No Backpack Extract",
  "Mission Extract",
  "Phone Booth",
]);

const STOP_CAP = 8;
const POOL_CAP = 14;
const CLUSTER_GAP = 420;
const KEY_LINK = 900;

type Scored = { marker: Marker; point: [number, number]; value: number };

function pointOf(marker: Marker): [number, number] | null {
  return primaryCoordinate(marker);
}

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function isSafe(marker: Marker): boolean {
  return SAFES.has(marker.category);
}

function isLockedSafe(marker: Marker): boolean {
  return marker.category === "Safe (Behind Key)";
}

function isRoomKey(marker: Marker): boolean {
  return marker.category === "Key";
}

function valueOf(marker: Marker): number {
  if (isLockedSafe(marker)) return 8;
  if (isSafe(marker)) return 6;
  if (marker.category === "Red Item Spawn") return 4;
  if (isRoomKey(marker)) return 2;
  return 1;
}

function onMap(marker: Marker, rules: MapRules, floor: string, difficulty: string): boolean {
  return matchesFloor(marker, floor) && matchesDifficulty(marker, rules, difficulty);
}

function targetLabel(target: ProfitTarget): string {
  if (target === "red") return "Red items";
  if (target === "safe") return "Safes";
  return "Safes + red";
}

function keyLabel(keys: ProfitKeyMode): string {
  if (keys === "all") return "with keys";
  if (keys === "custom") return "custom keys";
  return "no keys";
}

function wantsRed(target: ProfitTarget): boolean {
  return target === "red" || target === "safe-red";
}

function wantsSafe(target: ProfitTarget): boolean {
  return target === "safe" || target === "safe-red";
}

function busiestFloor(markers: Marker[], requested: string): string {
  if (requested !== "all") return requested;
  const totals = new Map<string, number>();
  for (const marker of markers) {
    const level = marker.level || "";
    totals.set(level, (totals.get(level) ?? 0) + valueOf(marker));
  }
  let best = requested;
  let bestValue = -1;
  for (const [level, value] of totals) {
    if (value > bestValue) {
      best = level;
      bestValue = value;
    }
  }
  return best;
}

function cluster(items: Scored[]): Scored[] {
  const sorted = [...items].sort((a, b) => b.value - a.value || String(a.marker.id).localeCompare(String(b.marker.id)));
  const kept: Scored[] = [];
  for (const item of sorted) {
    if (kept.some((other) => distance(other.point, item.point) < CLUSTER_GAP)) continue;
    kept.push(item);
    if (kept.length >= POOL_CAP) break;
  }
  return kept;
}

function orderStops(start: [number, number], pool: Scored[], end: [number, number] | null, cap: number): Scored[] {
  const left = [...pool];
  const ordered: Scored[] = [];
  let cursor = start;
  while (left.length && ordered.length < cap) {
    let bestIndex = 0;
    let bestScore = Infinity;
    const progress = ordered.length / cap;
    for (let index = 0; index < left.length; index += 1) {
      const item = left[index];
      let score = distance(cursor, item.point) - item.value * 90;
      if (end) score += distance(item.point, end) * progress * 0.7;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    const next = left.splice(bestIndex, 1)[0];
    ordered.push(next);
    cursor = next.point;
  }
  return ordered;
}

function pathLength(points: [number, number][]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += distance(points[index - 1], points[index]);
  return total;
}

function asStop(item: Scored): ProfitStop {
  return {
    id: String(item.marker.id),
    title: item.marker.title || item.marker.category,
    category: item.marker.category,
    point: item.point,
  };
}

function buildOne(
  pool: Scored[],
  spawns: Scored[],
  extracts: Scored[],
  floor: string,
  target: ProfitTarget,
  keys: ProfitKeyMode,
  color: string,
  index: number,
): { route: ProfitRoute; usedStops: string[]; usedSpawn: string | null } | null {
  if (!pool.length) return null;
  let best: { score: number; spawn: Scored | null; extract: Scored | null; ordered: Scored[] } | null = null;
  const spawnChoices = spawns.length ? spawns : [null];
  const extractChoices = extracts.length ? extracts : [null];

  for (const spawn of spawnChoices) {
    for (const extract of extractChoices) {
      const start = spawn?.point ?? pool[0].point;
      const source = spawn ? pool : pool.slice(1);
      const orderedCore = orderStops(start, source, extract?.point ?? null, spawn ? STOP_CAP : STOP_CAP - 1);
      const ordered = spawn ? orderedCore : [pool[0], ...orderedCore];
      if (!ordered.length) continue;
      const line = [
        ...(spawn ? [spawn.point] : []),
        ...ordered.map((item) => item.point),
        ...(extract ? [extract.point] : []),
      ];
      const length = pathLength(line);
      const value = ordered.reduce((sum, item) => sum + item.value, 0);
      const score = length / Math.max(1, value);
      if (!best || score < best.score) best = { score, spawn, extract, ordered };
    }
  }

  if (!best) return null;
  const points = [
    ...(best.spawn ? [best.spawn.point] : []),
    ...best.ordered.map((item) => item.point),
    ...(best.extract ? [best.extract.point] : []),
  ];
  if (points.length < 2) return null;
  const route: ProfitRoute = {
    id: `profit-${index}-${best.spawn ? best.spawn.marker.id : best.ordered[0].marker.id}`,
    label: `${targetLabel(target)} · ${keyLabel(keys)}`,
    color,
    floor,
    points,
    stops: best.ordered.map(asStop),
    spawnTitle: best.spawn ? best.spawn.marker.title || "Spawn" : "",
    extractTitle: best.extract ? best.extract.marker.title || "Extract" : "",
  };
  return {
    route,
    usedStops: best.ordered.map((item) => String(item.marker.id)),
    usedSpawn: best.spawn ? String(best.spawn.marker.id) : null,
  };
}

export function listProfitKeys(markers: Marker[], rules: MapRules, difficulty: string): { id: string; title: string; level?: string }[] {
  return markers
    .filter((marker) => isRoomKey(marker) && matchesDifficulty(marker, rules, difficulty) && pointOf(marker))
    .map((marker) => ({
      id: String(marker.id),
      title: marker.title || "Key",
      level: marker.level,
    }))
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

export function generateProfitRoutes(request: ProfitRequest): ProfitRoute[] {
  const selected = new Set(request.customKeyIds);
  const rough = request.markers.filter((marker) => {
    if (!pointOf(marker)) return false;
    if (request.floor !== "all" && !matchesFloor(marker, request.floor)) return false;
    return matchesDifficulty(marker, request.rules, request.difficulty);
  });

  const interest = rough.filter((marker) => {
    if (wantsRed(request.target) && marker.category === "Red Item Spawn") return true;
    if (wantsSafe(request.target) && isSafe(marker) && !isLockedSafe(marker)) return true;
    if (isLockedSafe(marker) || isRoomKey(marker)) return request.keys !== "none";
    return false;
  });
  const floor = busiestFloor(interest, request.floor);

  const keys = rough.filter((marker) => isRoomKey(marker) && onMap(marker, request.rules, floor, request.difficulty));
  const allowedKeys = request.keys === "all"
    ? keys
    : request.keys === "custom"
      ? keys.filter((marker) => selected.has(String(marker.id)))
      : [];

  const lockedSafes = rough.filter((marker) => {
    if (!isLockedSafe(marker) || !onMap(marker, request.rules, floor, request.difficulty)) return false;
    if (request.keys === "none") return false;
    if (request.keys === "all") return true;
    const spot = pointOf(marker);
    if (!spot) return false;
    return allowedKeys.some((key) => {
      const keyPoint = pointOf(key);
      return keyPoint && (!key.level || !marker.level || key.level === marker.level) && distance(spot, keyPoint) <= KEY_LINK;
    });
  });

  const openSafes = wantsSafe(request.target)
    ? rough.filter((marker) => isSafe(marker) && !isLockedSafe(marker) && onMap(marker, request.rules, floor, request.difficulty))
    : [];
  const reds = wantsRed(request.target)
    ? rough.filter((marker) => marker.category === "Red Item Spawn" && onMap(marker, request.rules, floor, request.difficulty))
    : [];

  const loneKeys = allowedKeys.filter((key) => {
    const keyPoint = pointOf(key);
    if (!keyPoint) return false;
    return !lockedSafes.some((safe) => {
      const spot = pointOf(safe);
      return spot && (!safe.level || !key.level || safe.level === key.level) && distance(spot, keyPoint) <= KEY_LINK;
    });
  });

  const scored = [...openSafes, ...reds, ...lockedSafes, ...loneKeys]
    .map((marker) => {
      const point = pointOf(marker);
      return point ? { marker, point, value: valueOf(marker) } : null;
    })
    .filter((item): item is Scored => item !== null);

  let pool = cluster(scored);
  let spawns = rough
    .filter((marker) => marker.category === "Spawn" && onMap(marker, request.rules, floor, request.difficulty))
    .map((marker) => {
      const point = pointOf(marker);
      return point ? { marker, point, value: 0 } : null;
    })
    .filter((item): item is Scored => item !== null);
  const extracts = rough
    .filter((marker) => EXTRACTS.has(marker.category) && onMap(marker, request.rules, floor, request.difficulty))
    .map((marker) => {
      const point = pointOf(marker);
      return point ? { marker, point, value: 0 } : null;
    })
    .filter((item): item is Scored => item !== null);

  const routes: ProfitRoute[] = [];
  const count = request.count ?? 3;
  for (let index = 0; index < count && pool.length; index += 1) {
    const built = buildOne(pool, spawns, extracts, floor, request.target, request.keys, PROFIT_COLORS[index % PROFIT_COLORS.length], index);
    if (!built) break;
    routes.push(built.route);
    const used = new Set(built.usedStops);
    pool = pool.filter((item) => !used.has(String(item.marker.id)));
    if (built.usedSpawn) spawns = spawns.filter((item) => String(item.marker.id) !== built.usedSpawn);
    if (pool.length < 3) break;
  }
  return routes;
}
