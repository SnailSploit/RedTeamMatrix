// RELATION-GRAPH THREAT DISCOVERY — locate UNWRITTEN threats from the structure of the
// trust graph itself, not by flat cell-enumeration. Three relational signals, each with an
// explicit structural reason an analyst can audit:
//
//  1. ANALOGICAL TRANSFER — if primitive P holds on edge A->B, and node A' is structurally
//     similar to A (same class, overlapping primitive profile), then A'->B under P is a
//     likely-real but unwritten threat: the seam "transfers" along node similarity.
//  2. TRANSITIVE TRUST CHAIN — an untrusted-origin node reaches N (any seam), and N holds a
//     privileged seam into a sink, with no re-validation seam at N: the composition is a
//     located threat through N (a trust laundering point).
//  3. STRUCTURAL HOLE — a plausible, empty edge between two HIGH-DEGREE nodes whose
//     neighborhoods otherwise densely connect: the graph "expects" an edge the corpus lacks.

import type { Dataset, Principal, Seam, PrimitiveId } from "./types.ts";
import { ALL_PRIMITIVES, populatedPairs, pairKey } from "./model.ts";
import { plausible } from "./gap-engine.ts";

interface Located {
  id: string;
  kind: "analogical-transfer" | "transitive-chain" | "structural-hole";
  source: string; target: string; primitive: PrimitiveId;
  reason: string;          // the structural justification
  score: number;
  basis?: string;          // the existing seam(s) the discovery is reasoned from
}

// Per-node profile: class + the set of primitives it participates in + incident degree.
function profiles(ds: Dataset) {
  const prof = new Map<string, { cls: string; prims: Set<string>; nbrs: Set<string>; deg: number }>();
  for (const p of ds.principals) prof.set(p.id, { cls: p.class, prims: new Set(), nbrs: new Set(), deg: 0 });
  for (const s of ds.seams) {
    const frame = [...new Set([...s.source, ...s.target])];
    for (const a of frame) {
      const e = prof.get(a); if (!e) continue;
      e.prims.add(s.primitive); e.deg++;
      for (const b of frame) if (b !== a) e.nbrs.add(b);
    }
  }
  return prof;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter((x) => b.has(x)).length;
  const uni = new Set([...a, ...b]).size;
  return uni ? inter / uni : 0;
}

// Structural similarity requires BOTH a shared primitive profile AND a shared neighborhood —
// so "every substrate looks alike" is rejected; only nodes that play the same role amid the
// same partners (agent~mcp, vectorstore~memory, ot~auto~hardware) score high.
function similarity(pa: any, pb: any): number {
  const role = pa.cls === pb.cls ? 0.2 : 0;
  return role + 0.4 * jaccard(pa.prims, pb.prims) + 0.4 * jaccard(pa.nbrs, pb.nbrs);
}

const UNTRUSTED_ORIGINS = new Set(["web", "doc", "email", "wireless", "supplychain", "chain"]);
const PRIVILEGED_SINKS = new Set(["cloud", "ad", "host", "identity", "ot", "container"]);

