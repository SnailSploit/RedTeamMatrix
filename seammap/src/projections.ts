// PROJECTIONS — the tree and the matrix are VIEWS over the one canonical hypergraph,
// not rival artifacts. They are generated from the seam dataset; editing a seam updates
// all three. Nothing here is hand-authored content.

import type {
  Dataset, Seam, GapType, PrimitiveId,
} from "./types.ts";
import { principalsOf } from "./model.ts";

// ---------------------------------------------------------------------------
// TREE PROJECTION — the flat coverage index (the old mind-map shape) for the
// checklist use case. Grouped by classic branch; every leaf links back to its seam.
// This is how "new doesn't cancel old" is made visible: every classic branch present.
// ---------------------------------------------------------------------------

export interface TreeLeaf { seam_id: string; label: string; primitive: PrimitiveId; kind: string; }
export interface TreeBranch { branch: string; honest_na?: string; leaves: TreeLeaf[]; }

export function buildTree(ds: Dataset): TreeBranch[] {
  const branches = ds.coverage.classic_branches;
  const naMap = new Map(ds.coverage.branch_honest_na.map((b) => [b.branch, b.reason]));
  const out: TreeBranch[] = [];
  for (const branch of branches) {
    const leaves: TreeLeaf[] = [];
    for (const s of ds.seams) {
      if (s.classic_branches.includes(branch)) {
        leaves.push({
          seam_id: s.id,
          label: s.techniques.map((t) => t.name).join(" / "),
          primitive: s.primitive,
          kind: s.kind,
        });
      }
    }
    out.push({ branch, honest_na: naMap.get(branch), leaves });
  }
  return out;
}

// ---------------------------------------------------------------------------
// MATRIX PROJECTION — principal x ATT&CK-tactic, cells computed from edges.
// Every empty cell is TYPED (honest-na | frontier | under-tooled | projected) and
// rendered as a deliberate state, never a plain blank (typing test).
// ---------------------------------------------------------------------------

export interface MatrixCell { gap_type: GapType; seam_ids: string[]; reason?: string; }
export interface Matrix {
  principals: string[];
  tactics: { id: string; name: string }[];
  cells: Record<string, Record<string, MatrixCell>>; // [principalId][tacticId]
}

const CONDUITS = new Set(["doc", "web", "email"]);
// Conduits only participate in ingress-side tactics; elsewhere they are honest-na.
const CONDUIT_TACTICS = new Set(["TA0043", "TA0042", "TA0001"]);

export function buildMatrix(ds: Dataset): Matrix {
  const idx = new Map(ds.principals.map((p) => [p.id, p]));
  const naCells = new Map(
    ds.coverage.honest_na_cells.map((c) => [`${c.principal}:${c.tactic}`, c.reason]),
  );
  const cells: Record<string, Record<string, MatrixCell>> = {};

  for (const p of ds.principals) {
    cells[p.id] = {};
    for (const t of ds.coverage.attack_tactics) {
      const hits = ds.seams.filter(
        (s) => principalsOf(s).includes(p.id) && s.tactics.includes(t.id),
      );
      if (hits.length > 0) {
        cells[p.id][t.id] = { gap_type: "populated", seam_ids: hits.map((s) => s.id) };
        continue;
      }
      // Typed empty cell.
      const declared = naCells.get(`${p.id}:${t.id}`);
      if (declared) {
        cells[p.id][t.id] = { gap_type: "honest-na", seam_ids: [], reason: declared };
        continue;
      }
      if (CONDUITS.has(p.id) && !CONDUIT_TACTICS.has(t.id)) {
        cells[p.id][t.id] = {
          gap_type: "honest-na", seam_ids: [],
          reason: `${idx.get(p.id)!.name} is an ingress conduit; it has no trust surface for this tactic.`,
        };
        continue;
      }
      const mat = idx.get(p.id)!.maturity;
      const gt: GapType = mat === "mature" ? "under-tooled" : (mat === "frontier" ? "frontier" : "frontier");
      cells[p.id][t.id] = { gap_type: gt, seam_ids: [] };
    }
  }

  return {
    principals: ds.principals.map((p) => p.id),
    tactics: ds.coverage.attack_tactics,
    cells,
  };
}

// Convenience: does every empty matrix cell carry a gap-type? (used by the typing test)
export function everyCellTyped(m: Matrix): boolean {
  for (const pid of m.principals) {
    for (const t of m.tactics) {
      const c = m.cells[pid]?.[t.id];
      if (!c || !c.gap_type) return false;
    }
  }
  return true;
}
