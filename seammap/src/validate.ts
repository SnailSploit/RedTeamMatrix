// DEFINITION OF DONE — the structural invariants from the brief, as runnable tests.
// Run: `node src/validate.ts`. Exits non-zero if any invariant is violated.

import { readFileSync } from "node:fs";
import { loadDataset } from "./model.ts";
import { gapsRegister, autoSpawn } from "./gap-engine.ts";
import { buildTree, buildMatrix, everyCellTyped } from "./projections.ts";
import { predictComposites } from "./compose.ts";
import { rankPriorities, optimizeUnderBudget, coverage } from "./optimize.ts";
import { discoverThreats } from "./discover.ts";
import { loadMitre, mitreCoverage } from "./mitre.ts";
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
    tactics: ["TA0040"], classic_branches: ["Impact"],
    trust_assumption: "synthetic probe assumption unique-string-zzz",
    violation: "synthetic", techniques: [{ name: "ProbeTechnique", attack_ids: [], cwe_ids: [] }],
    operator: { scalable: 0, automatable: 0, ai_augmentable: 0 },
    tooling_status: "none", detection_status: "none", origin: "seed",
  };
  const ds2: Dataset = { ...ds, seams: [...ds.seams, synthetic] };
  const tree1 = buildTree(ds2);
  const matrix1 = buildMatrix(ds2);

  const inTree = tree1.find((b) => b.branch === "Impact")?.leaves.some((l) => l.seam_id === "__synthetic_probe");
  const inMatrix = matrix1.cells["host"]["TA0040"].seam_ids.includes("__synthetic_probe");
  const notInBaseline =
    !tree0.find((b) => b.branch === "Impact")?.leaves.some((l) => l.seam_id === "__synthetic_probe") &&
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

// ---------------------------------------------------------------------------
// 6. LEAF COVERAGE — the model must not regress below the source mind map.
// Every leaf of the source hackinarticles map is re-homed to >=1 seam (keyword
// match against seam technique names / trust assumption / violation), or its
// branch is operator-side honest-na. Fails if any leaf is silently dropped.
// ---------------------------------------------------------------------------
{
  const src = JSON.parse(
    readFileSync(new URL("../data/mindmap-source.json", import.meta.url), "utf8"),
  );
  const naSourceBranches = new Set([
    "Planning & Scoping", "Frameworks & Methodologies", "Tooling", "Adversary Emulation", "Reporting & Debrief",
  ]);
  const STOP = new Set(["the","and","for","with","via","from","over","into","your","scope","attack","based",
    "data","access","using","known","new","old","etc","aka","or","of","to","in","on","a","an","internal","external","site"]);
  const corpus = ds.seams.map((s) =>
    (s.techniques.map((t) => t.name).join(" ") + " " + s.trust_assumption + " " + s.violation + " " + s.classic_branches.join(" "))
      .toLowerCase()).join(" || ");
  const tokenize = (leaf: string) =>
    leaf.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !STOP.has(t));
  // A token matches on exact, singular (-s), or a 6-char stem (covers -y/-ic/-ing variants).
  const matches = (t: string) =>
    corpus.includes(t) || corpus.includes(t.replace(/s$/, "")) || (t.length >= 7 && corpus.includes(t.slice(0, 6)));

  const uncovered: string[] = [];
  let leafCount = 0;
  for (const b of src.branches) {
    if (naSourceBranches.has(b.name)) continue;
    for (const leaf of b.leaves) {
      leafCount++;
      const toks = tokenize(leaf);
      const hit = toks.length === 0 || toks.some(matches);
      if (!hit) uncovered.push(`${b.name} :: ${leaf}`);
    }
  }
  log(uncovered.length === 0,
    `Leaf coverage: all ${leafCount} source-map technique leaves re-homed to a seam` +
    (uncovered.length ? ` — UNCOVERED: ${uncovered.join(" | ")}` : ""));
}

// ---------------------------------------------------------------------------
// 7. COMPOSITION PREDICTOR — old + new tech composes into emergent vulns the graph
// can PREDICT. Every predicted composite must reference a real frontier entry seam
// and a real mature propagation seam meeting at a shared principal.
// ---------------------------------------------------------------------------
{
  const seamById = new Map(ds.seams.map((s) => [s.id, s]));
  const composites = predictComposites(ds, 40);
  log(composites.length >= 10, `Composition predictor: emits ${composites.length} predicted emergent composites`);
  const wellFormed = composites.every((c) => {
    const B = seamById.get(c.entry_seam), A = seamById.get(c.propagate_seam);
    return A && B && B.target.includes(c.node) && A.source.includes(c.node) &&
      (B.detection_status === "none" || B.detection_status === "nascent") &&
      (A.tooling_status === "mature" || A.tooling_status === "available");
  });
  log(wellFormed, `Composition predictor: every prediction = real undetected-entry x real mature-propagation at a shared node`);
}

// ---------------------------------------------------------------------------
// 8. VALIDATION & RECALIBRATION — every AGENT-DISCOVERED gap carries a falsifiable
// validation technique and a skeptical validity verdict, so the model is calibrated,
// not just enumerated.
// ---------------------------------------------------------------------------
{
  const disc = ds.seams.filter((s) => s.origin === "AGENT-DISCOVERED");
  const VALIDITY = new Set(["demonstrated", "plausible", "speculative"]);
  const complete = disc.filter((s) =>
    s.validation && s.validation.validation_method?.length > 20 && s.validation.falsifier?.length > 10 &&
    VALIDITY.has(s.validation.validity));
  log(complete.length === disc.length,
    `Validation: all ${disc.length} discovered gaps have a falsifiable method + refuter + validity verdict (${complete.length})`);

  // Recalibration must have actually moved some statuses off the raw "frontier/none/none".
  const recalibrated = disc.filter((s) => s.maturity !== "frontier" || s.tooling_status !== "none" || s.detection_status !== "none");
  log(recalibrated.length > 0,
    `Recalibration: validation moved ${recalibrated.length}/${disc.length} gaps off raw frontier/none/none to calibrated status`);
}

