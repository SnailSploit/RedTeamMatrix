// Renders poster.png — an ATT&CK-matrix-style poster of techniques-by-tactic, generated
// from the model. Needs puppeteer (devDependency). Run: node gen-poster.cjs
const fs = require("fs"), path = require("path");
const D = path.join(__dirname, "data");
const seams = JSON.parse(fs.readFileSync(path.join(D, "seams.json"), "utf8")).seams;
const prims = JSON.parse(fs.readFileSync(path.join(D, "primitives.json"), "utf8")).primitives;
const PC = Object.fromEntries(prims.map((p) => [p.id, p.color]));
const cov = JSON.parse(fs.readFileSync(path.join(D, "classic-coverage.json"), "utf8"));
try {
  const m = JSON.parse(fs.readFileSync(path.join(D, "mitre-map.json"), "utf8"));
  const byId = Object.fromEntries(seams.map((s) => [s.id, s]));
  for (const e of m.mapped) { const s = byId[e.seam_id]; if (s && s.techniques[0] && !s.techniques[0].attack_ids.includes(e.technique_id)) s.techniques[0].attack_ids.push(e.technique_id); }
} catch {}

const ORDER = ["TA0043", "TA0042", "TA0001", "TA0002", "TA0003", "TA0004", "TA0005", "TA0006", "TA0007", "TA0008", "TA0009", "TA0011", "TA0010", "TA0040"];
const tn = Object.fromEntries(cov.attack_tactics.map((t) => [t.id, t.name]));
const isNew = (s) => s.techniques.every((t) => !t.attack_ids || t.attack_ids.length === 0);
const cols = ORDER.map((tac) => {
  const items = seams.filter((s) => s.tactics.includes(tac));
  const seen = new Set(); let total = 0, nw = 0; const byP = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
  for (const s of items) for (const t of s.techniques) { if (seen.has(t.name)) continue; seen.add(t.name); total++; byP[s.primitive]++; if (isNew(s)) nw++; }
  return { tac, name: tn[tac], total, nw, byP };
});
const maxT = Math.max(...cols.map((c) => c.total));
const P = ["P1", "P2", "P3", "P4", "P5", "P6"];
const colHtml = cols.map((c) => {
  const bars = P.map((p) => { const w = c.total ? Math.round(c.byP[p] / c.total * 100) : 0; return w ? `<div style="height:8px;width:${w}%;background:${PC[p]}"></div>` : ""; }).join("");
  const rows = P.map((p) => `<div class=pr><span class=dot style="background:${PC[p]}"></span>${p}<b>${c.byP[p]}</b></div>`).join("");
  const bh = Math.round(c.total / maxT * 120) + 18;
  return `<div class=col><div class=th>${c.name}</div><div class=big>${c.total}<span class=nw>⚡${c.nw}</span></div><div class=barwrap style="height:${bh}px"><div class=stack>${bars}</div></div><div class=rows>${rows}</div></div>`;
}).join("");
const html = `<!doctype html><meta charset=utf-8><style>
body{margin:0;background:#0d1117;color:#e6edf3;font:12px ui-monospace,Menlo,monospace}.wrap{padding:20px}
h1{font-size:18px;letter-spacing:1px;margin:0 0 2px}h1 b{color:#58a6ff}.sub{color:#8b949e;margin-bottom:14px}
.legend{display:flex;gap:14px;margin-bottom:14px;flex-wrap:wrap;color:#8b949e}.legend span b{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:5px;vertical-align:middle}
.matrix{display:flex;gap:8px;align-items:flex-start}.col{flex:1;min-width:120px;background:#161b22;border:1px solid #2b333d;border-radius:7px;padding:9px 8px;display:flex;flex-direction:column}
.th{font-weight:700;min-height:30px;line-height:1.2;border-bottom:1px solid #2b333d;padding-bottom:6px;margin-bottom:6px}
.big{font-size:30px;font-weight:800;color:#fff;line-height:1}.nw{font-size:12px;color:#bd93f9;font-weight:700;margin-left:6px;vertical-align:super}
.barwrap{display:flex;align-items:flex-end;margin:8px 0}.stack{width:26px;border-radius:3px;overflow:hidden;display:flex;flex-direction:column-reverse}
.rows{margin-top:auto;font-size:10px;color:#8b949e}.pr{display:flex;align-items:center;gap:4px;padding:1px 0}.pr b{margin-left:auto;color:#c9d1d9}.dot{width:8px;height:8px;border-radius:2px;display:inline-block}
</style><div class=wrap><h1><b>SEAM</b>MAP — Techniques by Tactic</h1>
<div class=sub>${seams.length} seams across the 14 MITRE ATT&CK Enterprise tactics · ⚡ = new (no ATT&CK id) · bar = primitive mix</div>
<div class=legend>${prims.map((p) => `<span><b style="background:${p.color}"></b>${p.id} ${p.name}</span>`).join("")}</div>
<div class=matrix>${colHtml}</div></div>`;
const htmlPath = path.join(require("os").tmpdir(), "seammap-poster.html");
fs.writeFileSync(htmlPath, html);

(async () => {
  let puppeteer; try { puppeteer = require("puppeteer"); } catch { console.log("wrote " + htmlPath + " (install puppeteer to render PNG)"); return; }
  const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const p = await b.newPage(); await p.setViewport({ width: 1840, height: 700, deviceScaleFactor: 2 });
  await p.goto("file://" + htmlPath, { waitUntil: "load" }); await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: path.join(__dirname, "poster.png"), fullPage: true });
  await b.close(); console.log("wrote poster.png");
})();
