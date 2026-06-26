// Generates docs/TECHNIQUES-BY-TACTIC.md — the seam techniques organized by the 14 ATT&CK
// Enterprise tactics (kill-chain order), with primitive, ATT&CK refs, and ⚡=new (no ATT&CK id).
const fs = require("fs"), path = require("path");
const D = path.join(__dirname, "data");
const seams = JSON.parse(fs.readFileSync(path.join(D, "seams.json"), "utf8")).seams;
const cov = JSON.parse(fs.readFileSync(path.join(D, "classic-coverage.json"), "utf8"));
const prims = JSON.parse(fs.readFileSync(path.join(D, "primitives.json"), "utf8")).primitives;
const PRIM = Object.fromEntries(prims.map((p) => [p.id, p.name]));
// apply the MITRE map (mapped ids are joined at load, mirror that here)
try {
  const map = JSON.parse(fs.readFileSync(path.join(D, "mitre-map.json"), "utf8"));
  const byId = Object.fromEntries(seams.map((s) => [s.id, s]));
  for (const e of (map.mapped || [])) {
    const s = byId[e.seam_id]; if (s && s.techniques[0] && !s.techniques[0].attack_ids.includes(e.technique_id)) s.techniques[0].attack_ids.push(e.technique_id);
  }
} catch {}

const TACTIC_ORDER = ["TA0043", "TA0042", "TA0001", "TA0002", "TA0003", "TA0004", "TA0005", "TA0006", "TA0007", "TA0008", "TA0009", "TA0011", "TA0010", "TA0040"];
const tn = Object.fromEntries(cov.attack_tactics.map((t) => [t.id, t.name]));
const isNew = (s) => s.techniques.every((t) => !t.attack_ids || t.attack_ids.length === 0);

let md = `# SEAMMAP — Techniques by Tactic\n\nThe seam techniques organized by the 14 MITRE ATT&CK Enterprise tactics (kill-chain order). ` +
  `Each line: **[primitive]** technique — \`ATT&CK ids\` · ⚡ = new (no ATT&CK id; a trust relationship MITRE does not model).\n\n` +
  `> Generated from \`data/seams.json\` + \`data/mitre-map.json\` by \`gen-techniques-by-tactic.cjs\`. ${seams.length} seams.\n`;

let totalLines = 0;
for (const tac of TACTIC_ORDER) {
  const items = seams.filter((s) => s.tactics.includes(tac));
  // flatten to technique entries, dedup by name
  const seen = new Set(); const lines = [];
  for (const s of items) {
    for (const t of s.techniques) {
      if (seen.has(t.name)) continue; seen.add(t.name);
      const refs = (t.attack_ids || []).join(", ");
      const tag = isNew(s) ? " ⚡" : "";
      lines.push(`- **[${s.primitive} ${PRIM[s.primitive]}]** ${t.name}${refs ? ` — \`${refs}\`` : ""}${tag}`);
    }
  }
  lines.sort();
  totalLines += lines.length;
  md += `\n## ${tn[tac]} \`${tac}\`  *(${lines.length})*\n${lines.join("\n")}\n`;
}
fs.writeFileSync(path.join(D, "..", "docs", "TECHNIQUES-BY-TACTIC.md"), md);
console.log(`wrote docs/TECHNIQUES-BY-TACTIC.md — ${totalLines} technique lines across ${TACTIC_ORDER.length} tactics`);
