import { getMarkers } from "@/lib/data";
import { getMap } from "@/lib/maps";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { slug: string };

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const { slug } = await context.params;
  const map = getMap(slug);
  if (!map) {
    return NextResponse.json({ error: "Unknown map" }, { status: 404 });
  }
  const markers = getMarkers(slug);
  return NextResponse.json(
    { slug, name: map.name, count: markers.length, markers },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
