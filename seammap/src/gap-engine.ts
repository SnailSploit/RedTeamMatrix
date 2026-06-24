// THE GAP ENGINE — a first-class subsystem, not an end-of-run report.
// The map is always behind the frontier by construction; the gap engine reads the edge.
// Three jobs: (5.1) classify every absence, (5.2) self-audit for seams the brief missed,
// (5.3) auto-spawn frontier gaps when a new principal node appears.

import type {
  Dataset, Principal, Seam, Gap, GapType, PrimitiveId,
} from "./types.ts";
import { ALL_PRIMITIVES, pairKey, populatedPairs } from "./model.ts";

// ---------------------------------------------------------------------------
// Plausibility: does a directed trust relationship a -> b under primitive P even
// exist to be violated? "honest-na" = no plausible relationship (permanent blank,
// drawn deliberately). Everything plausible-but-empty is a real category of gap.
// ---------------------------------------------------------------------------

const CONDUITS = new Set(["doc", "web", "email"]);

function plausible(a: Principal, b: Principal, p: PrimitiveId): boolean {
  // A conduit has no trust of its own to violate: it is pure ingress. Never a target.
  if (CONDUITS.has(b.id)) return false;
  // Defense is modeled as a target (the detection-model seam), not an attack origin.
  if (b.class === "defense" && a.class === "defense") return false;
  // Conduits as sources only carry data/provenance/format payloads (P1/P3/P5), not
  // identity, context-inheritance, or time-state relationships.
  if (CONDUITS.has(a.id) && !(p === "P1" || p === "P3" || p === "P5")) return false;
  // A pure human->human relationship is social engineering: only the data->control primitive.
  if (a.class === "human" && b.class === "human" && p !== "P1") return false;
  return true;
}

function gapTypeFor(a: Principal, b: Principal): GapType {
  const aFront = a.maturity === "frontier";
  const bFront = b.maturity === "frontier";
  const aNew = a.maturity !== "mature";
  const bNew = b.maturity !== "mature";
  // Both endpoints are frontier surfaces -> anticipated 2026->2027 growth not yet real.
  if (aFront && bFront) return "projected";
  // At least one emerging/frontier endpoint -> surface exists < ~24 months, technique maturity ~0.
  if (aNew || bNew) return "frontier";
  // Both mature: the relationship is old but this specific seam has no public tooling/detection.
  return "under-tooled";
}

// 5.1 — Enumerate the whole (principal_pair x primitive) space and type every cell.
export function classifyPairSpace(ds: Dataset): {
  populated: number; honestNa: number; gaps: Gap[];
} {
  const populated = populatedPairs(ds.seams);
  const gaps: Gap[] = [];
  let pop = 0, na = 0;
  for (const a of ds.principals) {
    for (const b of ds.principals) {
      for (const p of ALL_PRIMITIVES) {
        if (populated.has(pairKey(a.id, b.id, p))) { pop++; continue; }
        if (!plausible(a, b, p)) { na++; continue; }
        gaps.push({
          id: `gap:${a.id}>${b.id}:${p}`,
          source: a.id, target: b.id, primitive: p,
          gap_type: gapTypeFor(a, b),
          origin: "seed",
        });
      }
    }
  }
  return { populated: pop, honestNa: na, gaps };
}

// 5.2 — The self-audit corpus is hand-reasoned and authored directly into seams.json
// (origin: AGENT-DISCOVERED) so each carries a real trust assumption, rationale, and
// suggested_research hook. This surfaces them as register entries, first-class.
export function agentDiscovered(ds: Dataset): Gap[] {
  return ds.seams
    .filter((s) => s.origin === "AGENT-DISCOVERED")
    .map((s) => ({
      id: `disc:${s.id}`,
      source: s.source[0],
      target: s.target[s.target.length - 1],
      primitive: s.primitive,
      gap_type: "frontier" as GapType,
      origin: "AGENT-DISCOVERED" as const,
      rationale: s.rationale,
      suggested_research: s.suggested_research,
      seam_id: s.id,
      validity: s.validation?.validity,
      confidence: s.validation?.confidence,
      validation_method: s.validation?.validation_method,
      falsifier: s.validation?.falsifier,
    }));
}

// The Gaps Register — a PRIMARY deliverable. Sorted frontier -> under-tooled ->
// AGENT-DISCOVERED -> projected, with AGENT-DISCOVERED and frontier surfaced first.
export function gapsRegister(ds: Dataset): Gap[] {
  const discovered = agentDiscovered(ds);
  const { gaps } = classifyPairSpace(ds);
  const order: Record<string, number> = {
    "frontier": 0, "under-tooled": 1, "projected": 3, "populated": 4, "honest-na": 5,
  };
  // The 14 hand-reasoned AGENT-DISCOVERED findings are the audit's actual output, so they
  // are surfaced FIRST (§6); the auto-typed bulk then follows frontier -> under-tooled ->
  // projected (§5.2 category order preserved).
  // Within AGENT-DISCOVERED, order by validity (demonstrated first) then confidence, so the
  // calibrated, evidence-backed gaps surface above the speculative ones.
  const vOrder: Record<string, number> = { demonstrated: 0, plausible: 1, speculative: 2 };
  const cOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const rank = (g: Gap) => g.origin === "AGENT-DISCOVERED"
    ? -1 + (vOrder[g.validity ?? "plausible"] * 0.01) + (cOrder[g.confidence ?? "medium"] * 0.001)
    : order[g.gap_type];
  const all: Gap[] = [...discovered, ...gaps];
  return all.sort((x, y) => {
    const rx = rank(x), ry = rank(y);
    if (rx !== ry) return rx - ry;
    return x.id.localeCompare(y.id);
  });
}

// 5.3 — AUTO-SPAWN. Adding a new principal spawns candidate edges to all existing
// principals across all six primitives, each marked frontier until a technique populates
// it. This is what keeps the map level with the edge instead of fossilizing.
export function autoSpawn(ds: Dataset, node: Principal): Gap[] {
  const spawned: Gap[] = [];
  for (const other of ds.principals) {
    for (const dir of [[node, other], [other, node]] as [Principal, Principal][]) {
      const [a, b] = dir;
      for (const p of ALL_PRIMITIVES) {
        if (!plausible(a, b, p)) continue;
        spawned.push({
          id: `spawn:${a.id}>${b.id}:${p}`,
          source: a.id, target: b.id, primitive: p,
          // A brand-new substrate's edges are frontier (or projected if both ends are frontier).
          gap_type: gapTypeFor(a, b) === "under-tooled" ? "frontier" : gapTypeFor(a, b),
          origin: "seed",
          rationale: `Auto-spawned when '${node.name}' was added: ${a.name} -> ${b.name} under ${p} is a candidate trust bridge with no populated technique yet.`,
        });
      }
    }
  }
  return spawned;
}

// Counts for the matrix/register headers and the build summary.
export function gapStats(reg: Gap[]): Record<GapType | "AGENT-DISCOVERED", number> {
  const out: any = { "frontier": 0, "under-tooled": 0, "projected": 0, "honest-na": 0, "populated": 0, "AGENT-DISCOVERED": 0 };
  for (const g of reg) {
    if (g.origin === "AGENT-DISCOVERED") out["AGENT-DISCOVERED"]++;
    else out[g.gap_type]++;
  }
  return out;
}
