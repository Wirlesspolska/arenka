export type MarkerType = "point" | "label" | "circle" | "cpoint" | string;

export type Marker = {
  id: number | string;
  type: MarkerType;
  category: string;
  subcategory?: string;
  coordinates: number[] | number[][];
  level?: string;
  title?: string;
  zooms?: number[];
  info?: string;
  icon?: string;
  loot?: Record<string, number>;
  youtube?: string;
  video?: string;
  difficulty?: string;
  color?: string;
  radius?: number;
  outline?: string;
  showOnAllFloors?: boolean;
  images?: string[];
  lineColor?: string;
  directional?: boolean;
  alwaysConnected?: boolean;
};

export type Overlay = {
  floor: string;
  bounds: [[number, number], [number, number]];
  url: string;
  /** True when the overlay is an XYZ tile template (`{level}` is the zoom). */
  tiled: boolean;
};

export type AbiMap = {
  slug: string;
  name: string;
  image: string;
  width: number;
  height: number;
  tileSize: number;
  minZoom: number;
  maxZoom: number;
  /** Zoom where one world unit is one pixel. Tiles may stop earlier. */
  pixelZoom: number;
  /** World-pixel origin of tile (0, 0). Negative values pad the image. */
  tileOffset: [number, number];
  tileOffsetScale: [number, number];
  /** Base satellite/plan tiles. `{level}` is the zoom index, not the floor. */
  tileUrl?: string;
  levels: string[];
  defaultLevel: string;
  difficulties: string[];
  defaultDifficulty: string;
  hideUnassigned: string[];
  includeUnassigned: Record<string, string[]>;
  difficultyInheritance: Record<string, string>;
  radiusMultiplier: number;
  zoomToMarker: number;
  overlays: Overlay[];
};

export type CategoryMeta = {
  group: string;
  icon: string;
  info: string;
};

export type QuickFilter = "spawn" | "red" | "keys" | "exits";

export type FilterState = {
  floor: string;
  difficulty: string;
  enabled: Record<string, boolean>;
  query: string;
  /** Exclusive overlay. When set, layer checkboxes are ignored. */
  quick?: QuickFilter | null;
};

export type MapRules = {
  hideUnassigned: string[];
  includeUnassigned: Record<string, string[]>;
  difficultyInheritance: Record<string, string>;
};