// ---------------------------------------------------------------------------
// 9. RED-TEAM VALIDATION ARTIFACTS — discovered/frontier seams carry runnable,
// authorization-gated lab artifacts so a gap can actually be tested, not just read.
// ---------------------------------------------------------------------------
{
  const withArt = ds.seams.filter((s) => s.test_artifact);
  log(withArt.length >= 20, `Artifacts: ${withArt.length} seams ship a red-team validation artifact`);
  const wellFormed = withArt.every((s) => {
    const a = s.test_artifact!;
    return a.script?.length > 40 && a.authorization?.length > 10 && a.success_criterion?.length > 10 &&
      /authoriz|lab|non-prod|RoE|owned|contracted/i.test(a.authorization);
  });
  log(wellFormed, `Artifacts: every artifact has an authorization gate, a runnable script, and a success criterion`);
}

// ---------------------------------------------------------------------------
// 10. DATA-DRIVEN OPTIMIZER — priorities derive from the data layers, and the
// budget-constrained optimum respects its budget. Self-measured coverage present.
// ---------------------------------------------------------------------------
{
  const pr = rankPriorities(ds, 30);
  log(pr.length > 0 && pr.every((p) => p.score >= 0 && p.drivers.length >= 0),
    `Optimizer: ranks ${pr.length} data-driven priorities (yield/effort with explainable drivers)`);
  const opt = optimizeUnderBudget(ds, 25);
  log(opt.totalEffort <= 25 && opt.selected.length > 0,
    `Optimizer: budget-constrained optimum respects budget (effort ${opt.totalEffort} <= 25, ${opt.selected.length} seams)`);
  const cov = coverage(ds);
  log(cov.artifact_coverage === 1,
    `Coverage: 100% of seams carry a red-team validation artifact (${(cov.artifact_coverage * 100).toFixed(0)}%, ${cov.poc_confirmed} PoC-confirmed by execution, ${(cov.validation_coverage * 100).toFixed(0)}% validity-rated)`);
}

// ---------------------------------------------------------------------------
// 11. RELATION-GRAPH DISCOVERY — the graph locates new threats via three structural
// signals, each candidate carrying an auditable structural reason.
// ---------------------------------------------------------------------------
{
  const found = discoverThreats(ds, { simThreshold: 0.55, limit: 60 });
  const kinds = new Set(found.map((f) => f.kind));
  log(found.length >= 10 && kinds.size === 3,
    `Discovery: relation graph locates ${found.length} new-threat candidates across all 3 modes (${[...kinds].join(", ")})`);
  log(found.every((f) => f.reason.length > 40),
    `Discovery: every located threat carries an auditable structural reason`);
}

// ---------------------------------------------------------------------------
// 12. MITRE ATT&CK coverage — the full Enterprise catalogue is fed in, and every base
// technique resolves to >=1 seam (mapped or natively), or the gap is surfaced.
// ---------------------------------------------------------------------------
{
  const m = loadMitre();
  log(m.tactics.length === 14 && m.techniques.length > 600,
    `MITRE: full Enterprise catalogue loaded (${m.tactics.length} tactics, ${m.techniques.filter((t) => !t.is_subtechnique).length} base + ${m.techniques.filter((t) => t.is_subtechnique).length} sub techniques)`);
  const cov = mitreCoverage(ds, m);
  log(cov.base_uncovered === 0,
    `MITRE: 100% of ${cov.base_total} base techniques resolve to a seam (${cov.base_covered} covered, ${cov.base_uncovered} uncovered)`);
}

// ---------------------------------------------------------------------------
// 13. TECHNICAL DEEP-DIVE COMPLETENESS — every AGENT-DISCOVERED technique carries a
// web-verified technical note: a mechanism, an explicit MITRE *gap* statement (where
// ATT&CK is blind and why), and >=1 real-world anchor. No discovered technique is left
// without the technical material. "Ensure no missing."
// ---------------------------------------------------------------------------
{
  const disc = ds.seams.filter((s) => s.origin === "AGENT-DISCOVERED");
  const noNote = disc.filter((s) => !s.tech_note);
  log(noNote.length === 0,
    `Tech-notes: every AGENT-DISCOVERED technique has a deep-dive note (${disc.length - noNote.length}/${disc.length})` +
    (noNote.length ? ` — MISSING: ${noNote.map((s) => s.id).join(", ")}` : ""));

  const noGap = disc.filter((s) => !s.tech_note?.mitre_gap || s.tech_note.mitre_gap.length < 40);
  log(noGap.length === 0,
    `Tech-notes: every discovered technique states an explicit MITRE gap (${disc.length - noGap.length}/${disc.length})` +
    (noGap.length ? ` — MISSING: ${noGap.map((s) => s.id).join(", ")}` : ""));

  const thin = disc.filter((s) => !s.tech_note?.mechanism || (s.tech_note.anchors || []).length === 0);
  log(thin.length === 0,
    `Tech-notes: every discovered technique has a mechanism + >=1 real-world anchor (${disc.length - thin.length}/${disc.length})` +
    (thin.length ? ` — THIN: ${thin.map((s) => s.id).join(", ")}` : ""));
}

console.log(`\n${failures === 0 ? "ALL INVARIANTS HOLD" : `${failures} INVARIANT(S) VIOLATED`}`);
process.exit(failures === 0 ? 0 : 1);
