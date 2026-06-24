// Assembles data/validations.json (seamId -> validation block) from the adversarial-
// validator outputs data/_val_*.json. Re-run after editing any _val_ file. model.ts joins
// validations.json onto the seams at load and applies the recalibrated maturity/tooling/
// detection, so the scorer, matrix, and predictor all reflect calibrated reality.
const fs = require("fs"), path = require("path");
const D = path.join(__dirname, "data");
const map = {}; const dist = { demonstrated: 0, plausible: 0, speculative: 0 };
for (let i = 1; i <= 5; i++) {
  const fp = path.join(D, `_val_${i}.json`);
  if (!fs.existsSync(fp)) continue;
  for (const v of JSON.parse(fs.readFileSync(fp, "utf8"))) {
    const { id, ...rest } = v; map[id] = rest; dist[v.validity] = (dist[v.validity] || 0) + 1;
  }
}
fs.writeFileSync(path.join(D, "validations.json"), JSON.stringify(map, null, 1));
console.log(`validations: ${Object.keys(map).length} | ${JSON.stringify(dist)}`);
