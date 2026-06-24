# SEAMMAP

SEAMMAP models offense as **violations of trust relationships**, not as a list of techniques. Six seam
primitives, an open set of principals, classic techniques re-homed and frontier seams attached to the same
primitives — rendered as a hypergraph that keeps pace with the edge by spawning its own gaps and auditing for
the ones nobody wrote down yet.

## The model (read this first)

A **seam** is a directed trust relationship where one component consumes another's output, identity, or context
and treats it as more trustworthy than an attacker can guarantee. Every CVE ever written is a violation of a
seam. A cell in a tactic×substrate matrix is a *place*; a seam is the *relationship* that actually breaks. So the
honest representation is a typed, directed **trust hypergraph**:

- **Nodes** = principals (substrates + the human + the SOC + brokers + conduits). `data/principals.json`
- **Edges** = seam-typed trust relationships. `data/seams.json`
- **Vulnerabilities** = violable edges. **Attacks** = paths through edges (`src/scheduler.ts`).
- **Frontier** = graph growth: a new substrate spawns a node; a new integration spawns edges (`autoSpawn`).
- **Operator axis** (AI / automation / scale) = edge *weights*, not nodes. AI is a transform over edges.
- **Hypergraph, not graph**: multi-party seams (confused-deputy is triadic; MCP mediation is 4-party) are
  hyperedges whose target frame spans ≥2 principals — because the multi-party-ness is exactly where the seam
  hides (no single party sees the whole frame).

### The six primitives (closed set — `data/primitives.json`)

| | primitive | input parsed as… | classic exemplars |
|---|---|---|---|
| **P1** | Data→Control | instruction | SQLi, XSS, SSTI, deserialization, command/prompt injection |
| **P2** | Identity→Authority | privilege held by the wrong party | confused deputy, SSRF, CSRF, token replay, IMDS, delegation |
| **P3** | Provenance | trust in a forgeable origin | supply chain, webhook bypass, open redirect, dependency confusion |
| **P4** | Context-Inheritance | inherited parent trust | container composition, session fixation, memory carryover |
| **P5** | Format-Boundary | meaning shifted across a parser | request smuggling, zip slip, unicode, CWE-88 arg injection |
| **P6** | Time/State | true-at-check, false-at-use | TOCTOU, race, replay, idempotency failure |

The agent era added **no seventh primitive**. It exploded edge/node count for P1 and P2 and inverted blast radius.

### Two structural invariants (enforced by `src/validate.ts`)

1. **New does not cancel old.** Every classic technique (LSASS, AD CS ESC1–16, SQLi, smuggling, Kerberoasting)
   is *re-homed* under one of the six primitives, never deleted. The 8 named 2027 frontier seams
   (`data/frontier-seams.json`) attach to the same six. Old and new coexist under one type system.
2. **The model is canonical; tree and matrix are projections.** One hypergraph; the tree (flat coverage index)
   and matrix (kill-chain view) are *generated* from it (`src/projections.ts`), not authored.

## The gap engine (`src/gap-engine.ts`) — the point of the artifact

The map is always behind the frontier by construction; the gap engine reads the edge. Three jobs:

- **Classify every absence.** Enumerate `principal_pair × primitive`; type every empty cell —
  `honest-na` (no plausible trust relationship, permanent), `frontier` (surface <~24 months, maturity ≈ 0),
  `under-tooled` (research exists, no public tooling/detection), `projected` (anticipated 2026→2027 growth).
  A blank is never one thing.
- **Self-audit for what the brief missed.** 14 `AGENT-DISCOVERED` seams — each with a distinct trust assumption,
  a rationale, and a `suggested_research` hook — surfaced from re-decomposing the 8 frontier seams and walking the
  diagonals between every emerging node-pair (e.g. *MCP transport desync*, *agent-memory cross-tenant bleed*,
  *inter-agent trust-token forgery*, *memory-pinned supply-chain redirection*, *SOC-copilot retrieval injection*).
- **Auto-spawn.** Adding a principal spawns candidate edges to all existing principals across all six primitives,
  marked `frontier` until a technique populates them (`src/spawn-demo.ts` demos a 2027 "Agent Marketplace" node →
  165 fresh gap edges). This is what keeps the map level with the edge instead of fossilizing.

The **Gaps Register** is a primary deliverable, equal in weight to the graph: AGENT-DISCOVERED surfaced first,
then `frontier → under-tooled → projected`.

## The scheduler (`src/scheduler.ts`)

Path-search over violable edges; the map is the read-only action space, the scheduler is the running process that
selects which edge to attack next. Pluggable `Scorer` interface + two reference scorers:

- `CLS = (S·D·C) / ((A+1)(H+1)) · M · T · 0.4`
- `EGQ = (T_shift + I_trust) / (E_strict + 1)` → `EGQ ≥ 2` flags a real candidate.

Every scoring input is derived from a seam property (operator weights, maturity, detection status) — no magic
numbers. Path priority gives frontier edges a bonus: research yield is highest on freshly-spawned edges.

## Views (`web/`) — projections of the one dataset

Open `web/index.html` (static, no backend). Five views over `web/dataset.json`, toggle without losing state:

- **Graph** — force-directed typed hypergraph. Edge color = primitive; dashed = frontier; glow = scalable+auto+ai;
  node ring = maturity; hyperedges rendered through a relay node so multi-party reads as multi-party. Click → detail.
- **Matrix** — principal × ATT&CK tactic, cells computed from edges; every empty cell typed and rendered as a
  deliberate state (gaps cluster: Identity dense mid-chain, AI dense left / sparse right, AD blank on C2/exfil).
- **Tree** — the flat coverage index (old mind-map shape), generated; every classic branch present and re-homed,
  every leaf links back to its seam.
- **Gaps** — the register, filterable by type/primitive/text; AGENT-DISCOVERED and frontier first.
- **Path** — pick source + target principal; scored traversals (kill chains); multiple parallel paths surfaced.

## Run it

```bash
node src/build.ts      # render projections + gap register -> web/dataset.json
node src/validate.ts   # definition-of-done invariants (exits non-zero on violation)
node src/spawn-demo.ts # demonstrate the auto-spawn rule on a hypothetical 2027 node
# then open web/index.html in a browser
```

Requires Node ≥ 22 (runs the TypeScript directly via type-stripping; no build step). Standards: exact ATT&CK IDs
and CWE numbers where known — approximate is worse than nothing; every seam carries a distinct trust assumption or
it is padding and is cut (checked by `validate.ts`).
