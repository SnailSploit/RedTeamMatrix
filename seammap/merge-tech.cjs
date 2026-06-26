// Assembles data/tech-notes.json (seamId -> technical deep-dive) from data/_td_*.json.
// model.ts joins it onto seams as s.tech_note (mechanism, exploitation_primitive, mitre_gap,
// anchors, detection, references). Re-run after any _td_ file changes.
const fs = require("fs"), path = require("path");
const D = path.join(__dirname, "data");
const out = {}; let n = 0, anchors = 0;
for (const file of fs.readdirSync(D).filter((f) => /^_td_.*\.json$/.test(f)).sort()) {
  const obj = JSON.parse(fs.readFileSync(path.join(D, file), "utf8"));
  for (const [id, note] of Object.entries(obj)) { out[id] = note; n++; anchors += (note.anchors || []).length; }
}
fs.writeFileSync(path.join(D, "tech-notes.json"), JSON.stringify(out, null, 1));
console.log(`tech-notes: ${n} techniques, ${anchors} verified anchors`);
