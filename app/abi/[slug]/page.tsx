import MapExplorer from "@/components/MapExplorer";
import { getMarkers } from "@/lib/data";
import { getMap, MAPS } from "@/lib/maps";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type Params = { slug: string };

export function generateStaticParams() {
  return MAPS.map((map) => ({ slug: map.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const map = getMap(slug);
  return { title: map ? `${map.name} map` : "Map" };
}

export default async function MapPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const spec = getMap(slug);
  if (!spec) notFound();
  const markers = getMarkers(slug);
  return (
    <Suspense fallback={<div className="boot">Loading {spec.name}…</div>}>
      <MapExplorer spec={spec} markers={markers} />
    </Suspense>
  );
}
