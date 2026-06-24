// ROTATION / COMBINATORIAL-GROWTH ANALYSIS.
// Question: can the gap set grow exponentially by rotating categories with the right
// calculation? Answer, made precise: there are THREE different growth regimes, and only
// one is exponential.
//
//   (1) Single edges      = principal_pair x primitive          -> O(N^2 * 6)  (quadratic, fixed)
//   (2) Cross-domain tuple = ordered k-tuple of domains x prims  -> O(N^k * 6^?) (poly in N, exp in k)
//   (3) Compositions/paths = chains through the graph            -> O(b^L)      (TRUE exponential in length)
//
// (1) is already fully enumerated by the gap engine. (3) is where unbounded growth lives:
// a chain of length L has ~b^L candidates (b = average out-branching). BUT raw candidates
// are mostly noise. The "right calculation" is the yield score that prunes: a chain only
// survives if it is plausible (no honest-na hop) and scores above threshold. So candidates
// grow exponentially; the QUALITY-SURVIVING set grows then saturates (a sigmoid), because
// the supply of distinct, real trust assumptions is large but finite. This module measures
// exactly that, so the claim is grounded in the data, not asserted.

import type { Dataset, Seam } from "./types.ts";

const detectionGap: Record<string, number> = { none: 3, nascent: 2, partial: 1, available: 1, mature: 0 };
const reliability: Record<string, number> = { mature: 3, available: 2, partial: 1, nascent: 0.5, none: 0.5 };
const isMature = (s: Seam) => s.maturity === "mature" && (s.tooling_status === "mature" || s.tooling_status === "available");
const isFrontier = (s: Seam) =>
  (s.kind === "frontier" || s.maturity === "frontier" || s.maturity === "emerging") &&
  (s.detection_status === "none" || s.detection_status === "nascent");

interface DepthRow { depth: number; candidates: number; newSeams: number; cumulativeSeams: number; }

// For each chain length L: count raw candidate paths (explodes ~b^L) AND the cumulative
// number of DISTINCT seams those chains actually touch (saturates at the reachable set).
// The gap between the two columns is the whole point: exponential presentations drawn from
// a finite generator. Adding chain length manufactures combinations, not new knowledge.
export function growthByDepth(ds: Dataset, maxDepth = 5): DepthRow[] {
  const out = new Map<string, { s: Seam; to: string }[]>();
  for (const s of ds.seams) for (const a of s.source) for (const b of s.target) {
    if (a === b) continue;
    (out.get(a) ?? out.set(a, []).get(a)!).push({ s, to: b });
  }
  const candidates = new Array(maxDepth + 1).fill(0);
  const seamsAtDepth: Set<string>[] = Array.from({ length: maxDepth + 1 }, () => new Set<string>());

  function walk(node: string, visited: Set<string>, len: number) {
    if (len >= maxDepth) return;
    for (const e of out.get(node) ?? []) {
      if (visited.has(e.to)) continue;
      const ok = len === 0 ? isFrontier(e.s) : isMature(e.s);
      if (!ok) continue;
      candidates[len + 1]++;
      seamsAtDepth[len + 1].add(e.s.id);
      visited.add(e.to);
      walk(e.to, visited, len + 1);
      visited.delete(e.to);
    }
  }
  for (const n of ds.principals.map((p) => p.id)) walk(n, new Set([n]), 0);

  const rows: DepthRow[] = [];
  const cumulative = new Set<string>();
  for (let L = 1; L <= maxDepth; L++) {
    const before = cumulative.size;
    for (const id of seamsAtDepth[L]) cumulative.add(id);
    rows.push({ depth: L, candidates: candidates[L], newSeams: cumulative.size - before, cumulativeSeams: cumulative.size });
  }
  return rows;
}

// Cross-domain "rotation" candidate count: ordered k-tuples of distinct principals x 6
// primitives, minus honest-na. This is regime (2): polynomial in N, exponential in k.
export function rotationSpace(nPrincipals: number, k: number): number {
  let perm = 1;
  for (let i = 0; i < k; i++) perm *= (nPrincipals - i); // N!/(N-k)!
  return perm * Math.pow(6, k - 1); // a primitive per hop, first fixes the family
}
