// THE SCHEDULER — path-search over violable edges. The map is the read-only action
// space; the scheduler is the running process that selects which edge to attack next.
// Pluggable scorer interface + two reference scorers (CLS, EGQ). Path priority favors
// freshly-spawned / frontier edges, where research yield is highest.

import type { Seam, Dataset } from "./types.ts";
import { tempoOf } from "./tempo.ts";

export interface Scorer {
  name: string;
  score(s: Seam): number;
  describe(s: Seam): string;
}

// Scoring inputs derived from a seam's operator weights, maturity, and defense posture,
// so we never bulk-template magic numbers: every factor traces to a seam property.
function inputs(s: Seam) {
  const op = s.operator;
  const spread = 1 + op.scalable + op.ai_augmentable;            // S: blast/spread (1..3)
  const damage = s.target.length + (op.automatable ? 1 : 0);     // D: frame size + autonomy
  const certainty = s.kind === "classic" ? 3 : 2;               // C: reliability of the technique
  const attackerCost = s.maturity === "frontier" ? 3 : 1;       // A: effort (frontier costs more, today)
  const hardening = statusToScalar(s.detection_status);         // H: defensive maturity
  const techMaturity = s.tooling_status === "none" ? 0.5 : 1;   // M: does tooling exist
  const timeliness = s.maturity === "frontier" ? 1.5 : 1;       // T: frontier freshness bonus
  return { S: spread, D: damage, C: certainty, A: attackerCost, H: hardening, M: techMaturity, T: timeliness };
}

function statusToScalar(x: string): number {
  switch (x) {
    case "mature": return 4;
    case "partial": return 2;
    case "available": return 2;
    case "nascent": return 1;
    default: return 0; // none
  }
}

// CLS = (S·D·C) / ((A+1)(H+1)) · M · T · 0.4
export const CLS: Scorer = {
  name: "CLS",
  score(s) {
    const { S, D, C, A, H, M, T } = inputs(s);
    return (S * D * C) / ((A + 1) * (H + 1)) * M * T * 0.4;
  },
  describe(s) {
    const i = inputs(s);
    return `CLS inputs S=${i.S} D=${i.D} C=${i.C} A=${i.A} H=${i.H} M=${i.M} T=${i.T}`;
  },
};

// EGQ = (T_shift + I_trust) / (E_strict + 1); EGQ >= 2 flags a real candidate.
// T_shift: format/time-boundary shift potential. I_trust: inherited-trust magnitude.
// E_strict: enforcement strictness (how hard the seam is policed today).
export const EGQ: Scorer = {
  name: "EGQ",
  score(s) {
    const tShift = (s.primitive === "P5" || s.primitive === "P6") ? 3 : 1;
    const iTrust = (s.primitive === "P3" || s.primitive === "P4") ? 3
      : (s.primitive === "P2" ? 2 : 1);
    const eStrict = statusToScalar(s.detection_status);
    return (tShift + iTrust) / (eStrict + 1);
  },
  describe(s) {
    return `EGQ flags candidate (>=2) when boundary-shift + inherited-trust outweigh enforcement`;
  },
};

export function egqIsCandidate(s: Seam): boolean {
  return EGQ.score(s) >= 2;
}

// ---------------------------------------------------------------------------
// Path search: a kill chain is a path across seams. We walk principal->principal,
// scoring each path and giving frontier edges a priority bonus.
// ---------------------------------------------------------------------------

export interface PathStep { seam: Seam; from: string; to: string; }
export interface ScoredPath { steps: PathStep[]; score: number; frontierEdges: number; }

function outgoing(seams: Seam[]): Map<string, { seam: Seam; to: string }[]> {
  const m = new Map<string, { seam: Seam; to: string }[]>();
  for (const s of seams) {
    for (const a of s.source) for (const b of s.target) {
      if (a === b) continue;
      if (!m.has(a)) m.set(a, []);
      m.get(a)!.push({ seam: s, to: b });
    }
  }
  return m;
}

