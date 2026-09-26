import { asset } from "@/lib/asset";
import { markerCount } from "@/lib/data";
import { MAPS } from "@/lib/maps";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ABI maps",
};

export default function AbiIndexPage() {
  return (
    <main className="index">
      <header>
        <p className="eyebrow">Arena Breakout: Infinite</p>
        <h1>Maps</h1>
        <p>
          Keys, extracts, safes, and loot for every raid. Pick a map, switch floors, and filter by difficulty.
        </p>
      </header>
      <ul className="map-grid">
        {MAPS.map((map) => (
          <li key={map.slug}>
            <Link href={`/abi/${map.slug}`}>
              <img src={asset(map.image)} alt="" />
              <span>
                <strong>{map.name}</strong>
                <em>{markerCount(map.slug)} places</em>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
