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
- **Self-audit for what the brief — and MITRE — missed.** **49 `AGENT-DISCOVERED`** current-gap seams, each with a
  distinct trust assumption, a rationale, and a `suggested_research` hook. They come from re-decomposing the 8 frontier
  seams, walking the diagonals between emerging node-pairs, and three gap-hunting sweeps for present-day seams with
  little/no public tooling **and** no detection — including seams ATT&CK does not model: AI-ecosystem (computer-use
  pixel/DOM trust, multimodal-metadata injection, LoRA-adapter provenance, prompt-cache timing, RAG citation spoof),
  enterprise defense-automation (SOAR playbook-field injection, detection-as-code poisoning, passkey sync-fabric
  downgrade, SLSA provenance-scope gaps, TEE attestation freshness), and AI×physical convergence (agent→OT HMI
  impersonation, agent→CAN fleet actuation, audio-channel injection into vehicle agents, embodied-agent perception spoof).
- **Auto-spawn.** Adding a principal spawns candidate edges to all existing principals across all six primitives,
  marked `frontier` until a technique populates them (`src/spawn-demo.ts` demos a 2027 "Agent Marketplace" node →
  fresh gap edges). This is what keeps the map level with the edge instead of fossilizing.

The **Gaps Register** is a primary deliverable, equal in weight to the graph: AGENT-DISCOVERED surfaced first,
then `frontier → under-tooled → projected`.

## Validation & recalibration (`data/validations.json`)

A discovered gap is worthless if you can't tell whether it's real. Every one of the **96
AGENT-DISCOVERED gaps** was put through adversarial validation: a concrete **falsifiable test**
(`validation_method`), the observation that would **refute** it (`falsifier`), the prerequisites
and existing controls, a skeptical **validity** verdict (`demonstrated` / `plausible` /
`speculative`), and a **recalibration** of maturity/tooling/detection to reality. `model.ts` joins
this onto the seams at load and applies the recalibration, so the scorer, matrix, and predictor all
reflect calibrated confidence — not raw enthusiasm. Current verdicts: **30 demonstrated, 55 plausible,
11 speculative**; recalibration moved 86/96 gaps off the raw `frontier/none/none` they were authored
with. The Gaps view sorts demonstrated-first and exposes the test + refuter on every card.

## Red-team validation kit (`data/artifacts.json`) + closed-loop run harness

A gap you can't test is a claim. **127 seams ship a runnable, authorization-gated validation
artifact** — self-contained lab PoCs, config audits, or simulation/receive-only harnesses
(RF/space/OT/automotive stay simulated or shielded-bench; no live transmit, no real safety
systems). Every one of the **96 discovered gaps** has a PoC. `run-pocs.cjs` then *executes* the
safe self-contained Python PoCs in isolation and records `confirmed/error/inconclusive` to
`data/poc-results.json` (**99 confirmed by execution**), which `model.ts` joins onto each
artifact — turning "PoC exists" into measured run-data.

## The data-driven optimizer (`src/optimize.ts`)

The scheduler, matured into a closed loop. Each seam's **priority = yield ÷ effort**, computed
*only* from its data layers — validity verdict, detection/tooling gap, operator weights, maturity,
and PoC presence/confirmation — each priority carrying explainable **drivers** (`undetected`,
`demonstrated`, `poc-confirmed`, `scalable+auto+ai`, `frontier`). `optimizeUnderBudget()` solves a
budget-constrained optimal set ("best edges to operationalize under N effort"); `coverage()`
self-measures how data-driven the model is (PoC % / validated %). As validations and PoC results
are added, the ranking re-optimizes automatically — the **Optimize view** renders the live queue.

## The composition predictor (`src/compose.ts`)

The merge of old and new tech yields emergent vulnerabilities that look unpredictable — but a typed graph **predicts
them mechanically**. A composite is a **frontier (undetected, ~0-tooling) entry seam** whose target is node *n* feeding
a **mature (proven, well-tooled) propagation seam** whose source is *n*: enter through the new surface nobody monitors
yet, then fire a reliable classic from there. The predictor enumerates every such old×new pair sharing a node and ranks
them by amplification (entry's lack of detection × propagation's reliability × cross-primitive novelty). Top hits: an
*autonomous-IAM* entry → classic *S3 enumeration*; an *MCP confused-deputy* entry → *Evilginx session capture*.

