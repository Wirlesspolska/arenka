"use client";

import { floorLabel } from "@/lib/maps";
import {
  generateProfitRoutes,
  listProfitKeys,
  type ProfitKeyMode,
  type ProfitRoute,
  type ProfitTarget,
} from "@/lib/profit";
import type { MapRules, Marker } from "@/lib/types";
import { useMemo, useState } from "react";

const TARGETS: { id: ProfitTarget; label: string }[] = [
  { id: "red", label: "Red items" },
  { id: "safe", label: "Safes" },
  { id: "safe-red", label: "Safes + red" },
];

const KEYS: { id: ProfitKeyMode; label: string }[] = [
  { id: "all", label: "With keys" },
  { id: "none", label: "No keys" },
  { id: "custom", label: "Custom keys" },
];

type Props = {
  markers: Marker[];
  rules: MapRules;
  floor: string;
  difficulty: string;
  routes: ProfitRoute[];
  activeId: string | null;
  onGenerate: (routes: ProfitRoute[]) => void;
  onClear: () => void;
  onActive: (id: string) => void;
};

export default function ProfitPanel({
  markers,
  rules,
  floor,
  difficulty,
  routes,
  activeId,
  onGenerate,
  onClear,
  onActive,
}: Props) {
  const [target, setTarget] = useState<ProfitTarget>("safe-red");
  const [keys, setKeys] = useState<ProfitKeyMode>("none");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");

  const keyOptions = useMemo(
    () => listProfitKeys(markers, rules, difficulty),
    [markers, rules, difficulty],
  );

  function generate() {
    const customKeyIds = keyOptions.filter((key) => picked[key.id]).map((key) => key.id);
    const next = generateProfitRoutes({
      markers,
      rules,
      floor,
      difficulty,
      target,
      keys,
      customKeyIds,
    });
    onGenerate(next);
    setNote(next.length ? "" : "Nothing to route on this floor for that mode.");
  }

  return (
    <section className="profit-panel" aria-label="Profit run">
      <header>
        <h2>Profit run</h2>
        <p>{floor === "all" ? "Busiest floor" : floorLabel(floor)} · {difficulty}</p>
      </header>
      <div className="profit-modes" role="group" aria-label="Loot">
        {TARGETS.map((item) => (
          <button key={item.id} type="button" aria-pressed={target === item.id} onClick={() => setTarget(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="profit-modes" role="group" aria-label="Keys">
        {KEYS.map((item) => (
          <button key={item.id} type="button" aria-pressed={keys === item.id} onClick={() => setKeys(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {keys === "custom" ? (
        <ul className="profit-keys">
          {keyOptions.length ? keyOptions.map((key) => (
            <li key={key.id}>
              <label>
                <input
                  type="checkbox"
                  checked={picked[key.id] === true}
                  onChange={() => setPicked((prev) => ({ ...prev, [key.id]: !prev[key.id] }))}
                />
                <span>{key.title}</span>
                {key.level ? <em>{key.level}</em> : null}
              </label>
            </li>
          )) : <li className="empty">No keys on this difficulty.</li>}
        </ul>
      ) : null}
      <div className="profit-actions">
        <button type="button" className="profit-go" onClick={generate}>Generate</button>
        {routes.length ? <button type="button" onClick={onClear}>Clear</button> : null}
      </div>
      {note ? <p className="empty">{note}</p> : null}
      {routes.length ? (
        <ul className="profit-routes">
          {routes.map((route) => (
            <li key={route.id}>
              <button type="button" aria-pressed={route.id === activeId} onClick={() => onActive(route.id)}>
                <i style={{ background: route.color }} />
                <strong>{route.label}</strong>
                <span>
                  {route.floor ? floorLabel(route.floor) : "Map"}
                  {" · "}
                  {route.stops.length} stops
                  {route.extractTitle ? ` · ${route.extractTitle}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
