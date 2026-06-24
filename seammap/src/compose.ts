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
