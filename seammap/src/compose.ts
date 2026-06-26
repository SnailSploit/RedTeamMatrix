// COMPOSITION PREDICTOR — the merge of old and new tech yields emergent vulnerabilities
// that look unpredictable, but the typed hypergraph makes them PREDICTABLE.
//
// An emergent composite = a FRONTIER (undetected, ~0-tooling) entry seam B whose target
// includes node n, feeding a MATURE (proven, well-tooled) propagation seam A whose source
// includes n. The attacker enters through the new surface nobody monitors yet and then
// fires a reliable classic technique from there. The composite inherits B's lack of
// detection and A's reliability — that combination is exactly what makes it both dangerous
// and, here, predictable: we enumerate every (old A) x (new B) that meet at a shared node.

import type { Dataset, Seam, PrimitiveId } from "./types.ts";

export interface Composite {
  id: string;
  node: string;            // the shared principal where old meets new
  entry_seam: string;      // B — the frontier/undetected surface
  propagate_seam: string;  // A — the mature/reliable technique
  primitives: [PrimitiveId, PrimitiveId];
  prediction: string;      // the emergent vuln, in words
  why_predictable: string;
  score: number;           // amplification: reliability(A) x undetectedness(B) x novelty
}

const detectionGap: Record<string, number> = { none: 3, nascent: 2, partial: 1, available: 1, mature: 0 };
const reliability: Record<string, number> = { mature: 3, available: 2, partial: 1, nascent: 0.5, none: 0.5 };

function isMature(s: Seam): boolean {
  return s.maturity === "mature" && (s.tooling_status === "mature" || s.tooling_status === "available");
}
function isFrontier(s: Seam): boolean {
  return (s.kind === "frontier" || s.maturity === "frontier" || s.maturity === "emerging") &&
    (s.detection_status === "none" || s.detection_status === "nascent");
}
function techOf(s: Seam): string { return s.techniques[0]?.name ?? s.id; }

