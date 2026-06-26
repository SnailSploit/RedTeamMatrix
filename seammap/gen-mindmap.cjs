// Generates the NEW mindmap as a projection of the canonical model — reorganized around the
// six seam primitives (the type system) instead of place-centric tactics. Emits:
//   docs/MINDMAP.md   — complete, collapsible markmap (primitive -> branch -> seams)
//   (stdout)          — a curated Mermaid `mindmap` for a quick rendered visual
const fs = require("fs"), path = require("path");
const D = path.join(__dirname, "data");
const seams = JSON.parse(fs.readFileSync(path.join(D, "seams.json"), "utf8")).seams;
const prims = JSON.parse(fs.readFileSync(path.join(D, "primitives.json"), "utf8")).primitives;
const vals = JSON.parse(fs.readFileSync(path.join(D, "validations.json"), "utf8"));
const PRIM = Object.fromEntries(prims.map((p) => [p.id, p]));
const techName = (s) => (s.techniques[0] || {}).name || s.id;
const isNew = (s) => s.origin === "AGENT-DISCOVERED";

// ---- complete markmap (collapsible) ----
let md = `---\nmarkmap:\n  colorFreezeLevel: 2\n  initialExpandLevel: 2\n---\n\n# SEAMMAP\n\n`;
md += `*The new mind map — a projection of the trust hypergraph, organized by the six seam primitives ` +
  `(not by place/tactic). ${seams.length} seams; ⚡ = AGENT-DISCOVERED (new), ◆ = frontier.*\n`;
for (const p of prims) {
  const inP = seams.filter((s) => s.primitive === p.id);
  md += `\n## ${p.id} ${p.name} *(${inP.length})*\n`;
  // sub-group by first classic branch
  const byBranch = {};
  for (const s of inP) { const b = s.classic_branches[0] || "—"; (byBranch[b] = byBranch[b] || []).push(s); }
  for (const b of Object.keys(byBranch).sort()) {
    md += `\n### ${b}\n`;
    for (const s of byBranch[b].sort((a, c) => techName(a).localeCompare(techName(c)))) {
      const tag = isNew(s) ? " ⚡" : (s.kind === "frontier" ? " ◆" : "");
      const v = vals[s.id] ? ` _(${vals[s.id].validity})_` : "";
      md += `- ${techName(s)}${tag}${v}\n`;
    }
  }
}
fs.writeFileSync(path.join(D, "..", "docs", "MINDMAP.md"), md);
console.log("wrote docs/MINDMAP.md");

// ---- curated Mermaid mindmap (compact, renderable) ----
const san = (t) => t.replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 38);
const vrank = { demonstrated: 0, plausible: 1, speculative: 2 };
let mm = "mindmap\n  root((SEAMMAP))\n";
for (const p of prims) {
  const inP = seams.filter((s) => s.primitive === p.id);
  const classics = inP.filter((s) => s.kind === "classic" && !isNew(s)).slice(0, 3);
  const news = inP.filter(isNew).sort((a, c) => (vrank[vals[a.id]?.validity] ?? 3) - (vrank[vals[c.id]?.validity] ?? 3)).slice(0, 4);
  mm += `    ${p.id}[${san(p.id + " " + p.name)}]\n`;
  for (const s of classics) mm += `      ${san(techName(s))}\n`;
  for (const s of news) mm += `      ${san(techName(s) + " NEW")}\n`;
}
fs.writeFileSync(path.join(__dirname, "mindmap.mmd"), mm);
console.log("wrote mindmap.mmd\n");
console.log(mm);
