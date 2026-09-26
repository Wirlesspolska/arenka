import Link from "next/link";

export default function NotFound() {
  return (
    <main className="index">
      <header>
        <p className="eyebrow">Arenka</p>
        <h1>Missing map</h1>
        <p>
          <Link href="/abi">Back to the maps</Link>
        </p>
      </header>
    </main>
  );
}
