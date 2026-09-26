import fs from "node:fs";
import path from "node:path";

const slugs = ["farm", "airport", "armory", "northridge", "tv-station", "valley"];
const root = path.resolve(import.meta.dirname, "..", "data", "markers");

fs.mkdirSync(root, { recursive: true });

for (const slug of slugs) {
  const url = `https://maps.tcno.co/api/markers/abi-${slug}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${slug} ${response.status} ${url}`);
  }
  const markers = await response.json();
  if (!Array.isArray(markers)) {
    throw new Error(`${slug} did not return a marker array`);
  }
  fs.writeFileSync(path.join(root, `${slug}.json`), JSON.stringify(markers));
  console.log(`${slug} ${markers.length}`);
}
