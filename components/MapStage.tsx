"use client";

import { asset } from "@/lib/asset";
import { categoryMeta } from "@/lib/categories";
import { isPath, pathCoordinates, primaryCoordinate } from "@/lib/filter";
import type { AbiMap, Marker } from "@/lib/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

type Props = {
  spec: AbiMap;
  markers: Marker[];
  layoutMarkers: Marker[];
  floor: string;
  selectedId: string | null;
  focusToken: number;
  onSelect: (id: string | null) => void;
  onTilesFailed: () => void;
  routes: { id: string; color: string; points: [number, number][] }[];
  activeRouteId: string | null;
  routeFit: number;
  onRoute: (id: string) => void;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function worldBounds(spec: AbiMap): L.LatLngBounds {
  return L.latLngBounds(L.latLng(0, 0), L.latLng(spec.height, spec.width));
}

function makeCrs(spec: AbiMap): L.CRS {
  const [ox, oy] = spec.tileOffset;
  const [sx, sy] = spec.tileOffsetScale;
  return L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(sx, -ox, sy, -oy),
    scale(zoom: number) {
      return 2 ** (zoom - spec.pixelZoom);
    },
    zoom(scale: number) {
      return Math.log(scale) / Math.LN2 + spec.pixelZoom;
    },
    // Kept unbounded: Leaflet's Simple projection is clamped to lon/lat degrees,
    // which would hide every tile outside that tiny box.
    infinite: true,
  });
}

function makeTileLayer(template: string, spec: AbiMap): L.GridLayer {
  const Tiles = L.GridLayer.extend({
    createTile(coords: L.Coords) {
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      const url = template
        .replace("{level}", String(coords.z))
        .replace("{x}", String(coords.x))
        .replace("{y}", String(coords.y));
      img.src = asset(url);
      img.addEventListener("error", () => {
        img.style.visibility = "hidden";
      });
      return img;
    },
  }) as new (options?: L.GridLayerOptions) => L.GridLayer;
  return new Tiles({
    tileSize: spec.tileSize,
    minZoom: 0,
    maxZoom: spec.maxZoom,
    noWrap: true,
    bounds: worldBounds(spec),
  });
}

function contentBounds(spec: AbiMap, markers: Marker[]): L.LatLngBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const marker of markers) {
    const coords = marker.coordinates;
    const points = typeof coords?.[0] === "number" ? [coords as number[]] : (coords as number[][]);
    if (!Array.isArray(points)) continue;
    for (const point of points) {
      if (!Array.isArray(point) || point.length < 2) continue;
      minX = Math.min(minX, point[0]);
      minY = Math.min(minY, point[1]);
      maxX = Math.max(maxX, point[0]);
      maxY = Math.max(maxY, point[1]);
    }
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return worldBounds(spec);
  const padX = Math.max(120, (maxX - minX) * 0.06);
  const padY = Math.max(120, (maxY - minY) * 0.06);
  return L.latLngBounds(
    L.latLng(Math.max(0, minY - padY), Math.max(0, minX - padX)),
    L.latLng(Math.min(spec.height, maxY + padY), Math.min(spec.width, maxX + padX)),
  );
}

function pointsBounds(spec: AbiMap, points: [number, number][]): L.LatLngBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return worldBounds(spec);
  const padX = Math.max(120, (maxX - minX) * 0.06);
  const padY = Math.max(120, (maxY - minY) * 0.06);
  return L.latLngBounds(
    L.latLng(Math.max(0, minY - padY), Math.max(0, minX - padX)),
    L.latLng(Math.min(spec.height, maxY + padY), Math.min(spec.width, maxX + padX)),
  );
}
function overlayLatLngBounds(bounds: [[number, number], [number, number]]): L.LatLngBounds {
  const [[x1, y1], [x2, y2]] = bounds;
  return L.latLngBounds(L.latLng(y1, x1), L.latLng(y2, x2));
}