// Enumerate simple paths (no repeated principal) up to maxLen, scored by `scorer`,
// with a frontier-edge priority bonus so the scheduler prefers freshly-spawned edges.
export function findPaths(
  ds: Dataset, src: string, dst: string, scorer: Scorer = CLS, maxLen = 5,
): ScoredPath[] {
  const adj = outgoing(ds.seams);
  const results: ScoredPath[] = [];

  function walk(node: string, visited: Set<string>, steps: PathStep[]) {
    if (steps.length > maxLen) return;
    if (node === dst && steps.length > 0) {
      let raw = 0, frontier = 0;
      for (const st of steps) {
        raw += scorer.score(st.seam);
        if (st.seam.maturity === "frontier") frontier++;
      }
      // Frontier priority: research yield is highest on fresh edges.
      const score = raw * (1 + 0.25 * frontier) / steps.length;
      results.push({ steps: [...steps], score, frontierEdges: frontier });
      return;
    }
    for (const e of adj.get(node) ?? []) {
      if (visited.has(e.to)) continue;
      visited.add(e.to);
      steps.push({ seam: e.seam, from: node, to: e.to });
      walk(e.to, visited, steps);
      steps.pop();
      visited.delete(e.to);
    }
  }

  walk(src, new Set([src]), []);
  return results.sort((a, b) => b.score - a.score).slice(0, 12);
}

// ---------------------------------------------------------------------------
// Time-budget path search: same as findPaths, but each seam step costs time
// (its window_seconds, or a class-default). Paths that exceed budget_seconds
// are pruned — you can't traverse a 90-day supply-chain step inside a 1-hour
// operation window. Undefined window_seconds = persistent (no cost counted).
// ---------------------------------------------------------------------------

const TEMPO_DEFAULT_SECONDS: Record<string, number> = {
  instant: 1, session: 3_600, opportunistic: 3_600,
  campaign: 604_800, persistent: 0, // persistent costs 0 — it's always available
};

function seamTimeCost(s: Seam): number {
  const tp = tempoOf(s);
  if (tp.class === "persistent") return 0; // persistent edges are free: always open
  return tp.window_seconds ?? TEMPO_DEFAULT_SECONDS[tp.class] ?? 3_600;
}

export interface TimedPath extends ScoredPath { totalSeconds: number; feasible: boolean; }

export function findPathsWithinBudget(
  ds: Dataset, src: string, dst: string,
  budget_seconds: number, scorer: Scorer = CLS, maxLen = 5,
): TimedPath[] {
  const adj = outgoing(ds.seams);
  const results: TimedPath[] = [];

  function walk(node: string, visited: Set<string>, steps: PathStep[], elapsed: number) {
    if (steps.length > maxLen) return;
    if (node === dst && steps.length > 0) {
      let raw = 0, frontier = 0;
      for (const st of steps) {
        raw += scorer.score(st.seam);
        if (st.seam.maturity === "frontier") frontier++;
      }
      const score = raw * (1 + 0.25 * frontier) / steps.length;
      results.push({ steps: [...steps], score, frontierEdges: frontier, totalSeconds: elapsed, feasible: elapsed <= budget_seconds });
      return;
    }
    for (const e of adj.get(node) ?? []) {
      if (visited.has(e.to)) continue;
      const cost = seamTimeCost(e.seam);
      const next = elapsed + cost;
      // Prune only if this step is not the destination: allow arriving over budget so
      // the caller can see *how* over-budget a path is, but stop branching from there.
      visited.add(e.to);
      steps.push({ seam: e.seam, from: node, to: e.to });
      if (next <= budget_seconds || e.to === dst) walk(e.to, visited, steps, next);
      steps.pop();
      visited.delete(e.to);
    }
  }

  walk(src, new Set([src]), [], 0);
  return results.sort((a, b) => {
    // Feasible paths first, then by score within each group.
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    return b.score - a.score;
  }).slice(0, 12);
}
