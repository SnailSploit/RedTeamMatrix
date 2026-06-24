// BUILD — render the projections from the one canonical model and emit a single
// static dataset.json the web views read. No backend. Run: `node src/build.ts`.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadDataset, isHyperedge, frameOf } from "./model.ts";
import { gapsRegister, gapStats } from "./gap-engine.ts";
import { buildTree, buildMatrix } from "./projections.ts";
import { CLS, EGQ, egqIsCandidate } from "./scheduler.ts";
import { predictComposites, predictChains3 } from "./compose.ts";
import { rankPriorities, optimizeUnderBudget, coverage } from "./optimize.ts";
import { discoverThreats } from "./discover.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "web", "dataset.json");

const ds = loadDataset();
const register = gapsRegister(ds);
const tree = buildTree(ds);
const matrix = buildMatrix(ds);
const composites = predictComposites(ds, 40);
const chains3 = predictChains3(ds, 15);
const priorities = rankPriorities(ds, 40);
const optimized = optimizeUnderBudget(ds, 25);
const cov = coverage(ds);
const discoveries = discoverThreats(ds, { simThreshold: 0.55, limit: 60 });

// Pre-compute per-seam scores so the web Path view and edge detail need no scorer logic.
const scored = ds.seams.map((s) => ({
  id: s.id,
  cls: Number(CLS.score(s).toFixed(3)),
  egq: Number(EGQ.score(s).toFixed(3)),
  egq_candidate: egqIsCandidate(s),
  hyper: isHyperedge(s),
  frame: frameOf(s),
}));

const bundle = {
  meta: {
    generated_from: "canonical seed corpus (data/*.json) via src/build.ts",
    primitives: ds.primitives.length,
    principals: ds.principals.length,
    seams: ds.seams.length,
    hyperedges: scored.filter((s) => s.hyper).length,
    frontier_seams: ds.frontier_seams.length,
    register_size: register.length,
    gap_stats: gapStats(register),
    predicted_composites: composites.length,
    predicted_chains3: chains3.length,
    validity: register.filter((g) => g.origin === "AGENT-DISCOVERED").reduce((m: any, g) => {
      m[g.validity ?? "unrated"] = (m[g.validity ?? "unrated"] ?? 0) + 1; return m;
    }, {}),
    test_artifacts: ds.seams.filter((s) => s.test_artifact).length,
    coverage: cov,
    discoveries: discoveries.length,
    mitre_absent: ds.seams.filter((s) => s.techniques.every((t) => !t.attack_ids || t.attack_ids.length === 0)).length,
  },
  primitives: ds.primitives,
  principals: ds.principals,
  seams: ds.seams,
  scored,
  frontier_seams: ds.frontier_seams,
  coverage: ds.coverage,
  register,
  tree,
  matrix,
  composites,
  chains3,
  priorities,
  optimized,
  discoveries,
};

writeFileSync(OUT, JSON.stringify(bundle, null, 2));
console.log(`wrote ${OUT}`);
console.log(`  ${bundle.meta.seams} seams (${bundle.meta.hyperedges} hyperedges), ` +
  `${bundle.meta.register_size} register entries`);
console.log(`  gap stats:`, JSON.stringify(bundle.meta.gap_stats));