export default function MapStage({
  spec,
  markers,
  layoutMarkers,
  floor,
  selectedId,
  focusToken,
  onSelect,
  onTilesFailed,
  routes,
  activeRouteId,
  routeFit,
  onRoute,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const markerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const onRouteRef = useRef(onRoute);
  const markersRef = useRef(markers);
  const failedRef = useRef(onTilesFailed);
  const selectedRef = useRef(selectedId);
  const layoutRef = useRef(layoutMarkers);
  const routePointsRef = useRef<[number, number][]>([]);
  const fitRef = useRef<() => void>(() => {});
  onSelectRef.current = onSelect;
  onRouteRef.current = onRoute;
  markersRef.current = markers;
  failedRef.current = onTilesFailed;
  selectedRef.current = selectedId;
  layoutRef.current = layoutMarkers;
  routePointsRef.current = routes.flatMap((route) => route.points);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const crs = makeCrs(spec);
    const bounds = worldBounds(spec);
    const framed = () => {
      const routePoints = routePointsRef.current;
      if (routePoints.length >= 2) return pointsBounds(spec, routePoints);
      return contentBounds(spec, layoutRef.current);
    };
    const map = L.map(host, {
      crs,
      minZoom: spec.minZoom,
      maxZoom: spec.maxZoom,
      zoomSnap: 0,
      zoomDelta: 0.5,
      attributionControl: false,
      zoomControl: true,
      maxBounds: bounds.pad(0.2),
      maxBoundsViscosity: 0.85,
    });
    map.zoomControl.setPosition("topright");
    let fitFrame = 0;
    const fit = () => {
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(() => {
        map.invalidateSize();
        if (host.clientWidth < 2 || host.clientHeight < 2) return;
        map.fitBounds(framed(), { padding: [16, 16], animate: false });
      });
    };
    fit();
    fitRef.current = fit;
    map.on("click", () => onSelectRef.current(null));
    overlayRef.current = L.layerGroup().addTo(map);
    markerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const probeUrl = (spec.tileUrl ?? spec.overlays.find((item) => item.tiled)?.url ?? "")
      .replace("{level}", "4")
      .replace("{x}", "0")
      .replace("{y}", "0");
    if (probeUrl) {
      const probe = new Image();
      probe.onerror = () => failedRef.current();
      probe.src = asset(probeUrl);
    }

    window.addEventListener("resize", fit);
    const observer = new ResizeObserver(fit);
    observer.observe(host);

    return () => {
      cancelAnimationFrame(fitFrame);
      observer.disconnect();
      window.removeEventListener("resize", fit);
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      markerRef.current = null;
      routeLayerRef.current = null;
      fitRef.current = () => {};
    };
  }, [spec]);

  useEffect(() => {
    const group = overlayRef.current;
    if (!group) return;
    group.clearLayers();
    if (spec.tileUrl) group.addLayer(makeTileLayer(spec.tileUrl, spec));

    const activeFloors = floor === "all" ? spec.levels : [floor];
    const images = spec.overlays
      .filter((overlay) => !overlay.tiled && activeFloors.includes(overlay.floor))
      .sort((a, b) => Number(a.url.endsWith(".svg")) - Number(b.url.endsWith(".svg")));
    images.forEach((overlay, index) => {
      const layer = L.imageOverlay(asset(overlay.url), overlayLatLngBounds(overlay.bounds), {
        opacity: floor === "all" ? 0.72 : 0.95,
        interactive: false,
        zIndex: index + 1,
      });
      group.addLayer(layer);
    });

    for (const overlay of spec.overlays) {
      if (!overlay.tiled) continue;
      const show = floor === "all" ? overlay.floor === spec.defaultLevel : overlay.floor === floor;
      if (show) group.addLayer(makeTileLayer(overlay.url, spec));
    }
  }, [spec, floor]);

  useEffect(() => {
    const map = mapRef.current;
    const group = markerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const labels: { minZoom: number; marker: L.Marker }[] = [];

    const applyLabelZoom = () => {
      const zoom = map.getZoom();
      for (const item of labels) {
        const element = item.marker.getElement();
        if (!element) continue;
        element.style.display = zoom + 0.01 >= item.minZoom ? "" : "none";
      }
    };

    for (const marker of markers) {
      const selected = String(marker.id) === selectedId;
      const choose = () => onSelectRef.current(String(marker.id));

      if (isPath(marker)) {
        const points = pathCoordinates(marker).map(([x, y]) => L.latLng(y, x));
        if (points.length < 2) continue;
        const line = L.polyline(points, {
          color: selected ? "#d6ff4a" : marker.lineColor || "#7dffe1",
          weight: selected ? 6 : 4,
          opacity: 0.92,
        });
        line.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          choose();
        });
        group.addLayer(line);
        continue;
      }

      const point = primaryCoordinate(marker);
      if (!point) continue;
      const latlng = L.latLng(point[1], point[0]);

      if (marker.type === "circle") {
        const radius = (marker.radius ?? 16) * spec.radiusMultiplier;
        const circle = L.circle(latlng, {
          radius,
          color: marker.outline || "rgba(255,255,255,0.8)",
          weight: selected ? 3 : 1.5,
          fillColor: marker.color || "rgba(61, 224, 160, 0.35)",
          fillOpacity: 0.45,
        });
        circle.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          choose();
        });
        group.addLayer(circle);
        continue;
      }

      if (marker.type === "label") {
        const label = L.marker(latlng, {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "map-label",
            html: `<span>${escapeHtml(marker.title || marker.category)}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        });
        const minZoom = marker.zooms?.[0] ? marker.zooms[0] : 0;
        labels.push({ minZoom, marker: label });
        group.addLayer(label);
        continue;
      }

      const meta = categoryMeta(marker.category);
      const wide = meta.group === "Extracts";
      const icon = L.icon({
        iconUrl: asset(marker.icon || meta.icon),
        iconSize: wide ? [44, 26] : [28, 28],
        iconAnchor: wide ? [22, 13] : [14, 14],
        className: selected ? "poi-icon is-selected" : "poi-icon",
      });
      const pin = L.marker(latlng, { icon, title: marker.title || marker.category, zIndexOffset: selected ? 800 : 0 });
      pin.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        choose();
      });
      group.addLayer(pin);
    }

    applyLabelZoom();
    map.on("zoomend", applyLabelZoom);
    return () => {
      map.off("zoomend", applyLabelZoom);
    };
  }, [markers, selectedId, spec.radiusMultiplier]);

  useEffect(() => {
    const group = routeLayerRef.current;
    if (!group) return;
    group.clearLayers();
    for (const route of routes) {
      const latlngs = route.points.map(([x, y]) => L.latLng(y, x));
      if (latlngs.length < 2) continue;
      const active = route.id === activeRouteId;
      const line = L.polyline(latlngs, {
        color: route.color,
        weight: active ? 7 : 4,
        opacity: 0.95,
      });
      line.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        onRouteRef.current(route.id);
      });
      group.addLayer(line);
      route.points.forEach((point, index) => {
        const stop = L.marker(L.latLng(point[1], point[0]), {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "profit-stop",
            html: `<span style="background:${route.color}">${index + 1}</span>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        });
        group.addLayer(stop);
      });
    }
  }, [routes, activeRouteId]);

  useEffect(() => {
    if (routeFit === 0) return;
    fitRef.current();
  }, [routeFit]);

  useEffect(() => {
    const map = mapRef.current;
    const currentId = selectedRef.current;
    if (!map || focusToken === 0 || !currentId) return;
    const marker = markersRef.current.find((item) => String(item.id) === currentId);
    const point = marker ? primaryCoordinate(marker) : null;
    if (!point) return;
    const target = Math.min(spec.maxZoom, Math.max(map.getZoom(), spec.zoomToMarker));
    const latlng = L.latLng(point[1], point[0]);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) map.setView(latlng, target);
    else map.flyTo(latlng, target, { duration: 0.45 });
  }, [focusToken, spec.maxZoom, spec.zoomToMarker]);

  return <div ref={hostRef} className="map-stage" />;
}
