import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateProfitRoutes, listProfitKeys } from "./profit.ts";
import type { MapRules, Marker } from "./types.ts";

const rules: MapRules = {
  hideUnassigned: [],
  includeUnassigned: {},
  difficultyInheritance: { "Deep Distortion": "Forbidden" },
};

function point(partial: Partial<Marker> & Pick<Marker, "id" | "category" | "coordinates">): Marker {
  return {
    type: "point",
    ...partial,
  };
}

const map: Marker[] = [
  point({ id: "s1", category: "Spawn", coordinates: [0, 0], title: "West spawn", level: "1F" }),
  point({ id: "s2", category: "Spawn", coordinates: [4000, 0], title: "East spawn", level: "1F" }),
  point({ id: "e1", category: "Extract", coordinates: [1800, 200], title: "Main extract", level: "1F" }),
  point({ id: "safe", category: "Small Safe", coordinates: [500, 40], title: "Motel safe", level: "1F" }),
  point({ id: "locked", category: "Safe (Behind Key)", coordinates: [900, 40], title: "Barn safe", level: "1F" }),
  point({ id: "key", category: "Key", coordinates: [860, 80], title: "Barn key", level: "1F" }),
  point({ id: "other-key", category: "Key", coordinates: [3000, 80], title: "Villa key", level: "1F" }),
  point({ id: "red", category: "Red Item Spawn", coordinates: [1400, 30], title: "Lion", level: "1F" }),
  point({ id: "red-far", category: "Red Item Spawn", coordinates: [3200, 40], title: "Teapot", level: "1F" }),
  point({ id: "red-forbid", category: "Red Item Spawn", coordinates: [1500, 80], title: "Forbidden lion", level: "1F", difficulty: "Forbidden" }),
  point({ id: "upstairs", category: "Small Safe", coordinates: [500, 40], title: "Upstairs safe", level: "2F" }),
];

const base = {
  markers: map,
  rules,
  floor: "1F",
  difficulty: "Normal",
  customKeyIds: [] as string[],
};

describe("profit routes", () => {
  it("skips locked rooms when keys are off", () => {
    const routes = generateProfitRoutes({ ...base, target: "safe-red", keys: "none" });
    const titles = routes.flatMap((route) => route.stops.map((stop) => stop.title));
    assert.ok(titles.includes("Motel safe"));
    assert.ok(titles.includes("Lion"));
    assert.equal(titles.includes("Barn safe"), false);
    assert.equal(titles.includes("Barn key"), false);
    assert.equal(titles.includes("Forbidden lion"), false);
    assert.equal(titles.includes("Upstairs safe"), false);
    assert.equal(routes[0].points[0][0], 0);
    assert.equal(routes[0].extractTitle, "Main extract");
  });

  it("includes a locked safe when running with keys", () => {
    const routes = generateProfitRoutes({ ...base, target: "safe", keys: "all" });
    const titles = routes.flatMap((route) => route.stops.map((stop) => stop.title));
    assert.ok(titles.includes("Barn safe"));
    assert.equal(titles.includes("Lion"), false);
  });

  it("uses only the custom key the player inserted", () => {
    const routes = generateProfitRoutes({
      ...base,
      target: "safe",
      keys: "custom",
      customKeyIds: ["key"],
    });
    const titles = routes.flatMap((route) => route.stops.map((stop) => stop.title));
    assert.ok(titles.includes("Barn safe"));
    assert.equal(titles.includes("Villa key"), false);
  });

  it("paints a second route with different stops and a different color", () => {
    const reds = Array.from({ length: 12 }, (_, index) =>
      point({
        id: `r${index}`,
        category: "Red Item Spawn",
        coordinates: [400 + index * 500, 20],
        title: `Red ${index}`,
        level: "1F",
      }),
    );
    const routes = generateProfitRoutes({
      ...base,
      markers: [...map, ...reds],
      target: "red",
      keys: "none",
      count: 3,
    });
    assert.ok(routes.length >= 2);
    assert.notEqual(routes[0].color, routes[1].color);
    const first = new Set(routes[0].stops.map((stop) => stop.id));
    assert.equal(routes[1].stops.some((stop) => first.has(stop.id)), false);
  });

  it("lists room keys for the custom picker", () => {
    const keys = listProfitKeys(map, rules, "Normal");
    assert.deepEqual(keys.map((key) => key.title), ["Barn key", "Villa key"]);
  });
});
