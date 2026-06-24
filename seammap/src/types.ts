// Canonical type system for the SEAMMAP trust hypergraph.
// Nodes = principals. Edges = seam-typed trust relationships. Vulnerabilities = violable edges.
// The six primitives are a CLOSED set; the agent era added no seventh.

export type PrimitiveId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
export type PrincipalClass = "substrate" | "human" | "defense" | "broker" | "conduit";
export type Maturity = "mature" | "emerging" | "frontier";
export type SeamKind = "classic" | "frontier";
export type Origin = "seed" | "AGENT-DISCOVERED";
export type Status = "mature" | "available" | "partial" | "nascent" | "none";

// A blank is not one thing. Every absence is typed.
export type GapType = "populated" | "honest-na" | "frontier" | "under-tooled" | "projected";

export interface Primitive {
  id: PrimitiveId;
  name: string;
  color: string;
  definition: string;
  classic_exemplars: string[];
  agent_era_note: string;
}

export interface Principal {
  id: string;
  name: string;
  class: PrincipalClass;
  era_introduced: number;
  maturity: Maturity;
  note?: string;
}

export interface Technique {
  name: string;
  attack_ids: string[];
  cwe_ids: string[];
}

// Operator axis = edge weights, not nodes. AI is a transform over edges, not a branch.
export interface OperatorWeights {
  scalable: number;     // 1->N at marginal cost
  automatable: number;  // no human in the loop
  ai_augmentable: number; // an LLM does the attacker's cognitive work
}

export type Validity = "demonstrated" | "plausible" | "speculative";
export type Confidence = "high" | "medium" | "low";

// Adversarial-validation result attached to a discovered gap: how to determine the seam is
// real (falsifiable), what would refute it, and a skeptical validity verdict that recalibrates
// the seam's maturity/tooling/detection to reality.
export interface ValidationInfo {
  validation_method: string;
  falsifier: string;
  prerequisites?: string;
  existing_controls?: string;
  validity: Validity;
  confidence: Confidence;
  recalibrate?: { maturity?: Maturity; tooling_status?: Status; detection_status?: Status };
}

export interface Seam {
  id: string;
  primitive: PrimitiveId;
  kind: SeamKind;
  parent?: string;          // frontier sub-seam -> its named §3 parent
  source: string[];         // principal ids
  target: string[];         // principal ids; length >= 2 => hyperedge frame
  maturity: Maturity;
  tactics: string[];        // ATT&CK tactic ids served
  classic_branches: string[]; // mind-map branches re-homed here
  trust_assumption: string;
  violation: string;
  techniques: Technique[];
  operator: OperatorWeights;
  tooling_status: Status;
  detection_status: Status;
  origin: Origin;
  rationale?: string;          // AGENT-DISCOVERED only
  suggested_research?: string; // AGENT-DISCOVERED only
  validation?: ValidationInfo; // attached at load from validations.json
}

export interface FrontierSeam {
  id: string;
  name: string;
  primitive: string;
  exploded_from: PrimitiveId;
  summary: string;
  edge: string;
}

// A gap is a typed absence in (principal_pair x primitive) space, or a hand-authored
// AGENT-DISCOVERED seam surfaced into the register.
export interface Gap {
  id: string;
  source: string;
  target: string;
  primitive: PrimitiveId;
  gap_type: GapType;          // frontier | under-tooled | honest-na | projected
  origin: Origin;
  rationale?: string;
  suggested_research?: string;
  seam_id?: string;           // present when this gap is backed by an authored seam
  validity?: Validity;        // adversarial-validation verdict (AGENT-DISCOVERED)
  confidence?: Confidence;
  validation_method?: string;
  falsifier?: string;
}

export interface ClassicCoverage {
  classic_branches: string[];
  attack_tactics: { id: string; name: string }[];
  branch_honest_na: { branch: string; reason: string }[];
  honest_na_cells: { principal: string; tactic: string; reason: string }[];
}

export interface Dataset {
  primitives: Primitive[];
  principals: Principal[];
  seams: Seam[];
  frontier_seams: FrontierSeam[];
  coverage: ClassicCoverage;
}
