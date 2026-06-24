// Deterministic merge: canonical core (original 77 seams, migrated to the expanded
// taxonomy) + the eight authored extension files. Idempotent: always rebuilds seams.json
// from seams.core.json + data/_ext_*.json, so it can be re-run safely.
const fs = require("fs"), path = require("path");
const D = path.join(__dirname, "data");

const core = JSON.parse(fs.readFileSync(path.join(D, "seams.core.json"), "utf8")).seams;

// --- migrate original branch names -> expanded taxonomy ---
const MAP = {
  "Initial Access / Delivery": "Initial Access",
  "Execution / Exploitation": "Execution",
  "Lateral Movement / Pivoting": "Lateral Movement",
  "Discovery / Enumeration": "Discovery",
  "Resource Development / Weaponization": "CI/CD & Build Pipeline",
  "Web Application Attacks": "API & Business-Logic Abuse",
  "Social Engineering": "Initial Access",
  "Wireless / Network Attacks": "Wireless / RF Attacks",
  "Physical Access": "Initial Access",
  "Reporting": "Reporting & Debrief",
};
const AI_NODES = new Set(["agent", "mcp", "vectorstore", "memory"]);
function frame(s) { return new Set([...s.source, ...s.target]); }
function migrate(s) {
  const fr = frame(s);
  const out = new Set();
  for (const b of s.classic_branches) {
    if (b === "Cloud & Container Attacks") out.add(fr.has("container") ? "Container & Orchestration" : "Cloud Attacks");
    else out.add(MAP[b] || b);
  }
  if (s.kind === "frontier" || [...fr].some((n) => AI_NODES.has(n))) out.add("AI / Agent Attacks");
  s.classic_branches = [...out];
  return s;
}
core.forEach(migrate);

// --- fold in extension files (fixed order; core wins on collision) ---
const extFiles = ["recon", "access", "escalation", "cred", "c2", "domains", "crosscut", "cloudops",
  "gaps1", "gaps2", "gaps3", "gaps4", "gaps5"];
let ext = [];
for (const f of extFiles) {
  const arr = JSON.parse(fs.readFileSync(path.join(D, `_ext_${f}.json`), "utf8"));
  ext = ext.concat(arr);
}

// --- dedup: by exact (primitive+primary technique name) and by trust_assumption (a dup IS padding) ---
const all = [...core, ...ext];
const seenTA = new Map(), seenTech = new Map(), seenId = new Set();
const merged = [], dropped = [];
for (const s of all) {
  const ta = s.trust_assumption.trim().toLowerCase();
  const tk = `${s.primitive}::${(s.techniques[0] && s.techniques[0].name || "").trim().toLowerCase()}`;
  if (seenId.has(s.id)) { dropped.push([s.id, "dup-id"]); continue; }
  if (seenTA.has(ta)) { dropped.push([s.id, "dup-trust-assumption of " + seenTA.get(ta)]); continue; }
  if (seenTech.has(tk)) { dropped.push([s.id, "dup-technique of " + seenTech.get(tk)]); continue; }
  seenId.add(s.id); seenTA.set(ta, s.id); seenTech.set(tk, s.id);
  merged.push(s);
}

fs.writeFileSync(path.join(D, "seams.json"), JSON.stringify({ "$schema": "Merged canonical seam corpus = seams.core.json (migrated) + data/_ext_*.json, via merge.cjs. Edit seams.core.json or the _ext_ files, then re-run node merge.cjs.", seams: merged }, null, 2));

console.log(`core ${core.length} + ext ${ext.length} = ${all.length}; merged ${merged.length}; dropped ${dropped.length}`);
dropped.forEach(([id, why]) => console.log(`  drop ${id}: ${why}`));
const byPrim = {}; merged.forEach((s) => byPrim[s.primitive] = (byPrim[s.primitive] || 0) + 1);
console.log("by primitive:", JSON.stringify(byPrim));
