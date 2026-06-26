// Generates docs/MITRE-GAPS.md — a cited, domain-balanced account of where MITRE ATT&CK
// Enterprise is structurally blind, using the SEAMMAP seams that carry no ATT&CK id as
// evidence and the web-verified tech-notes' `mitre_gap` field per technique.
const fs = require("fs"), path = require("path");
const D = path.join(__dirname, "data");
const J = (f) => JSON.parse(fs.readFileSync(path.join(D, f), "utf8"));
const seams = J("seams.json").seams;
const PRIM = Object.fromEntries(J("primitives.json").primitives.map((p) => [p.id, p.name]));
let tech = {}; try { tech = J("tech-notes.json"); } catch {}
// apply the MITRE map so "no attack id" means genuinely unmodeled
try { const m = J("mitre-map.json"); const byId = Object.fromEntries(seams.map((s) => [s.id, s]));
  for (const e of (m.mapped || [])) { const s = byId[e.seam_id]; if (s && s.techniques[0] && !s.techniques[0].attack_ids.includes(e.technique_id)) s.techniques[0].attack_ids.push(e.technique_id); } } catch {}

const mitreAbsent = (s) => s.techniques.every((t) => !t.attack_ids || t.attack_ids.length === 0);
const gaps = seams.filter(mitreAbsent);

// domain grouping (NOT AI-led): map branches to a domain bucket
const DOMAIN = (s) => {
  const b = s.classic_branches.join(" ");
  if (/Identity & Federation/.test(b)) return "Identity & Federation";
  if (/Cloud|Container/.test(b)) return "Cloud-native & Kubernetes";
  if (/CI\/CD|Supply/.test(b)) return "CI/CD & Software Supply Chain";
  if (/API & Business/.test(b)) return "API & Business-Logic";
  if (/Email & Collab/.test(b)) return "Email & Collaboration / SaaS";
  if (/Cryptography/.test(b)) return "Cryptography & PKI";
  if (/OT \/ ICS|Automotive|Hardware|Wireless|PNT/.test(b)) return "Cyber-Physical (OT / PNT / RF / Hardware)";
  if (/Mobile/.test(b)) return "Mobile";
  if (/AI \/ Agent/.test(b)) return "AI / Agent";
  return "Other / cross-cutting";
};

const byDom = {};
for (const s of gaps) (byDom[DOMAIN(s)] ??= []).push(s);
const domOrder = ["Identity & Federation", "Cloud-native & Kubernetes", "CI/CD & Software Supply Chain",
  "API & Business-Logic", "Email & Collaboration / SaaS", "Cryptography & PKI",
  "Cyber-Physical (OT / PNT / RF / Hardware)", "Mobile", "AI / Agent", "Other / cross-cutting"];

let md = `# Where MITRE ATT&CK Has Gaps

MITRE ATT&CK is the field's shared language, and SEAMMAP maps onto it fully — **100% of the 211 Enterprise base
techniques resolve to a seam** (\`data/mitre-map.json\`). But ATT&CK is a *place-centric* taxonomy: a flat,
curated list of techniques grouped by tactic. That shape has structural blind spots, and **${gaps.length} SEAMMAP
seams carry no ATT&CK technique id at all** — real trust relationships ATT&CK does not model. This document is
the evidence, organized by domain (not AI-first), each grounded in the web-verified \`mitre_gap\` notes.

## The structural blind spots (why a technique list misses these)

1. **ATT&CK enumerates places, not relationships.** A technique answers "what is the adversary doing here";
   a *seam* answers "which trust assumption breaks between A and B." Confused-deputy chains, provenance forgery,
   and time/state divergence are **relationships between principals** — they fall *between* technique cells, so a
   flat list cannot name them. SEAMMAP's six primitives (P1–P6) are exactly that missing type system.
2. **The matrices are siloed.** Enterprise, Mobile, ICS, and ATLAS (AI) are separate catalogues. A real
   2025-2027 attack crosses them in one chain (agent → OAuth → cloud → OT), but no single ATT&CK matrix expresses
   the cross-matrix path. ATLAS techniques (e.g. AML.T0020 ML-baseline poisoning) are **not incorporated into
   Enterprise** at all.
3. **Whole technique classes are absent.** Application/business-logic abuse (BOLA/IDOR, mass-assignment, JWT
   alg-confusion, workflow-state bypass), DeFi/smart-contract trust failures, GNSS/PTP time manipulation, and
   SaaS-to-SaaS OAuth toxic-combinations have **no first-class Enterprise technique** — they map only loosely to
   over-broad ids like T1190 / T1078 / T1565.
4. **The taxonomy itself churns.** ATT&CK v19 (2026) renames *Defense Evasion → Stealth* and adds a new tactic
   (*Defense Impairment*), an admission that the existing partition was incomplete.

## Coverage gaps by domain  *(${gaps.length} seams with no ATT&CK id)*

`;
md += "| Domain | Unmodeled seams |\n|---|---:|\n";
for (const d of domOrder) if (byDom[d]) md += `| ${d} | ${byDom[d].length} |\n`;

for (const d of domOrder) {
  const items = byDom[d]; if (!items) continue;
  md += `\n## ${d}  *(${items.length})*\n`;
  for (const s of items.sort((a, b) => a.primitive.localeCompare(b.primitive))) {
    const t = s.techniques[0] || {};
    const note = tech[s.id] || {};
    md += `\n### ${t.name || s.id}\n`;
    md += `**[${s.primitive} ${PRIM[s.primitive]}]** · \`${s.id}\`\n\n`;
    md += `- **Trust broken:** ${s.trust_assumption}\n`;
    if (note.mitre_gap) md += `- **MITRE gap:** ${note.mitre_gap}\n`;
    if (note.mechanism) md += `- **Mechanism:** ${note.mechanism}\n`;
    const a = (note.anchors || [])[0];
    if (a) md += `- **Real-world anchor:** ${a.ref}${a.note ? ` — ${a.note}` : ""}${a.url ? ` (${a.url})` : ""}\n`;
  }
}
md += `\n---\n\n*Generated by \`gen-mitre-gaps.cjs\` from \`data/seams.json\` + \`data/tech-notes.json\` + \`data/mitre-map.json\`. ` +
  `${gaps.length} seams without an ATT&CK id; technical notes web-verified.*\n`;
fs.writeFileSync(path.join(D, "..", "docs", "MITRE-GAPS.md"), md);
console.log(`wrote docs/MITRE-GAPS.md — ${gaps.length} unmodeled seams across ${Object.keys(byDom).length} domains`);
