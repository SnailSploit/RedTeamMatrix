// Loads the canonical seed corpus and exposes hypergraph helpers.
// The model is canonical; tree and matrix are projections of it (see projections.ts).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
  Dataset, Primitive, Principal, Seam, FrontierSeam, ClassicCoverage, PrimitiveId,
} from "./types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");

function readJson(name: string): any {
  return JSON.parse(readFileSync(join(DATA, name), "utf8"));
}

export function loadDataset(): Dataset {
  const primitives: Primitive[] = readJson("primitives.json").primitives;
  const principals: Principal[] = readJson("principals.json").principals;
  const seams: Seam[] = readJson("seams.json").seams;
  const frontier_seams: FrontierSeam[] = readJson("frontier-seams.json").frontier_seams;
  const coverage: ClassicCoverage = readJson("classic-coverage.json");

  // Join adversarial-validation results (validations.json) onto seams: attach the
  // validation block AND recalibrate maturity/tooling/detection to the verdict, so the
  // scorer, matrix, and predictor all reflect calibrated reality. Absent file => no-op.
  try {
    const validations: Record<string, any> = readJson("validations.json");
    for (const s of seams) {
      const v = validations[s.id];
      if (!v) continue;
      s.validation = v;
      if (v.recalibrate?.maturity) s.maturity = v.recalibrate.maturity;
      if (v.recalibrate?.tooling_status) s.tooling_status = v.recalibrate.tooling_status;
      if (v.recalibrate?.detection_status) s.detection_status = v.recalibrate.detection_status;
    }
  } catch { /* validations.json not present yet */ }

  // Join red-team validation artifacts (artifacts.json) onto seams. Absent file => no-op.
  try {
    const artifacts: Record<string, any> = readJson("artifacts.json");
    for (const s of seams) if (artifacts[s.id]) s.test_artifact = artifacts[s.id];
  } catch { /* artifacts.json not present yet */ }

  // Join PoC run-results (poc-results.json) onto the artifact: real execution outcomes
  // (the closed loop) upgrade the optimizer's signal from "PoC exists" to "PoC confirmed".
  try {
    const runs: Record<string, any> = readJson("poc-results.json");
    for (const s of seams) if (s.test_artifact && runs[s.id]) s.test_artifact.result = runs[s.id].result;
  } catch { /* poc-results.json not present yet */ }

  return { primitives, principals, seams, frontier_seams, coverage };
}

export const ALL_PRIMITIVES: PrimitiveId[] = ["P1", "P2", "P3", "P4", "P5", "P6"];

// A hyperedge is any seam whose frame spans >= 3 distinct principals across source+target.
export function isHyperedge(s: Seam): boolean {
  return frameOf(s).length >= 3;
}

export function frameOf(s: Seam): string[] {
  return Array.from(new Set([...s.source, ...s.target]));
}

// Principals a seam touches (for matrix membership and graph incidence).
export function principalsOf(s: Seam): string[] {
  return frameOf(s);
}

export function seamsByPrimitive(seams: Seam[]): Map<PrimitiveId, Seam[]> {
  const m = new Map<PrimitiveId, Seam[]>();
  for (const p of ALL_PRIMITIVES) m.set(p, []);
  for (const s of seams) m.get(s.primitive)!.push(s);
  return m;
}

// Ordered principal pairs (source-principal -> target-principal) actually populated by a seam,
// keyed for fast lookup by the gap engine.
export function populatedPairs(seams: Seam[]): Set<string> {
  const set = new Set<string>();
  for (const s of seams) {
    for (const a of s.source) for (const b of s.target) {
      set.add(pairKey(a, b, s.primitive));
    }
  }
  return set;
}

export function pairKey(a: string, b: string, p: PrimitiveId): string {
  return `${a}>${b}:${p}`;
}

export function principalIndex(principals: Principal[]): Map<string, Principal> {
  return new Map(principals.map((p) => [p.id, p]));
}
