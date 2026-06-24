// Runs the relation-graph threat discoverer and prints located threats by kind.
// Run: node src/discover-demo.ts
import { loadDataset } from "./model.ts";
import { discoverThreats } from "./discover.ts";

const ds = loadDataset();
const found = discoverThreats(ds, { simThreshold: 0.55, limit: 60 });
const byKind: Record<string, number> = {};
for (const f of found) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
console.log(`Relation-graph discovery located ${found.length} candidate new threats:`, JSON.stringify(byKind), "\n");

for (const kind of ["analogical-transfer", "transitive-chain", "structural-hole"]) {
  console.log(`=== ${kind} (top 6) ===`);
  for (const f of found.filter((x) => x.kind === kind).slice(0, 6)) {
    console.log(`  [${f.score}] ${f.primitive}  ${f.source} -> ${f.target}`);
    console.log(`        ${f.reason}`);
  }
  console.log("");
}
