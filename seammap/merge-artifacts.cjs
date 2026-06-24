// Assembles data/artifacts.json (seamId -> red-team validation artifact) from the authored
// data/_art_*.json batches. model.ts joins it onto seams at load; the seam detail panel
// renders the artifact. Re-run after editing any _art_ file.
const fs = require("fs"), path = require("path");
const D = path.join(__dirname, "data");
const out = {}; let n = 0;
for (const file of fs.readdirSync(D).filter((f) => /^_art_.*\.json$/.test(f)).sort()) {
  const obj = JSON.parse(fs.readFileSync(path.join(D, file), "utf8"));
  for (const [id, art] of Object.entries(obj)) { out[id] = art; n++; }
}
fs.writeFileSync(path.join(D, "artifacts.json"), JSON.stringify(out, null, 1));
console.log(`artifacts: ${n}`);
