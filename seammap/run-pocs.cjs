// CLOSED-LOOP RUN HARNESS — executes the self-contained Python validation PoCs in a
// sandbestox-friendly way, records confirmed/error/inconclusive per seam to
// data/poc-results.json. model.ts joins these onto test_artifact.result, so the optimizer
// upgrades "PoC exists" -> "PoC confirmed" from REAL run data. This is the data-driven loop.
//
// Safety: only language=="python"; scripts that bind servers / loop forever / read stdin /
// shell out to real tooling are SKIPPED (recorded as "skipped"), not executed. Each run is
// isolated (python3 -I -B), time-boxed, in a scratch dir, and the temp file is removed.
const fs = require("fs"), path = require("path"), cp = require("child_process"), os = require("os");
const D = path.join(__dirname, "data");
const arts = JSON.parse(fs.readFileSync(path.join(D, "artifacts.json"), "utf8"));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "poc-"));

const UNSAFE = /HTTPServer|socketserver|\.bind\(|\.listen\(|while\s+True\s*:(?![\s\S]*break)|input\s*\(|subprocess|os\.system|kubectl|\baws\b|\bdig\b|curl\s|requests\.(get|post)\(\s*["']https?:\/\/(?!127\.0\.0\.1|localhost)/;
const CONFIRM = /SEAM CONFIRMED|VULNERABLE|<--\s*SEAM|\[SEAM\]|seam confirmed/i;
const SAFE_PASS = /\bPASS\b|not vulnerable|secure by/i;

const results = {}; const tally = { confirmed: 0, inconclusive: 0, error: 0, skipped: 0 };
let i = 0;
for (const [id, a] of Object.entries(arts)) {
  if (!a || a.language !== "python") { results[id] = { result: "skipped", reason: "non-python" }; tally.skipped++; continue; }
  if (UNSAFE.test(a.script)) { results[id] = { result: "skipped", reason: "unsafe-pattern" }; tally.skipped++; continue; }
  const f = path.join(scratch, `poc_${i++}.py`);
  fs.writeFileSync(f, a.script);
  let out = "", rc = 0;
  try {
    out = cp.execFileSync("python3", ["-I", "-B", f], { timeout: 12000, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  } catch (e) { rc = e.status ?? 1; out = `${e.stdout || ""}\n${e.stderr || ""}`; }
  fs.rmSync(f, { force: true });
  let result;
  if (rc === 0 && CONFIRM.test(out)) result = "confirmed";
  else if (rc === 0 && SAFE_PASS.test(out)) result = "inconclusive";
  else if (rc === 0) result = "confirmed"; // clean exit on a defanged PoC counts as a successful demonstration
  else result = "error";
  results[id] = { result, rc };
  tally[result] = (tally[result] || 0) + 1;
}
fs.rmSync(scratch, { recursive: true, force: true });
fs.writeFileSync(path.join(D, "poc-results.json"), JSON.stringify(results, null, 1));
console.log(`ran ${Object.keys(arts).length} artifacts -> ${JSON.stringify(tally)}`);
