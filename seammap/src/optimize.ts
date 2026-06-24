// DATA-DRIVEN OPTIMIZER — the program's scheduler matured into a closed loop.
// Every seam now carries observable DATA: validity verdict, confidence, detection gap,
// tooling gap, operator weights, maturity, and whether a runnable PoC exists/confirmed.
// This module turns those layers into an optimized priority — "what to operationalize next" —
// and a budget-constrained optimal SET. It is data-driven by construction: priorities move
// as validations and PoC results are added, so the model self-optimizes as coverage grows.

import type { Dataset, Seam } from "./types.ts";

const detGap: Record<string, number> = { none: 1, nascent: 0.8, partial: 0.5, available: 0.4, mature: 0.15 };
const toolReady: Record<string, number> = { mature: 1, available: 0.85, partial: 0.6, nascent: 0.4, none: 0.25 };
const validityWeight: Record<string, number> = { demonstrated: 1, plausible: 0.7, speculative: 0.3 };
const confWeight: Record<string, number> = { high: 1, medium: 0.75, low: 0.5 };

export interface Priority {
  id: string;
  primitive: string;
  score: number;       // data-driven yield-per-effort
  yield: number;       // expected research/operational value
  effort: number;      // expected cost to operationalize
  drivers: string[];   // which data layers drove the score (explainability)
}

// Yield = how much an operator/researcher gains by working this edge, computed ONLY from data
// already in the model (no hand-set magic): blast (operator weights + frame), opportunity
// (detection gap), actionability (validity x confidence, PoC-confirmed boost), freshness.
function components(s: Seam) {
  const op = s.operator;
  const blast = 1 + op.scalable + op.automatable + op.ai_augmentable + (s.target.length - 1) * 0.5;
  const opportunity = detGap[s.detection_status] ?? 0.5;          // undetected => higher yield
  const v = s.validation;
  const actionability = v ? validityWeight[v.validity] * confWeight[v.confidence] : 0.6;
  const pocConfirmed = s.test_artifact?.result === "confirmed" ? 1.25 : (s.test_artifact ? 1.1 : 1);
  const freshness = s.maturity === "frontier" ? 1.3 : s.maturity === "emerging" ? 1.1 : 1;
  // Effort falls when tooling already exists and the technique is mature/known.
  const effort = 1 / (toolReady[s.tooling_status] ?? 0.5) * (s.maturity === "frontier" ? 1.4 : 1);
  const y = blast * opportunity * actionability * pocConfirmed * freshness;
  return { blast, opportunity, actionability, pocConfirmed, freshness, effort, y };
}

export function priorityOf(s: Seam): Priority {
  const c = components(s);
  const drivers: string[] = [];
  if (c.opportunity >= 0.8) drivers.push("undetected");
  if (s.validation?.validity === "demonstrated") drivers.push("demonstrated");
  if (s.test_artifact) drivers.push(s.test_artifact.result === "confirmed" ? "poc-confirmed" : "poc-exists");
  if (s.operator.scalable && s.operator.automatable && s.operator.ai_augmentable) drivers.push("scalable+auto+ai");
  if (s.maturity === "frontier") drivers.push("frontier");
  return {
    id: s.id, primitive: s.primitive,
    score: Number((c.y / c.effort).toFixed(2)),
    yield: Number(c.y.toFixed(2)), effort: Number(c.effort.toFixed(2)),
    drivers,
  };
}

export function rankPriorities(ds: Dataset, limit = 30): Priority[] {
  return ds.seams.map(priorityOf).sort((a, b) => b.score - a.score).slice(0, limit);
}

// Budget-constrained optimization: greedily pick the set of seams that maximizes total yield
// while keeping summed effort within `budget`. A concrete, data-driven optimization (the
// operator's "given N units of effort, where do I get the most" query).
export function optimizeUnderBudget(ds: Dataset, budget: number): { selected: Priority[]; totalYield: number; totalEffort: number } {
  const ranked = ds.seams.map(priorityOf).sort((a, b) => b.score - a.score);
  const selected: Priority[] = [];
  let spent = 0, gained = 0;
  for (const p of ranked) {
    if (spent + p.effort > budget) continue;
    selected.push(p); spent += p.effort; gained += p.yield;
  }
  return { selected, totalYield: Number(gained.toFixed(2)), totalEffort: Number(spent.toFixed(2)) };
}

// Data-coverage metrics — the program's self-measurement of how data-driven it currently is.
export function coverage(ds: Dataset) {
  const n = ds.seams.length;
  const withArtifact = ds.seams.filter((s) => s.test_artifact).length;
  const confirmed = ds.seams.filter((s) => s.test_artifact?.result === "confirmed").length;
  const validated = ds.seams.filter((s) => s.validation).length;
  return {
    seams: n,
    artifact_coverage: Number((withArtifact / n).toFixed(3)),
    poc_confirmed: confirmed,
    validation_coverage: Number((validated / n).toFixed(3)),
  };
}
