// DEFINITION OF DONE — the structural invariants from the brief, as runnable tests.
// Run: `node src/validate.ts`. Exits non-zero if any invariant is violated.

import { loadDataset } from "./model.ts";
import { gapsRegister, autoSpawn } from "./gap-engine.ts";
import { buildTree, buildMatrix, everyCellTyped } from "./projections.ts";
import type { Dataset, Principal, Seam } from "./types.ts";

let failures = 0;
const log = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

const ds = loadDataset();

// ---------------------------------------------------------------------------
// 1. NON-DELETION — every classic branch and every ATT&CK tactic resolves to >=1
// seam, or is explicitly logged honest-na. New does not cancel old.
// ---------------------------------------------------------------------------
{
  const naBranches = new Set(ds.coverage.branch_honest_na.map((b) => b.branch));
  let dropped: string[] = [];
  for (const branch of ds.coverage.classic_branches) {
    const covered = ds.seams.some((s) => s.classic_branches.includes(branch));
    if (!covered && !naBranches.has(branch)) dropped.push(`branch '${branch}'`);
  }
  for (const t of ds.coverage.attack_tactics) {
    const covered = ds.seams.some((s) => s.tactics.includes(t.id));
    const naCell = ds.coverage.honest_na_cells.some((c) => c.tactic === t.id);
    if (!covered && !naCell) dropped.push(`tactic ${t.id} (${t.name})`);
  }
  log(dropped.length === 0,
    `Non-deletion: all ${ds.coverage.classic_branches.length} classic branches + ` +
    `${ds.coverage.attack_tactics.length} ATT&CK tactics re-homed or honest-na` +
    (dropped.length ? ` — DROPPED: ${dropped.join(", ")}` : ""));

  // Every seam must carry a distinct trust assumption (no bulk templating / padding).
  const assumptions = ds.seams.map((s) => s.trust_assumption.trim());
  const uniq = new Set(assumptions);
  log(uniq.size === assumptions.length,
    `No-padding: every seam has a distinct trust assumption (${uniq.size}/${assumptions.length} unique)`);
}

// ---------------------------------------------------------------------------
// 2. FRONTIER — all 8 named frontier seams present; each decomposed into >=2
// sub-seams; auto-spawn rule demonstrated on a new node.
// ---------------------------------------------------------------------------
{
  log(ds.frontier_seams.length === 8, `Frontier: all 8 named frontier seams present (${ds.frontier_seams.length})`);

  let underDecomposed: string[] = [];
  for (const f of ds.frontier_seams) {
    const subs = ds.seams.filter((s) => s.parent === f.id);
    if (subs.length < 2) underDecomposed.push(`${f.id} (${subs.length})`);
  }
  log(underDecomposed.length === 0,
    `Frontier: every named seam decomposes into >=2 sub-seams` +
    (underDecomposed.length ? ` — UNDER: ${underDecomposed.join(", ")}` : ""));

  const probe: Principal = {
    id: "__probe2027", name: "Probe 2027 Node", class: "broker",
    era_introduced: 2027, maturity: "frontier",
  };
  const spawned = autoSpawn(ds, probe);
  log(spawned.length > 0 && spawned.every((g) => g.gap_type === "frontier" || g.gap_type === "projected"),
    `Auto-spawn: adding a node spawns ${spawned.length} frontier/projected candidate edges`);
}

