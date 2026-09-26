import airport from "@/data/markers/airport.json";
import armory from "@/data/markers/armory.json";
import farm from "@/data/markers/farm.json";
import northridge from "@/data/markers/northridge.json";
import tvStation from "@/data/markers/tv-station.json";
import valley from "@/data/markers/valley.json";
import type { Marker } from "./types";

const ALL: Record<string, Marker[]> = {
  farm: farm as Marker[],
  airport: airport as Marker[],
  armory: armory as Marker[],
  northridge: northridge as Marker[],
  "tv-station": tvStation as Marker[],
  valley: valley as Marker[],
};

export function getMarkers(slug: string): Marker[] {
  return ALL[slug] ?? [];
}

export function markerCount(slug: string): number {
  return getMarkers(slug).length;
}