export function discoverThreats(ds: Dataset, opts = { simThreshold: 0.55, limit: 40 }): Located[] {
  const prof = profiles(ds);
  const idx = new Map(ds.principals.map((p) => [p.id, p]));
  const populated = populatedPairs(ds.seams);
  const out: Located[] = [];
  const seen = new Set<string>();
  const add = (l: Located) => { if (!seen.has(l.id)) { seen.add(l.id); out.push(l); } };

  // ---- 1. analogical transfer ----
  const ids = ds.principals.map((p) => p.id);
  for (const s of ds.seams) {
    for (const A of s.source) for (const B of s.target) {
      if (A === B) continue;
      for (const Ap of ids) {
        if (Ap === A || Ap === B) continue;
        const sim = similarity(prof.get(A), prof.get(Ap));
        if (sim < opts.simThreshold) continue;
        const a = idx.get(Ap)!, b = idx.get(B)!;
        if (!plausible(a, b, s.primitive)) continue;
        if (populated.has(pairKey(Ap, B, s.primitive))) continue;
        add({
          id: `xfer:${Ap}>${B}:${s.primitive}`, kind: "analogical-transfer",
          source: Ap, target: B, primitive: s.primitive,
          reason: `${idx.get(Ap)!.name} is structurally similar to ${idx.get(A)!.name} (sim ${sim.toFixed(2)}; same class / shared primitive profile), which already holds "${(s.techniques[0]||{} as any).name}". The seam likely transfers but is unwritten.`,
          score: Number((sim * (s.kind === "frontier" ? 1.3 : 1)).toFixed(3)), basis: s.id,
        });
      }
    }
  }

  // ---- 2. transitive trust chains (untrusted-origin -> N -> privileged-sink) ----
  const outAdj = new Map<string, Seam[]>();
  for (const s of ds.seams) for (const a of s.source) (outAdj.get(a) ?? outAdj.set(a, []).get(a)!).push(s);
  // N is a meaningful laundering point only if it can carry influence (broker/agent/identity/
  // substrate), and only INFLUENCE-bearing in-edges (data/identity/provenance/context) count.
  const INFLUENCE = new Set(["P1", "P2", "P3", "P4"]);
  for (const N of ids) {
    const inFromUntrusted = ds.seams.filter((s) =>
      s.target.includes(N) && INFLUENCE.has(s.primitive) && s.source.some((x) => UNTRUSTED_ORIGINS.has(x) && x !== N));
    const outToPriv = (outAdj.get(N) ?? []).filter((s) => s.target.some((x) => PRIVILEGED_SINKS.has(x) && x !== N));
    if (!inFromUntrusted.length || !outToPriv.length) continue;
    for (const inS of inFromUntrusted) for (const outS of outToPriv) {
      const sink = outS.target.find((x) => PRIVILEGED_SINKS.has(x) && x !== N)!;
      const src = inS.source.find((x) => UNTRUSTED_ORIGINS.has(x))!;
      add({
        id: `chain:${src}>${N}>${sink}`, kind: "transitive-chain",
        source: src, target: sink, primitive: outS.primitive,
        reason: `${idx.get(src)!.name} (untrusted) reaches ${idx.get(N)!.name} via "${(inS.techniques[0]||{} as any).name}", and ${idx.get(N)!.name} holds a privileged seam into ${idx.get(sink)!.name}. ${idx.get(N)!.name} launders untrusted input into privileged action with no re-validation between.`,
        score: Number((1 + (inS.kind === "frontier" || outS.kind === "frontier" ? 0.4 : 0)).toFixed(3)),
        basis: `${inS.id}+${outS.id}`,
      });
    }
  }

  // ---- 3. structural holes (dense-neighborhood missing plausible edge) ----
  const degRank = [...prof.entries()].sort((a, b) => b[1].deg - a[1].deg).slice(0, 8).map(([id]) => id);
  for (const A of degRank) for (const B of degRank) {
    if (A === B) continue;
    for (const p of ALL_PRIMITIVES) {
      const a = idx.get(A)!, b = idx.get(B)!;
      if (!plausible(a, b, p)) continue;
      if (populated.has(pairKey(A, B, p))) continue;
      add({
        id: `hole:${A}>${B}:${p}`, kind: "structural-hole",
        source: A, target: B, primitive: p,
        reason: `${idx.get(A)!.name} and ${idx.get(B)!.name} are both high-degree hubs (deg ${prof.get(A)!.deg}/${prof.get(B)!.deg}) densely connected to shared neighbors, yet no ${p} seam exists between them — a hole the graph's topology predicts should be populated.`,
        score: 0.5,
      });
    }
  }

  // Balanced output: top results PER discovery mode so all three signals surface, then ranked.
  const perKind = Math.max(6, Math.floor(opts.limit / 3));
  const kept: Located[] = [];
  for (const k of ["analogical-transfer", "transitive-chain", "structural-hole"] as const) {
    kept.push(...out.filter((x) => x.kind === k).sort((a, b) => b.score - a.score).slice(0, perKind));
  }
  return kept.sort((a, b) => b.score - a.score);
}
