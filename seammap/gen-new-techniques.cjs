// Generates docs/NEW-TECHNIQUES.md — the complete reference of every AGENT-DISCOVERED
// (new) technique in SEAMMAP, straight from the data. Run: node gen-new-techniques.cjs
const fs = require("fs"), path = require("path");
const seams = JSON.parse(fs.readFileSync(path.join(__dirname, "data/seams.json"), "utf8")).seams;
const prims = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, "data/primitives.json"), "utf8")).primitives.map((p) => [p.id, p.name]));
const validations = JSON.parse(fs.readFileSync(path.join(__dirname, "data/validations.json"), "utf8"));
for (const s of seams) if (validations[s.id]) s.validation = validations[s.id];

const GROUPS = [
  { key: "seed", title: "Seed self-audit — frontier sub-seams & node-pair diagonals", match: (s) => /^(F\d|X-)/.test(s.id) },
  { key: "GH1", title: "Round 1 — AI / agent ecosystem", match: (s) => s.id.startsWith("GH1-") },
  { key: "GH2", title: "Round 2 — Enterprise defense-automation", match: (s) => s.id.startsWith("GH2-") },
  { key: "GH3", title: "Round 3 — AI × physical / embedded convergence", match: (s) => s.id.startsWith("GH3-") },
  { key: "GH4", title: "Round 4 — Data-centric / privacy / identity sprawl", match: (s) => s.id.startsWith("GH4-") },
  { key: "GH5", title: "Round 5 — Crypto migration / edge / telecom", match: (s) => s.id.startsWith("GH5-") },
  { key: "GH6", title: "Round 6 — Decentralized / Web3", match: (s) => s.id.startsWith("GH6-") },
  { key: "GH7", title: "Round 7 — PNT / space / cyber-physical", match: (s) => s.id.startsWith("GH7-") },
  { key: "GH8", title: "Round 8 — AI supply-chain / developer-trust", match: (s) => s.id.startsWith("GH8-") },
  { key: "GH9", title: "Round 9 — SaaS-to-SaaS / integration economy", match: (s) => s.id.startsWith("GH9-") },
  { key: "GH10", title: "Round 10 — Data / secrets / MLOps infrastructure", match: (s) => s.id.startsWith("GH10-") },
];

const disc = seams.filter((s) => s.origin === "AGENT-DISCOVERED");
const mitreAbsent = (s) => s.techniques.every((t) => !t.attack_ids || t.attack_ids.length === 0);
const vlabel = (s) => s.validation ? `${s.validation.validity} · ${s.validation.confidence} confidence` : "unrated";
const vrank = { demonstrated: 0, plausible: 1, speculative: 2 };

let md = `# SEAMMAP — New Techniques (AGENT-DISCOVERED)

Every entry below is a trust seam the source taxonomy did **not** enumerate, surfaced by the gap engine's
self-audit and eight gap-hunting rounds. Each was put through adversarial validation (a falsifiable test,
a refuter, and a skeptical validity verdict) and carries a red-team validation artifact in the model.

**${disc.length} new techniques** · **${disc.filter(mitreAbsent).length} carry no MITRE ATT&CK technique id** (genuinely unmodeled).
Validity: ${disc.filter((s) => s.validation?.validity === "demonstrated").length} demonstrated ·
${disc.filter((s) => s.validation?.validity === "plausible").length} plausible ·
${disc.filter((s) => s.validation?.validity === "speculative").length} speculative.

> Generated from \`data/seams.json\` + \`data/validations.json\` by \`gen-new-techniques.cjs\`. Do not hand-edit.

`;

let n = 0;
for (const g of GROUPS) {
  const items = disc.filter(g.match).sort((a, b) => (vrank[a.validation?.validity] ?? 3) - (vrank[b.validation?.validity] ?? 3));
  if (!items.length) continue;
  md += `\n## ${g.title}  *(${items.length})*\n`;
  for (const s of items) {
    n++;
    const t = s.techniques[0] || {};
    const refs = [...(t.attack_ids || []), ...(t.cwe_ids || [])].join(", ") || "—";
    const mitre = mitreAbsent(s) ? "**MITRE: none (unmodeled)**" : `MITRE/CWE: ${refs}`;
    md += `\n### ${n}. [${s.primitive} ${prims[s.primitive]}] ${t.name || s.id}\n`;
    md += `\`${s.id}\` · ${s.source.join("+")} → ${s.target.join("+")} · **${vlabel(s)}** · ${mitre}\n\n`;
    md += `- **Trust assumption:** ${s.trust_assumption}\n`;
    md += `- **Violation:** ${s.violation}\n`;
    if (s.validation) {
      md += `- **Validate:** ${s.validation.validation_method}\n`;
      md += `- **Refuted if:** ${s.validation.falsifier}\n`;
      if (s.validation.existing_controls) md += `- **Existing controls:** ${s.validation.existing_controls}\n`;
    }
    if (s.suggested_research) md += `- **Suggested research:** ${s.suggested_research}\n`;
  }
}

fs.writeFileSync(path.join(__dirname, "docs/NEW-TECHNIQUES.md"), md);
console.log(`wrote docs/NEW-TECHNIQUES.md — ${n} techniques`);
