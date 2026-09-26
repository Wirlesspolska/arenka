import { markerCount } from "@/lib/data";
import { MAPS } from "@/lib/maps";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      maps: MAPS.map((map) => ({
        slug: map.slug,
        name: map.name,
        href: `/abi/${map.slug}`,
        markers: markerCount(map.slug),
        levels: map.levels,
        difficulties: map.difficulties,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