## The scheduler (`src/scheduler.ts`)

Path-search over violable edges; the map is the read-only action space, the scheduler is the running process that
selects which edge to attack next. Pluggable `Scorer` interface + two reference scorers:

- `CLS = (S·D·C) / ((A+1)(H+1)) · M · T · 0.4`
- `EGQ = (T_shift + I_trust) / (E_strict + 1)` → `EGQ ≥ 2` flags a real candidate.

Every scoring input is derived from a seam property (operator weights, maturity, detection status) — no magic
numbers. Path priority gives frontier edges a bonus: research yield is highest on freshly-spawned edges.

## Views (`web/`) — projections of the one dataset

Open `web/index.html` (static, no backend; cytoscape is vendored at `web/vendor/`, so it works offline). Eight views
over `web/dataset.json`, toggle without losing state:

- **Graph** — force-directed typed hypergraph. Edge color = primitive; dashed = frontier; glow = scalable+auto+ai;
  node ring = maturity; hyperedges rendered through a relay node so multi-party reads as multi-party. Click → detail.
- **Matrix** — principal × ATT&CK tactic, cells computed from edges; every empty cell typed and rendered as a
  deliberate state (gaps cluster: Identity dense mid-chain, AI dense left / sparse right, AD blank on C2/exfil).
- **Tree** — the flat coverage index (old mind-map shape), generated; every classic branch present and re-homed,
  every source-map leaf re-homed to a seam (enforced by the leaf-coverage test).
- **Gaps** — the register, filterable by type/primitive/text; AGENT-DISCOVERED and frontier first.
- **Predict** — ranked emergent composites from `src/compose.ts` (old×new merges the graph predicts).
- **Optimize** — the data-driven priority queue (yield÷effort) + coverage + budget-constrained optimum.
- **Discover** — relation-graph located new threats (analogical transfer / transitive chain / structural hole), each with its structural reason.
- **Path** — pick source + target principal; scored traversals (kill chains); multiple parallel paths surfaced.

## Run it

```bash
node merge.cjs              # assemble canonical seams.json = seams.core.json (migrated) + data/_ext_*.json
node merge-validations.cjs # assemble data/validations.json from data/_val_*.json (gap validity + recalibration)
node merge-artifacts.cjs   # assemble data/artifacts.json from data/_art_*.json (red-team validation PoCs)
node run-pocs.cjs          # execute safe self-contained PoCs -> data/poc-results.json (closed-loop run data)
node src/build.ts          # render projections + gaps + composites + priorities -> web/dataset.json
node src/validate.ts       # 21 definition-of-done invariants (exits non-zero on violation)
node src/optimize-demo.ts  # data-driven priority queue + budget-constrained optimum
node src/spawn-demo.ts # demonstrate the auto-spawn rule on a hypothetical 2027 node
node shot.cjs          # (optional, dev) headless-render all six views to shot-*.png
# then open web/index.html in a browser
```

The canonical corpus is **241 seams across 21 principals and 6 primitives** (classic techniques re-homed + 8 named
frontier seams decomposed + **49 AGENT-DISCOVERED current gaps**), spanning 27 substantive branches (the source map's
kill-chain plus categories it lacked: Identity & Federation, CI/CD, API/business-logic, Email/collaboration,
Crypto/PKI, Cloud, Container, OPSEC, AI/Agent, and the OT/Mobile/Hardware/Automotive/Wireless domains). Edit
`seams.core.json` or any `data/_ext_*.json`, re-run `merge.cjs`, and all views update.

Requires Node ≥ 22 (runs the TypeScript directly via type-stripping; no build step). Standards: exact ATT&CK IDs
and CWE numbers where known — approximate is worse than nothing; every seam carries a distinct trust assumption or
it is padding and is cut (checked by `validate.ts`).