// Predict emergent composites: for each node n, pair every frontier entry (n in target)
// with every mature propagation (n in source). Rank by amplification, return the top set.
export function predictComposites(ds: Dataset, limit = 40): Composite[] {
  const mature = ds.seams.filter(isMature);
  const frontier = ds.seams.filter(isFrontier);
  const pName = new Map(ds.principals.map((p) => [p.id, p.name]));
  const out: Composite[] = [];

  for (const B of frontier) {
    for (const n of B.target) {
      for (const A of mature) {
        if (A.id === B.id) continue;
        if (!A.source.includes(n)) continue;
        // Skip degenerate self-composition where A and B are the same trust edge direction.
        if (A.primitive === B.primitive && A.target.join() === B.source.join()) continue;
        const novelty = A.primitive === B.primitive ? 1 : 1.4; // cross-primitive merges are more emergent
        const opAmp = 1 + 0.2 * (B.operator.scalable + B.operator.automatable + B.operator.ai_augmentable);
        const score = reliability[A.tooling_status] * (1 + detectionGap[B.detection_status]) * novelty * opAmp;
        const dest = A.target.map((t) => pName.get(t) ?? t).join("/");
        out.push({
          id: `cx:${B.id}>${n}>${A.id}`,
          node: n,
          entry_seam: B.id,
          propagate_seam: A.id,
          primitives: [B.primitive, A.primitive],
          prediction: `Reach ${pName.get(n) ?? n} through the undetected new surface "${techOf(B)}" (${B.primitive}), then fire the proven classic "${techOf(A)}" (${A.primitive}) onward to ${dest}.`,
          why_predictable: `${techOf(B)} has ${B.detection_status} detection and ${B.tooling_status} tooling (a fresh, unwatched entry), while ${techOf(A)} is ${A.tooling_status}-tooled and reliable. The graph already holds both edges at ${pName.get(n) ?? n}; their composition is mechanical, not speculative.`,
          score: Number(score.toFixed(2)),
        });
      }
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

// 3-hop emergent chains: an undetected frontier entry B at node n, then TWO proven classic
// hops (n -> m -> k). The deeper chain is the kill-chain a defender is least likely to
// connect, because the entry surface is unmonitored and the two propagation hops each look
// like ordinary mature activity in isolation.
export interface Chain3 {
  id: string;
  entry_seam: string; hop1_seam: string; hop2_seam: string;
  nodes: [string, string, string];
  primitives: [PrimitiveId, PrimitiveId, PrimitiveId];
  prediction: string;
  score: number;
}
export function predictChains3(ds: Dataset, limit = 15): Chain3[] {
  const mature = ds.seams.filter(isMature);
  const frontier = ds.seams.filter(isFrontier);
  const pName = new Map(ds.principals.map((p) => [p.id, p.name]));
  const nm = (id: string) => pName.get(id) ?? id;
  const out: Chain3[] = [];
  for (const B of frontier) {
    for (const n of B.target) {
      for (const A1 of mature) {
        if (!A1.source.includes(n)) continue;
        for (const m of A1.target) {
          if (m === n) continue;
          for (const A2 of mature) {
            if (A2.id === A1.id || !A2.source.includes(m)) continue;
            const k = A2.target.find((t) => t !== m) ?? A2.target[0];
            if (k === n) continue; // avoid trivial loops back to entry
            const score = reliability[A1.tooling_status] * reliability[A2.tooling_status] *
              (1 + detectionGap[B.detection_status]);
            out.push({
              id: `cx3:${B.id}>${n}>${A1.id}>${m}>${A2.id}`,
              entry_seam: B.id, hop1_seam: A1.id, hop2_seam: A2.id,
              nodes: [n, m, k] as [string, string, string],
              primitives: [B.primitive, A1.primitive, A2.primitive],
              prediction: `Enter ${nm(n)} via undetected "${techOf(B)}" (${B.primitive}); hop to ${nm(m)} via "${techOf(A1)}" (${A1.primitive}); then to ${nm(k)} via "${techOf(A2)}" (${A2.primitive}). Two reliable classic hops behind one unmonitored door.`,
              score: Number(score.toFixed(2)),
            });
          }
        }
      }
    }
  }
  // Dedup identical (entry,hop1,hop2) regardless of node expansion, keep best.
  const best = new Map<string, Chain3>();
  for (const c of out) {
    const key = `${c.entry_seam}|${c.hop1_seam}|${c.hop2_seam}`;
    if (!best.has(key) || best.get(key)!.score < c.score) best.set(key, c);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// EMERGING-GAP AGGREGATE — the shape of the old×new cross, computed over the FULL composite
// set (not the top-N shown in the UI). Surfaces the junction principals where old meets new,
// the dominant new→old primitive-merge patterns, and the cross-taxonomy bridge metric: the
// share of composites whose NEW entry has no Enterprise ATT&CK id (it lives in ATLAS, which
// Enterprise does not incorporate, or in no framework) while the OLD propagation is a
// first-class Enterprise technique. That bridge is the gap no single matrix names.
export interface EmergingSummary {
  total: number;
  bridge_count: number;       // composites whose new entry is unmodeled by Enterprise ATT&CK
  bridge_pct: number;
  junctions: { node: string; count: number }[];
  merge_patterns: { pattern: string; count: number }[];
}
export function emergingSummary(ds: Dataset): EmergingSummary {
  const comp = predictComposites(ds, 100000); // full set, not the UI top-N
  const byId = new Map(ds.seams.map((s) => [s.id, s]));
  const unmodeled = (id: string) => {
    const s = byId.get(id);
    return !s || s.techniques.every((t) => !t.attack_ids || t.attack_ids.length === 0);
  };
  const junc = new Map<string, number>();
  const pat = new Map<string, number>();
  let bridge = 0;
  for (const c of comp) {
    junc.set(c.node, (junc.get(c.node) ?? 0) + 1);
    const k = `${c.primitives[0]}→${c.primitives[1]}`;
    pat.set(k, (pat.get(k) ?? 0) + 1);
    if (unmodeled(c.entry_seam)) bridge++;
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    total: comp.length,
    bridge_count: bridge,
    bridge_pct: comp.length ? Math.round((100 * bridge) / comp.length) : 0,
    junctions: top(junc, 6).map(([node, count]) => ({ node, count })),
    merge_patterns: top(pat, 6).map(([pattern, count]) => ({ pattern, count })),
  };
}
