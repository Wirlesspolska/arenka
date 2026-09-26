import raw from "@/data/categories.json";
import type { CategoryMeta } from "./types";

const extras: Record<string, CategoryMeta> = {
  Ladders: {
    group: "Interactions",
    icon: "/icons/arc/ladder.webp",
    info: "Use this to travel between levels.",
  },
  "First-Aid Cases": {
    group: "Loot",
    icon: "/icons/medkit.svg",
    info: "",
  },
};

export const CATEGORIES: Record<string, CategoryMeta> = {
  ...(raw as Record<string, CategoryMeta>),
  ...extras,
};

export const GROUP_ORDER = [
  "Locations",
  "Extracts",
  "Safes",
  "Interactions",
  "Paths",
  "Other",
  "Loot",
  "Distortion",
];

export function categoryMeta(name: string): CategoryMeta {
  return (
    CATEGORIES[name] ?? {
      group: "Other",
      icon: "/icons/default.svg",
      info: "",
    }
  );
}