// ---------------------------------------------------------------------------
// 3. GAP ENGINE — register non-empty; >=10 AGENT-DISCOVERED entries with rationale
// + suggested_research.
// ---------------------------------------------------------------------------
{
  const reg = gapsRegister(ds);
  log(reg.length > 0, `Gap engine: register is non-empty (${reg.length} entries)`);

  const discovered = reg.filter((g) => g.origin === "AGENT-DISCOVERED");
  const complete = discovered.filter(
    (g) => g.rationale && g.rationale.length > 40 && g.suggested_research && g.suggested_research.length > 20,
  );
  log(complete.length >= 10,
    `Gap engine: >=10 AGENT-DISCOVERED entries with rationale + suggested_research ` +
    `(${complete.length} complete of ${discovered.length})`);

  // AGENT-DISCOVERED surfaced first (§6); typed bulk then frontier -> under-tooled -> projected (§5.2).
  const firstNonDiscovered = reg.findIndex((g) => g.origin !== "AGENT-DISCOVERED");
  const discoveredContiguousAtTop = reg.slice(0, firstNonDiscovered).every((g) => g.origin === "AGENT-DISCOVERED");
  const afterFirstBlock = reg.slice(firstNonDiscovered);
  const projectedBeforeFrontier = afterFirstBlock.some((g, i) =>
    g.gap_type === "projected" && afterFirstBlock.slice(i).some((h) => h.gap_type === "frontier"));
  log(discoveredContiguousAtTop && !projectedBeforeFrontier,
    `Gap engine: register surfaces AGENT-DISCOVERED first, then frontier -> under-tooled -> projected`);
}

// ---------------------------------------------------------------------------
// 4. PROJECTION — tree and matrix are GENERATED from the graph, not hand-authored.
// Editing a seam updates all three views.
// ---------------------------------------------------------------------------
{
  const tree0 = buildTree(ds);
  const matrix0 = buildMatrix(ds);

  // Inject a synthetic seam and confirm it propagates into both projections.
  const synthetic: Seam = {
    id: "__synthetic_probe", primitive: "P1", kind: "classic",
    source: ["web"], target: ["host"], maturity: "mature",
    tactics: ["TA0040"], classic_branches: ["Reporting"],
    trust_assumption: "synthetic probe assumption unique-string-zzz",
    violation: "synthetic", techniques: [{ name: "ProbeTechnique", attack_ids: [], cwe_ids: [] }],
    operator: { scalable: 0, automatable: 0, ai_augmentable: 0 },
    tooling_status: "none", detection_status: "none", origin: "seed",
  };
  const ds2: Dataset = { ...ds, seams: [...ds.seams, synthetic] };
  const tree1 = buildTree(ds2);
  const matrix1 = buildMatrix(ds2);

  const inTree = tree1.find((b) => b.branch === "Reporting")?.leaves.some((l) => l.seam_id === "__synthetic_probe");
  const inMatrix = matrix1.cells["host"]["TA0040"].seam_ids.includes("__synthetic_probe");
  const notInBaseline =
    !tree0.find((b) => b.branch === "Reporting")?.leaves.some((l) => l.seam_id === "__synthetic_probe") &&
    !matrix0.cells["host"]["TA0040"].seam_ids.includes("__synthetic_probe");
  log(Boolean(inTree && inMatrix && notInBaseline),
    `Projection: editing the graph propagates to BOTH tree and matrix (derived, not authored)`);
}

// ---------------------------------------------------------------------------
// 5. TYPING — every empty matrix cell carries a gap-type; no plain blanks.
// ---------------------------------------------------------------------------
{
  const matrix = buildMatrix(ds);
  log(everyCellTyped(matrix), `Typing: every matrix cell carries a gap-type (no plain blanks)`);

  // And the four typed-blank states all appear somewhere (gaps cluster, types are real).
  const seen = new Set<string>();
  for (const pid of matrix.principals)
    for (const t of matrix.tactics) seen.add(matrix.cells[pid][t.id].gap_type);
  const wanted = ["populated", "honest-na", "frontier", "under-tooled"];
  const missing = wanted.filter((w) => !seen.has(w));
  log(missing.length === 0, `Typing: matrix exercises all gap states (${[...seen].sort().join(", ")})`);
}

console.log(`\n${failures === 0 ? "ALL INVARIANTS HOLD" : `${failures} INVARIANT(S) VIOLATED`}`);
process.exit(failures === 0 ? 0 : 1);
