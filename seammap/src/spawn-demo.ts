// AUTO-SPAWN DEMO (§5.3) — the frontier is generative. Add a hypothetical 2027 node
// and show the gap set it spawns. The map keeps pace with the edge instead of fossilizing.
// Run: `node src/spawn-demo.ts`.

import { loadDataset } from "./model.ts";
import { autoSpawn } from "./gap-engine.ts";
import type { Principal } from "./types.ts";

const ds = loadDataset();

const newNode: Principal = {
  id: "skillregistry",
  name: "Agent Marketplace / Skill Registry",
  class: "broker",
  era_introduced: 2027,
  maturity: "frontier",
  note: "Hypothetical 2027 substrate: a marketplace that distributes agent skills/plugins on demand.",
};

const spawned = autoSpawn(ds, newNode);

console.log(`Added node: ${newNode.name} (${newNode.id}), era ${newNode.era_introduced}`);
console.log(`Auto-spawned ${spawned.length} candidate gap edges across 6 primitives.\n`);

const byType: Record<string, number> = {};
for (const g of spawned) byType[g.gap_type] = (byType[g.gap_type] ?? 0) + 1;
console.log("By gap type:", JSON.stringify(byType), "\n");

console.log("Sample spawned edges (first 12):");
for (const g of spawned.slice(0, 12)) {
  console.log(`  [${g.gap_type.padEnd(11)}] ${g.source} -> ${g.target}  (${g.primitive})`);
}

console.log(`\nEvery one of these is a fresh empty cell. Until a technique populates it, ` +
  `the registry node sits on the map as known-unknown attack surface.`);
