// MITRE ATT&CK Enterprise coverage — measures the model against the full catalogue
// (data/mitre-attack.json, v17.1: 14 tactics, 211 base techniques, 468 sub-techniques).
// A base technique is COVERED if any seam references it or one of its sub-techniques.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Dataset, Seam } from "./types.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

export interface Mitre {
  tactics: { id: string; name: string }[];
  techniques: { id: string; name: string; tactics: string[]; is_subtechnique: boolean; parent: string | null }[];
}

export function loadMitre(): Mitre {
  return JSON.parse(readFileSync(join(DATA, "mitre-attack.json"), "utf8"));
}

function referencedIds(seams: Seam[]): Set<string> {
  const ref = new Set<string>();
  for (const s of seams) for (const t of s.techniques) for (const a of (t.attack_ids || [])) ref.add(a);
  return ref;
}

export function mitreCoverage(ds: Dataset, m: Mitre) {
  const ref = referencedIds(ds.seams);
  const subsByParent: Record<string, string[]> = {};
  for (const t of m.techniques) if (t.is_subtechnique && t.parent) (subsByParent[t.parent] ??= []).push(t.id);
  const base = m.techniques.filter((t) => !t.is_subtechnique);
  const isCovered = (t: { id: string }) => ref.has(t.id) || (subsByParent[t.id] || []).some((s) => ref.has(s));
  const covered = base.filter(isCovered);
  const uncovered = base.filter((t) => !isCovered(t));
  const tn = Object.fromEntries(m.tactics.map((t) => [t.id, t.name]));
  const perTactic: Record<string, { covered: number; total: number }> = {};
  for (const t of base) for (const tac of t.tactics) {
    (perTactic[tn[tac]] ??= { covered: 0, total: 0 }).total++;
    if (isCovered(t)) perTactic[tn[tac]].covered++;
  }
  return {
    base_total: base.length,
    base_covered: covered.length,
    base_uncovered: uncovered.length,
    pct: Number((covered.length / base.length).toFixed(3)),
    per_tactic: perTactic,
    uncovered_ids: uncovered.map((t) => t.id),
  };
}
