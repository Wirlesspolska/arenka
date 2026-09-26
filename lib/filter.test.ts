import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultEnabled, isForbiddenTier, isVisible, layerKey, matchesDifficulty, matchesFloor, matchesQuick } from "./filter.ts";
import type { MapRules, Marker } from "./types.ts";

const rules: MapRules = {
  hideUnassigned: ["Endless"],
  includeUnassigned: { Endless: ["Key"] },
  difficultyInheritance: { Distortion: "Lockdown", "Deep Distortion": "Forbidden" },
};

function point(partial: Partial<Marker>): Marker {
  return {
    id: partial.id ?? 1,
    type: partial.type ?? "point",
    category: partial.category ?? "Key",
    coordinates: partial.coordinates ?? [1, 2],
    ...partial,
  };
}

describe("difficulty", () => {
  it("shows untagged markers on a normal difficulty", () => {
    assert.equal(matchesDifficulty(point({ difficulty: undefined }), rules, "Normal"), true);
  });

  it("hides a Normal marker on Lockdown", () => {
    assert.equal(matchesDifficulty(point({ difficulty: "Normal" }), rules, "Lockdown"), false);
  });

  it("inherits Lockdown markers into Distortion", () => {
    assert.equal(matchesDifficulty(point({ difficulty: "Lockdown" }), rules, "Distortion"), true);
    assert.equal(matchesDifficulty(point({ difficulty: "Distortion" }), rules, "Lockdown"), false);
  });

  it("hides unassigned markers on Endless except keys", () => {
    assert.equal(matchesDifficulty(point({ category: "Safe", difficulty: undefined }), rules, "Endless"), false);
    assert.equal(matchesDifficulty(point({ category: "Key", difficulty: undefined }), rules, "Endless"), true);
  });
});

describe("floors and layers", () => {
  it("keeps floor-specific markers on their level and shared markers everywhere", () => {
    assert.equal(matchesFloor(point({ level: "2F" }), "1F"), false);
    assert.equal(matchesFloor(point({ level: "2F", showOnAllFloors: true }), "1F"), true);
    assert.equal(matchesFloor(point({ level: undefined }), "B1"), true);
    assert.equal(matchesFloor(point({ level: "2F" }), "all"), true);
  });

  it("uses the path subcategory as the layer key", () => {
    const path = point({
      type: "cpoint",
      category: "__path__",
      subcategory: "Profit run",
      coordinates: [[1, 2], [3, 4]],
    });
    assert.equal(layerKey(path), "path:Profit run");
  });

  it("hides a layer that is switched off", () => {
    const marker = point({ title: "Barn Office Key", category: "Key" });
    const state = {
      floor: "all",
      difficulty: "Normal",
      enabled: { Key: false },
      query: "",
    };
    assert.equal(isVisible(marker, rules, state), false);
    assert.equal(isVisible(marker, rules, { ...state, enabled: { Key: true }, query: "barn" }), true);
    assert.equal(isVisible(marker, rules, { ...state, enabled: { Key: true }, query: "motel" }), false);
  });
});

describe("quick filters", () => {
  it("keeps player spawns, red spawns, locked-room keys, and extracts apart", () => {
    assert.equal(matchesQuick(point({ category: "Spawn" }), "spawn"), true);
    assert.equal(matchesQuick(point({ category: "Boss Spawn" }), "spawn"), false);
    assert.equal(matchesQuick(point({ category: "Red Item Spawn" }), "red"), true);
    assert.equal(matchesQuick(point({ category: "Gold Item Spawn" }), "red"), false);
    assert.equal(matchesQuick(point({ category: "Key" }), "keys"), true);
    assert.equal(matchesQuick(point({ category: "Key Spawn" }), "keys"), false);
    assert.equal(matchesQuick(point({ category: "Extract" }), "exits"), true);
    assert.equal(matchesQuick(point({ category: "Covert Ops Extract" }), "exits"), true);
    assert.equal(matchesQuick(point({ category: "Phone Booth" }), "exits"), false);
  });

  it("treats Deep Distortion as a Forbidden tier", () => {
    assert.equal(isForbiddenTier("Forbidden", rules), true);
    assert.equal(isForbiddenTier("Deep Distortion", rules), true);
    assert.equal(isForbiddenTier("Lockdown", rules), false);
  });

  it("shows only the quick set and ignores a switched-off layer", () => {
    const spawn = point({ id: 4, category: "Spawn" });
    const key = point({ id: 5, category: "Key" });
    const state = {
      floor: "all",
      difficulty: "Normal",
      enabled: { Spawn: false, Key: true },
      query: "",
      quick: "spawn" as const,
    };
    assert.equal(isVisible(spawn, rules, state), true);
    assert.equal(isVisible(key, rules, state), false);
  });
});

describe("presets", () => {
  it("turns loot off in essentials and on in the loot preset", () => {
    const markers = [
      point({ id: 1, category: "Key" }),
      point({ id: 2, category: "Gym Bags" }),
      point({ id: 3, category: "__path__", subcategory: "REDs", type: "cpoint", coordinates: [[0, 0]] }),
    ];
    const groups = { Key: "Locations", "Gym Bags": "Loot" };
    const essentials = defaultEnabled(markers, groups, "essentials");
    assert.equal(essentials.Key, true);
    assert.equal(essentials["Gym Bags"], false);
    assert.equal(essentials["path:REDs"], false);
    const loot = defaultEnabled(markers, groups, "loot");
    assert.equal(loot.Key, false);
    assert.equal(loot["Gym Bags"], true);
  });
});
