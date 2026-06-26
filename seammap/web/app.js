// SEAMMAP front-end. All five views read ONE dataset.json (the rendered projections of
// the canonical hypergraph). Vanilla JS, no build. Graph via cytoscape (CDN).

let DS = null;          // the bundle
let PRIM = {};          // primitive id -> primitive
let SEAM = {};          // seam id -> seam
let SCORE = {};         // seam id -> scored
let PNAME = {};         // principal id -> name
let cy = null;
const opFilter = { scalable: false, automatable: false, ai: false, frontierOnly: false, prims: new Set() };

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const primColor = (p) => (PRIM[p] ? PRIM[p].color : "#888");

init();

async function init() {
  DS = await (await fetch("dataset.json")).json();
  DS.primitives.forEach((p) => (PRIM[p.id] = p));
  DS.seams.forEach((s) => (SEAM[s.id] = s));
  DS.scored.forEach((s) => (SCORE[s.id] = s));
  DS.principals.forEach((p) => (PNAME[p.id] = p.name));

  $("#meta").textContent =
    `${DS.meta.principals} principals · ${DS.meta.seams} seams · ${DS.meta.hyperedges} hyperedges · ` +
    `${DS.meta.register_size} gap-register entries · ${DS.meta.gap_stats["AGENT-DISCOVERED"]} agent-discovered`;

  document.querySelectorAll("nav button").forEach((b) =>
    b.addEventListener("click", () => switchView(b.dataset.view)));

  // Build each view independently: a failure in one must never blank the others.
  for (const [name, fn] of [["legend", renderLegend], ["graphControls", renderGraphControls],
    ["graph", buildGraph], ["matrix", buildMatrix], ["tree", buildTree], ["gaps", buildGaps],
    ["predict", buildPredict], ["optimize", buildOptimize], ["discover", buildDiscover],
    ["mindmap", buildMindmap], ["walk", buildWalk], ["path", buildPath]]) {
    try { fn(); } catch (e) { console.error(`view '${name}' failed:`, e); }
  }
}

function switchView(v) {
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("active", s.id === `view-${v}`));
  if (v === "graph" && cy) cy.resize(), cy.fit(undefined, 40);
}

// --------------------------------------------------------------------------- detail panel
function showSeam(id) {
  const s = SEAM[id]; if (!s) return;
  const sc = SCORE[id] || {};
  const d = $("#detail"); d.classList.remove("empty");
  const techs = s.techniques.map((t) => {
    const refs = [...t.attack_ids, ...t.cwe_ids].map((r) => `<code>${r}</code>`).join(" ");
    return `<div class="v">• ${t.name} ${refs}</div>`;
  }).join("");
  const ops = [];
  if (s.operator.scalable) ops.push("⤴ scalable");
  if (s.operator.automatable) ops.push("⟳ automatable");
  if (s.operator.ai_augmentable) ops.push("⚡ ai-augmentable");
  const frame = (sc.frame || []).map((p) => PNAME[p] || p).join(" + ");
  d.innerHTML = `
    <h2>${s.techniques[0] ? s.techniques[0].name : s.id}</h2>
    <div class="chips">
      <span class="chip prim" style="background:${primColor(s.primitive)}">${s.primitive} ${PRIM[s.primitive].name}</span>
      <span class="chip ${s.kind}">${s.kind}</span>
      ${s.origin === "AGENT-DISCOVERED" ? '<span class="chip disc">agent-discovered</span>' : ""}
      ${sc.hyper ? '<span class="chip op">hyperedge</span>' : ""}
    </div>
    <div class="k">frame (${sc.hyper ? "multi-party" : "dyadic"})</div><div class="v">${frame}</div>
    <div class="k">trust assumption</div><div class="v">${s.trust_assumption}</div>
    <div class="k">violation</div><div class="v">${s.violation}</div>
    <div class="k">techniques · refs</div>${techs}
    <div class="k">operator axis</div><div class="chips">${ops.map((o) => `<span class="chip op">${o}</span>`).join("") || '<span class="muted">none</span>'}</div>
    <div class="k">tooling / detection</div><div class="v">tooling: <b>${s.tooling_status}</b> · detection: <b>${s.detection_status}</b></div>
    <div class="k">scheduler</div><div class="v">CLS ${sc.cls ?? "?"} · EGQ ${sc.egq ?? "?"} ${sc.egq_candidate ? "<b style='color:#7ee787'>(candidate ≥2)</b>" : ""}</div>
    <div class="k">tactics · branch</div><div class="v muted">${s.tactics.join(", ")} — ${s.classic_branches.join("; ")}</div>
    ${s.rationale ? `<div class="k">agent rationale</div><div class="v">${s.rationale}</div>` : ""}
    ${s.suggested_research ? `<div class="k">suggested research</div><div class="res" style="color:#7ee787">${s.suggested_research}</div>` : ""}
    ${s.validation ? `<div class="k">validity</div><div class="chips"><span class="chip" style="border-color:${VALCOLOR[s.validation.validity] || "#888"};color:${VALCOLOR[s.validation.validity] || "#888"}">${s.validation.validity} · ${s.validation.confidence} confidence</span></div>
      <div class="k">how to validate</div><div class="v">${s.validation.validation_method}</div>
      <div class="k">refuted if</div><div class="v">${s.validation.falsifier}</div>
      ${s.validation.prerequisites ? `<div class="k">prerequisites</div><div class="v">${s.validation.prerequisites}</div>` : ""}
      ${s.validation.existing_controls ? `<div class="k">existing controls</div><div class="v">${s.validation.existing_controls}</div>` : ""}` : ""}
    ${s.test_artifact ? `<div class="k">red-team validation artifact</div>
      <div class="v"><b>${s.test_artifact.name}</b> <span class="chip op">${s.test_artifact.language}</span></div>
      <div class="rat" style="color:#d4a0a0">⚠ ${s.test_artifact.authorization}</div>
      ${s.test_artifact.setup ? `<div class="v muted">setup: ${esc(s.test_artifact.setup)}</div>` : ""}
      <pre class="artifact"><code>${esc(s.test_artifact.script)}</code></pre>
      <div class="v"><b style="color:#7ee787">success:</b> ${esc(s.test_artifact.success_criterion)}</div>
      <div class="v muted">cleanup: ${esc(s.test_artifact.cleanup)} · safety: ${esc(s.test_artifact.safety)}</div>` : ""}
  `;
}

function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

function showText(html) { const d = $("#detail"); d.classList.remove("empty"); d.innerHTML = html; }

// --------------------------------------------------------------------------- graph
function renderLegend() {
  const lg = $("#legend");
  let h = "<div style='color:#8b949e;margin-bottom:4px'>edge = primitive</div>";
  DS.primitives.forEach((p) => {
    h += `<div class="row"><span class="sw" style="background:${p.color}"></span>${p.id} ${p.name}</div>`;
  });
  h += "<div style='color:#8b949e;margin:6px 0 4px'>node ring = maturity</div>";
  h += `<div class="row"><span class="dot" style="border-color:var(--frontier)"></span>frontier</div>`;
  h += `<div class="row"><span class="dot" style="border-color:var(--emerging)"></span>emerging</div>`;
  h += `<div class="row"><span class="dot" style="border-color:var(--mature)"></span>mature</div>`;
  h += "<div style='color:#8b949e;margin-top:6px'>dashed = frontier seam · glow = scalable+auto+ai</div>";
  lg.innerHTML = h;
}

function renderGraphControls() {
  const c = $("#graph-controls");
  const mk = (key, label) => {
    const l = el("label", null, `<input type="checkbox"> ${label}`);
    l.querySelector("input").addEventListener("change", (e) => { opFilter[key] = e.target.checked; buildGraph(); });
    return l;
  };
  c.append(mk("scalable", "⤴ scalable"), mk("automatable", "⟳ automatable"), mk("ai", "⚡ ai"), mk("frontierOnly", "frontier seams only"));
  // Per-primitive isolation: click a primitive to show only its edges (de-hairball).
  DS.primitives.forEach((p) => {
    const l = el("label", null, `<input type="checkbox"> <span style="color:${p.color}">${p.id}</span>`);
    l.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) opFilter.prims.add(p.id); else opFilter.prims.delete(p.id);
      buildGraph();
    });
    c.append(l);
  });
}

const maturityColor = (m) => m === "frontier" ? "#ff5c5c" : m === "emerging" ? "#f0a93b" : "#6e7681";
const classShape = (c) => ({ substrate: "round-rectangle", human: "ellipse", defense: "hexagon", broker: "diamond", conduit: "round-tag" }[c] || "ellipse");

function passesFilter(s) {
  if (opFilter.frontierOnly && s.kind !== "frontier") return false;
  if (opFilter.scalable && !s.operator.scalable) return false;
  if (opFilter.automatable && !s.operator.automatable) return false;
  if (opFilter.ai && !s.operator.ai_augmentable) return false;
  if (opFilter.prims.size && !opFilter.prims.has(s.primitive)) return false; // isolate primitives
  return true;
}

function buildGraph() {
  if (typeof cytoscape === "undefined") {
    $("#cy").innerHTML = "<p style='padding:20px;color:#8b949e'>cytoscape failed to load — expected at vendor/cytoscape.min.js (bundled, no network needed).</p>";
    return;
  }
  // Style is data/class-driven (no JS function mappers — those crash cytoscape's renderer
  // on some shapes). Color/width live in element data; maturity, class, frontier, glow are classes.
  const elements = [];
  DS.principals.forEach((p) => elements.push({
    data: { id: p.id, label: p.name },
    classes: `principal mat-${p.maturity} cls-${p.class}`,
  }));

  DS.seams.filter(passesFilter).forEach((s) => {
    const sc = SCORE[s.id];
    const w = 1 + s.operator.scalable + s.operator.automatable + s.operator.ai_augmentable;
    const glow = (s.operator.scalable && s.operator.automatable && s.operator.ai_augmentable);
    const color = primColor(s.primitive);
    const ecls = `seam${s.kind === "frontier" ? " frontier" : ""}${glow ? " glow" : ""}`;
    if (sc.hyper) {
      // Hyperedge: a relay node carries the frame so multi-party reads as multi-party.
      const hid = `he:${s.id}`;
      elements.push({ data: { id: hid, color, seam: s.id }, classes: "relay" });
      sc.frame.forEach((m) => elements.push({
        data: { id: `${hid}:${m}`, source: hid, target: m, color, seam: s.id, w }, classes: ecls,
      }));
    } else {
      elements.push({ data: {
        id: `e:${s.id}`, source: s.source[0], target: s.target[0], color, seam: s.id, w,
      }, classes: ecls });
    }
  });

  cy = cytoscape({
    container: $("#cy"),
    elements,
    style: [
      { selector: "node.principal", style: {
        "background-color": "#1f2630", "label": "data(label)", "color": "#e6edf3",
        "font-size": 9, "text-wrap": "wrap", "text-max-width": 84, "text-valign": "center",
        "border-width": 3, "width": 46, "height": 46 } },
      { selector: "node.mat-frontier", style: { "border-color": "#ff5c5c" } },
      { selector: "node.mat-emerging", style: { "border-color": "#f0a93b" } },
      { selector: "node.mat-mature", style: { "border-color": "#6e7681" } },
      { selector: "node.cls-substrate", style: { "shape": "rectangle" } },
      { selector: "node.cls-human", style: { "shape": "ellipse" } },
      { selector: "node.cls-defense", style: { "shape": "hexagon" } },
      { selector: "node.cls-broker", style: { "shape": "diamond" } },
      { selector: "node.cls-conduit", style: { "shape": "tag", "background-color": "#161b22" } },
      { selector: "node.relay", style: {
        "width": 10, "height": 10, "background-color": "data(color)", "border-width": 0, "shape": "ellipse" } },
      { selector: "edge.seam", style: {
        "width": "data(w)", "line-color": "data(color)", "target-arrow-color": "data(color)",
        "target-arrow-shape": "triangle", "curve-style": "bezier", "arrow-scale": 0.8, "opacity": 0.8 } },
      { selector: "edge.frontier", style: { "line-style": "dashed" } },
      { selector: "edge.glow", style: { "underlay-color": "data(color)", "underlay-opacity": 0.35, "underlay-padding": 5 } },
      { selector: ".faded", style: { "opacity": 0.07 } },
      { selector: ".hi", style: { "opacity": 1, "width": 5, "z-index": 99 } },
    ],
    layout: { name: "cose", animate: false, nodeRepulsion: 9000, idealEdgeLength: 110, padding: 40 },
  });

  cy.on("tap", "edge.seam", (e) => { showSeam(e.target.data("seam")); highlightSeam(e.target.data("seam")); });
  cy.on("tap", "node.relay", (e) => showSeam(e.target.data("seam")));
  cy.on("tap", "node.principal", (e) => showPrincipal(e.target.id()));
  cy.on("tap", (e) => { if (e.target === cy) cy.elements().removeClass("faded hi"); });
  window.cy = cy; // expose for debugging / render checks
}

function highlightSeam(id) {
  cy.elements().addClass("faded").removeClass("hi");
  cy.elements(`[seam = "${id}"]`).removeClass("faded").addClass("hi");
  cy.elements(`[seam = "${id}"]`).connectedNodes && cy.edges(`[seam = "${id}"]`).connectedNodes().removeClass("faded");
}

function showPrincipal(id) {
  const p = DS.principals.find((x) => x.id === id);
  const touching = DS.seams.filter((s) => (SCORE[s.id].frame || []).includes(id));
  showText(`<h2>${p.name}</h2>
    <div class="chips"><span class="chip op">${p.class}</span><span class="chip ${p.maturity === "frontier" ? "frontier" : "classic"}">${p.maturity}</span><span class="chip op">since ${p.era_introduced || "—"}</span></div>
    <div class="k">role</div><div class="v">${p.note || ""}</div>
    <div class="k">incident seams (${touching.length})</div>
    ${touching.map((s) => `<div class="leaf" onclick="showSeam('${s.id}')"><span class="pdot" style="background:${primColor(s.primitive)}"></span>${s.techniques[0].name}</div>`).join("")}`);
}

// --------------------------------------------------------------------------- matrix
function buildMatrix() {
  const m = DS.matrix, t = $("#matrix");
  let head = "<tr><th class='rowhead'>principal \\ tactic</th>";
  m.tactics.forEach((tac) => head += `<th title="${tac.name}">${tac.id.replace("TA00", "T")}<br><span class='muted' style='font-weight:400'>${tac.name}</span></th>`);
  head += "</tr>";
  let body = "";
  m.principals.forEach((pid) => {
    body += `<tr><td class="rowhead">${PNAME[pid]}</td>`;
    m.tactics.forEach((tac) => {
      const c = m.cells[pid][tac.id];
      const click = c.gap_type === "populated"
        ? `onclick="showCell('${pid}','${tac.id}')"` : `onclick="showText('<h2>typed gap</h2><div class=chips><span class=chip style=\\'border-color:#888\\'>${c.gap_type}</span></div><div class=k>${PNAME[pid]} × ${tac.name}</div><div class=v>${(c.reason || "Plausible trust relationship, no populated technique. This is research surface, not a blank.").replace(/'/g, "&#39;")}</div>')"`;
      const sym = c.gap_type === "populated" ? c.seam_ids.length : (c.gap_type === "honest-na" ? "·" : (c.gap_type === "frontier" ? "◆" : (c.gap_type === "projected" ? "▷" : "○")));
      body += `<td class="cell ${c.gap_type}" ${click} title="${c.gap_type}">${sym}</td>`;
    });
    body += "</tr>";
  });
  t.innerHTML = head + body;

  $("#matrix-key").innerHTML = [
    ["populated", "#14301c", "populated (count = #seams)"],
    ["frontier", "var(--proj)", "◆ frontier (surface <24mo, ~0 maturity)"],
    ["under-tooled", "var(--under)", "○ under-tooled (research exists, no public tooling)"],
    ["projected", "#122d33", "▷ projected (2026→2027 growth)"],
    ["honest-na", "var(--na)", "· honest-na (no plausible trust relationship)"],
  ].map(([k, c, l]) => `<span><b style="background:${c}"></b>${l}</span>`).join("");
}
function showCell(pid, tid) {
  const c = DS.matrix.cells[pid][tid];
  const tac = DS.matrix.tactics.find((x) => x.id === tid);
  showText(`<h2>${PNAME[pid]} × ${tac.name}</h2><div class="chip" style="border-color:#7ee787;color:#7ee787">populated</div>
    <div class="k">seams in this cell</div>
    ${c.seam_ids.map((id) => `<div class="leaf" onclick="showSeam('${id}')"><span class="pdot" style="background:${primColor(SEAM[id].primitive)}"></span>${SEAM[id].techniques[0].name}</div>`).join("")}`);
}

// --------------------------------------------------------------------------- tree
function buildTree() {
  const wrap = $("#tree");
  wrap.innerHTML = `<p class="muted">The flat coverage index — the old mind-map shape, generated from the graph. Every classic branch is present and re-homed; every leaf links back to the seam (and its primitive) it lives on.</p>`;
  DS.tree.forEach((b) => {
    const div = el("div", "branch");
    const head = el("div", "bh", `${b.branch} <span class="count">${b.leaves.length} seam${b.leaves.length === 1 ? "" : "s"}</span>`);
    const body = el("div");
    if (b.honest_na) body.append(el("div", "na", `honest-na — ${b.honest_na}`));
    b.leaves.forEach((l) => {
      const leaf = el("div", "leaf",
        `<span class="pdot" style="background:${primColor(l.primitive)}"></span>${l.label} <span class="muted">[${l.primitive}]</span>${l.kind === "frontier" ? '<span class="fr">frontier</span>' : ""}`);
      leaf.addEventListener("click", () => showSeam(l.seam_id));
      body.append(leaf);
    });
    head.addEventListener("click", () => body.style.display = body.style.display === "none" ? "" : "none");
    div.append(head, body);
    wrap.append(div);
  });
}

// --------------------------------------------------------------------------- gaps register
function buildGaps() {
  const c = $("#gaps-controls");
  c.innerHTML = `
    <span class="muted">Gaps Register — a primary deliverable. Sorted agent-discovered → frontier → under-tooled → projected.</span>
    <select id="gf-type">
      <option value="">all types</option>
      <option value="AGENT-DISCOVERED">agent-discovered</option>
      <option value="frontier">frontier</option>
      <option value="under-tooled">under-tooled</option>
      <option value="projected">projected</option>
    </select>
    <select id="gf-prim"><option value="">all primitives</option>${DS.primitives.map((p) => `<option value="${p.id}">${p.id} ${p.name}</option>`).join("")}</select>
    <select id="gf-val"><option value="">all validity</option><option value="demonstrated">demonstrated</option><option value="plausible">plausible</option><option value="speculative">speculative</option></select>
    <input id="gf-q" placeholder="filter principal / text…" />`;
  ["#gf-type", "#gf-prim", "#gf-val", "#gf-q"].forEach((s) => $(s).addEventListener("input", renderGaps));
  renderGaps();
}
const VALCOLOR = { demonstrated: "#7ee787", plausible: "#f0a93b", speculative: "#8b949e" };
function renderGaps() {
  const type = $("#gf-type").value, prim = $("#gf-prim").value, val = $("#gf-val").value, q = $("#gf-q").value.toLowerCase();
  const list = $("#gaps-list"); list.innerHTML = "";
  let shown = 0;
  const MAX = 300;
  for (const g of DS.register) {
    const kind = g.origin === "AGENT-DISCOVERED" ? "AGENT-DISCOVERED" : g.gap_type;
    if (type && kind !== type) continue;
    if (prim && g.primitive !== prim) continue;
    if (val && g.validity !== val) continue;
    const hay = `${g.source} ${g.target} ${g.rationale || ""} ${g.suggested_research || ""} ${g.validation_method || ""}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    if (shown >= MAX) { list.append(el("div", "muted", `…and ${DS.register.length - MAX}+ more typed gaps (narrow the filter).`)); break; }
    shown++;
    const cls = g.origin === "AGENT-DISCOVERED" ? "disc" : g.gap_type;
    const row = el("div", `gaprow ${cls}`);
    const valBadge = g.validity ? `<span class="chip" style="border-color:${VALCOLOR[g.validity]};color:${VALCOLOR[g.validity]}">${g.validity}${g.confidence ? ` · ${g.confidence}` : ""}</span>` : "";
    row.innerHTML = `<div class="top">
        <span class="chip prim" style="background:${primColor(g.primitive)}">${g.primitive}</span>
        <span class="chip ${cls === "disc" ? "disc" : "op"}">${kind}</span>
        ${valBadge}
        <span class="edge">${PNAME[g.source] || g.source} → ${PNAME[g.target] || g.target}</span>
        ${g.seam_id ? `<span class="muted" style="cursor:pointer" onclick="showSeam('${g.seam_id}')">[seam ${g.seam_id}]</span>` : ""}
      </div>
      ${g.rationale ? `<div class="rat">${g.rationale}</div>` : ""}
      ${g.validation_method ? `<div class="res" style="color:#58a6ff">✓ validate: ${g.validation_method}</div>` : ""}
      ${g.falsifier ? `<div class="rat" style="color:#d4a0a0">✗ refuted if: ${g.falsifier}</div>` : ""}
      ${g.suggested_research ? `<div class="res">↳ research: ${g.suggested_research}</div>` : ""}`;
    list.append(row);
  }
  if (!shown) list.append(el("div", "muted", "no gaps match the filter."));
}

// --------------------------------------------------------------------------- predict (emergent composites) view
function buildPredict() {
  const intro = $("#predict-intro");
  intro.innerHTML = `<b style="color:#e6edf3">Predicted emergent composites.</b> The merge of old and new tech yields vulnerabilities that look unpredictable — but the typed graph predicts them mechanically: a <span style="color:var(--frontier)">frontier (undetected) entry seam</span> feeding a <span style="color:#7ee787">mature (reliable) propagation seam</span> through a shared principal. Each card inherits the entry's lack of detection and the propagation's reliability. ${(DS.composites || []).length} ranked.`;
  const list = $("#predict-list"); list.innerHTML = "";
  (DS.composites || []).forEach((c, i) => {
    const B = SEAM[c.entry_seam], A = SEAM[c.propagate_seam];
    const card = el("div", "pathcard");
    card.innerHTML = `<div><span class="score">score ${c.score}</span><b>composite ${i + 1}</b> <span class="muted">at ${PNAME[c.node] || c.node}</span></div>
      <div style="margin:6px 0">${c.prediction}</div>
      <div class="pathstep" onclick="showSeam('${c.entry_seam}')"><span class="fr" style="color:var(--frontier)">entry ◆</span> <span class="pdot" style="background:${primColor(c.primitives[0])}"></span>${c.primitives[0]} ${B ? B.techniques[0].name : c.entry_seam} <span class="muted">[${B ? B.detection_status : "?"} detection]</span></div>
      <div class="pathstep" onclick="showSeam('${c.propagate_seam}')"><span style="color:#7ee787">propagate ▸</span> <span class="pdot" style="background:${primColor(c.primitives[1])}"></span>${c.primitives[1]} ${A ? A.techniques[0].name : c.propagate_seam} <span class="muted">[${A ? A.tooling_status : "?"} tooling]</span></div>
      <div class="rat" style="margin-top:6px">${c.why_predictable}</div>`;
    list.append(card);
  });

  // 3-hop emergent chains: undetected entry + two reliable classic hops.
  const c3 = DS.chains3 || [];
  if (c3.length) {
    list.append(el("div", null, `<div class="bh" style="margin:16px 0 8px;color:#e6edf3">3-hop emergent chains <span class="count muted">— one unmonitored door, two reliable hops (${c3.length})</span></div>`));
    c3.forEach((c, i) => {
      const seamsArr = [c.entry_seam, c.hop1_seam, c.hop2_seam];
      const card = el("div", "pathcard");
      let h = `<div><span class="score">score ${c.score}</span><b>chain ${i + 1}</b> <span class="muted">${c.nodes.map((n) => PNAME[n] || n).join(" → ")}</span></div>
        <div style="margin:6px 0">${c.prediction}</div>`;
      seamsArr.forEach((sid, j) => {
        const s = SEAM[sid]; if (!s) return;
        const tag = j === 0 ? '<span class="fr" style="color:var(--frontier)">entry ◆</span>' : `<span style="color:#7ee787">hop${j} ▸</span>`;
        h += `<div class="pathstep" onclick="showSeam('${sid}')">${tag} <span class="pdot" style="background:${primColor(c.primitives[j])}"></span>${c.primitives[j]} ${s.techniques[0].name}</div>`;
      });
      card.innerHTML = h;
      list.append(card);
    });
  }
}

// --------------------------------------------------------------------------- optimize (data-driven priority) view
function buildOptimize() {
  const m = DS.meta, cov = m.coverage || {};
  $("#opt-intro").innerHTML = `<b style="color:#e6edf3">Data-driven optimizer.</b> Priority = yield/effort, computed only from the data layers each seam carries — validity verdict, detection/tooling gap, operator weights, maturity, and whether a runnable PoC exists. As validations and PoC results are added, the ranking re-optimizes. This is the scheduler's "what to operationalize next."`;
  $("#opt-cov").innerHTML = `<div class="matrix-key">
    <span><b style="background:#7ee787"></b>PoC coverage: ${(cov.artifact_coverage*100||0).toFixed(0)}% (${cov.poc_confirmed||0} confirmed)</span>
    <span><b style="background:#58a6ff"></b>validated: ${(cov.validation_coverage*100||0).toFixed(0)}%</span>
    <span><b style="background:#f0a93b"></b>budget-optimum: ${(DS.optimized||{}).selected?.length||0} seams · yield ${(DS.optimized||{}).totalYield||0} @ effort ≤25</span>
  </div>`;
  const list = $("#opt-list"); list.innerHTML = "";
  (DS.priorities || []).forEach((p, i) => {
    const s = SEAM[p.id];
    const row = el("div", "gaprow");
    row.style.borderLeft = "3px solid #58a6ff";
    row.innerHTML = `<div class="top">
        <span class="score" style="float:none;color:var(--accent);font-weight:700">#${i+1} · ${p.score}</span>
        <span class="chip prim" style="background:${primColor(p.primitive)}">${p.primitive}</span>
        ${s ? `<span class="edge" style="cursor:pointer" onclick="showSeam('${p.id}')">${s.techniques[0].name}</span>` : `<span class="edge">${p.id}</span>`}
        ${s && s.test_artifact ? '<span class="chip" style="border-color:#7ee787;color:#7ee787">PoC</span>' : ''}
      </div>
      <div class="rat">yield ${p.yield} / effort ${p.effort} · drivers: ${p.drivers.map((d)=>`<span class="chip op">${d}</span>`).join(" ") || "—"}</div>`;
    list.append(row);
  });
}

// --------------------------------------------------------------------------- discover (relation-graph) view
const KINDLABEL = { "analogical-transfer": "analogical transfer", "transitive-chain": "transitive chain", "structural-hole": "structural hole" };
const KINDCOLOR = { "analogical-transfer": "#bd93f9", "transitive-chain": "#ff8c42", "structural-hole": "#56d4dd" };
function buildDiscover() {
  $("#disc-intro").innerHTML = `<b style="color:#e6edf3">Relation-graph threat discovery.</b> The system locates candidate new threats from the graph's <i>structure</i>, not by enumerating cells — three signals, each with the structural reason it was proposed (for analyst triage): <span style="color:${KINDCOLOR['analogical-transfer']}">analogical transfer</span> (a seam moves to a structurally-similar node), <span style="color:${KINDCOLOR['transitive-chain']}">transitive chain</span> (untrusted → laundering node → privileged), <span style="color:${KINDCOLOR['structural-hole']}">structural hole</span> (a missing edge the topology expects).`;
  const c = $("#disc-controls");
  c.innerHTML = `<select id="df-kind"><option value="">all modes</option>${Object.keys(KINDLABEL).map((k)=>`<option value="${k}">${KINDLABEL[k]}</option>`).join("")}</select>
    <select id="df-prim"><option value="">all primitives</option>${DS.primitives.map((p)=>`<option value="${p.id}">${p.id} ${p.name}</option>`).join("")}</select>`;
  ["#df-kind","#df-prim"].forEach((s)=>$(s).addEventListener("input", renderDiscover));
  renderDiscover();
}
function renderDiscover() {
  const kind = $("#df-kind").value, prim = $("#df-prim").value;
  const list = $("#disc-list"); list.innerHTML = "";
  let shown = 0;
  for (const d of (DS.discoveries || [])) {
    if (kind && d.kind !== kind) continue;
    if (prim && d.primitive !== prim) continue;
    shown++;
    const row = el("div", "gaprow");
    row.style.borderLeft = `3px solid ${KINDCOLOR[d.kind]}`;
    row.innerHTML = `<div class="top">
        <span class="score" style="float:none;color:var(--accent);font-weight:700">${d.score}</span>
        <span class="chip" style="border-color:${KINDCOLOR[d.kind]};color:${KINDCOLOR[d.kind]}">${KINDLABEL[d.kind]}</span>
        <span class="chip prim" style="background:${primColor(d.primitive)}">${d.primitive}</span>
        <span class="edge">${PNAME[d.source]||d.source} → ${PNAME[d.target]||d.target}</span>
        ${d.basis ? `<span class="muted">basis: ${d.basis.split("+").map((b)=>SEAM[b]?`<span style='cursor:pointer' onclick="showSeam('${b}')">${b}</span>`:b).join(" + ")}</span>` : ""}
      </div>
      <div class="rat">${esc(d.reason)}</div>`;
    list.append(row);
  }
  if (!shown) list.append(el("div", "muted", "no located threats match the filter."));
}

// --------------------------------------------------------------------------- mindmap view (collapsible, by primitive)
function buildMindmap() {
  const wrap = $("#mindmap"); wrap.innerHTML = "";
  wrap.append(el("p", "muted", `The new mind map — a projection of the hypergraph, branched by the six seam primitives (the trust relationship that breaks) instead of by place/tactic. ⚡ = AGENT-DISCOVERED (new) · ◆ = frontier. Click any leaf for the seam detail.`));
  for (const p of DS.primitives) {
    const inP = DS.seams.filter((s) => s.primitive === p.id);
    const pdiv = el("div", "branch");
    const ph = el("div", "bh", `<span class="pdot" style="background:${p.color}"></span>${p.id} ${p.name} <span class="count">${inP.length} seams</span>`);
    const pbody = el("div");
    // sub-group by first classic branch
    const byBranch = {};
    for (const s of inP) { const b = (s.classic_branches[0] || "—"); (byBranch[b] = byBranch[b] || []).push(s); }
    for (const b of Object.keys(byBranch).sort()) {
      const bdiv = el("div"); bdiv.style.marginLeft = "16px";
      const bh = el("div", "bh", `${b} <span class="count">${byBranch[b].length}</span>`);
      bh.style.fontWeight = "400"; bh.style.color = "var(--dim)";
      const bbody = el("div");
      byBranch[b].sort((x, y) => (x.techniques[0].name).localeCompare(y.techniques[0].name)).forEach((s) => {
        const tag = s.origin === "AGENT-DISCOVERED" ? ' <span class="fr" style="color:#bd93f9">⚡new</span>' : (s.kind === "frontier" ? ' <span class="fr">◆</span>' : "");
        const leaf = el("div", "leaf", `<span class="pdot" style="background:${p.color}"></span>${s.techniques[0].name}${tag}`);
        leaf.addEventListener("click", () => showSeam(s.id));
        bbody.append(leaf);
      });
      bh.addEventListener("click", () => bbody.style.display = bbody.style.display === "none" ? "" : "none");
      bbody.style.display = "none";
      bdiv.append(bh, bbody); pbody.append(bdiv);
    }
    ph.addEventListener("click", () => pbody.style.display = pbody.style.display === "none" ? "" : "none");
    pdiv.append(ph, pbody); wrap.append(pdiv);
  }
}

// --------------------------------------------------------------------------- walkthrough view (new techniques + PoC code)
const ROUND = (id) => {
  if (/^(F\d|X-)/.test(id)) return "Seed self-audit";
  const m = id.match(/^GH(\d+)-/); if (m) return "Round " + m[1];
  return "Other";
};
function buildWalk() {
  const c = $("#walk-controls");
  const rounds = [...new Set(DS.seams.filter((s) => s.origin === "AGENT-DISCOVERED").map((s) => ROUND(s.id)))];
  c.innerHTML = `<span class="muted">Detailed walkthrough of each new technique — trust assumption, attack, validity, and the runnable PoC. Click a card to expand.</span>
    <select id="wf-round"><option value="">all rounds</option>${rounds.map((r) => `<option value="${r}">${r}</option>`).join("")}</select>
    <select id="wf-val"><option value="">all validity</option><option value="demonstrated">demonstrated</option><option value="plausible">plausible</option><option value="speculative">speculative</option></select>
    <select id="wf-prim"><option value="">all primitives</option>${DS.primitives.map((p) => `<option value="${p.id}">${p.id} ${p.name}</option>`).join("")}</select>
    <input id="wf-q" placeholder="filter text…"/>`;
  ["#wf-round", "#wf-val", "#wf-prim", "#wf-q"].forEach((s) => $(s).addEventListener("input", renderWalk));
  renderWalk();
}
function renderWalk() {
  const round = $("#wf-round").value, val = $("#wf-val").value, prim = $("#wf-prim").value, q = $("#wf-q").value.toLowerCase();
  const list = $("#walk-list"); list.innerHTML = "";
  const news = DS.seams.filter((s) => s.origin === "AGENT-DISCOVERED")
    .sort((a, b) => ({ demonstrated: 0, plausible: 1, speculative: 2 }[a.validation?.validity] ?? 3) - ({ demonstrated: 0, plausible: 1, speculative: 2 }[b.validation?.validity] ?? 3));
  let n = 0;
  for (const s of news) {
    if (round && ROUND(s.id) !== round) continue;
    if (val && s.validation?.validity !== val) continue;
    if (prim && s.primitive !== prim) continue;
    const t = s.techniques[0] || {};
    const hay = `${t.name} ${s.trust_assumption} ${s.violation} ${s.rationale || ""}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    n++;
    const v = s.validation, a = s.test_artifact;
    const refs = [...(t.attack_ids || []), ...(t.cwe_ids || [])].join(", ");
    const mitre = (t.attack_ids && t.attack_ids.length) ? refs : "none — unmodeled by ATT&CK";
    const valBadge = v ? `<span class="chip" style="border-color:${VALCOLOR[v.validity]};color:${VALCOLOR[v.validity]}">${v.validity}${v.confidence ? " · " + v.confidence : ""}</span>` : "";
    const card = el("div", "gaprow");
    card.style.borderLeft = "3px solid #bd93f9";
    const body = `
      <div class="rat" style="color:#e6edf3"><b>Trust assumption.</b> ${esc(s.trust_assumption)}</div>
      <div class="rat"><b style="color:#d4a0a0">Attack.</b> ${esc(s.violation)}</div>
      <div class="walkdetail" style="display:none">
        ${s.tech_note ? `${s.tech_note.mechanism ? `<div class="rat" style="color:#c9d1d9"><b style="color:#58a6ff">Mechanism.</b> ${esc(s.tech_note.mechanism)}</div>` : ""}
          ${s.tech_note.exploitation_primitive ? `<div class="rat"><b>Exploitation primitive.</b> ${esc(s.tech_note.exploitation_primitive)}</div>` : ""}
          ${s.tech_note.mitre_gap ? `<div class="rat" style="color:#f0a93b"><b>MITRE gap.</b> ${esc(s.tech_note.mitre_gap)}</div>` : ""}
          ${(s.tech_note.anchors || []).length ? `<div class="rat"><b style="color:#7ee787">Real-world anchors.</b> ${s.tech_note.anchors.map((a) => `${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener" style="color:#7ee787">${esc(a.ref)}</a>` : esc(a.ref)}${a.note ? ` <span class="muted">(${esc(a.note)})</span>` : ""}`).join(" · ")}</div>` : ""}
          ${s.tech_note.detection ? `<div class="rat"><b>Detection.</b> ${esc(s.tech_note.detection)}</div>` : ""}
          ${(s.tech_note.references || []).length ? `<div class="rat muted">refs: ${s.tech_note.references.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:#58a6ff">${esc(r.title)}</a>`).join(" · ")}</div>` : ""}` : ""}
        ${s.rationale ? `<div class="rat"><b style="color:#bd93f9">Why it's new.</b> ${esc(s.rationale)}</div>` : ""}
        ${v ? `<div class="res" style="color:#58a6ff"><b>✓ Validate.</b> ${esc(v.validation_method)}</div>
          <div class="rat" style="color:#d4a0a0"><b>✗ Refuted if.</b> ${esc(v.falsifier)}</div>
          ${v.prerequisites ? `<div class="rat"><b>Prerequisites.</b> ${esc(v.prerequisites)}</div>` : ""}
          ${v.existing_controls ? `<div class="rat"><b>Existing controls.</b> ${esc(v.existing_controls)}</div>` : ""}` : ""}
        ${a ? `<div class="k" style="margin-top:8px">proof-of-concept · ${esc(a.name)} <span class="chip op">${a.language}</span></div>
          <div class="rat" style="color:#d4a0a0">⚠ ${esc(a.authorization)}</div>
          ${a.setup ? `<div class="rat muted">setup: ${esc(a.setup)}</div>` : ""}
          <pre class="artifact"><code>${esc(a.script)}</code></pre>
          <div class="rat"><b style="color:#7ee787">Success.</b> ${esc(a.success_criterion)} · <b>Cleanup.</b> ${esc(a.cleanup)} · <b>Safety.</b> ${esc(a.safety)}</div>` : ""}
        ${s.suggested_research ? `<div class="res"><b>↳ Research.</b> ${esc(s.suggested_research)}</div>` : ""}
      </div>`;
    card.innerHTML = `<div class="top" style="cursor:pointer">
        <span class="muted">#${n}</span>
        <span class="chip prim" style="background:${primColor(s.primitive)}">${s.primitive}</span>
        ${valBadge}
        <span class="chip op">${ROUND(s.id)}</span>
        <span class="edge" style="font-weight:700">${esc(t.name)}</span>
        <span class="muted" style="margin-left:auto">MITRE: ${mitre}</span>
        <span class="walktoggle muted">▸</span>
      </div>${body}`;
    const top = card.querySelector(".top"), detail = card.querySelector(".walkdetail"), tog = card.querySelector(".walktoggle");
    top.addEventListener("click", () => { const open = detail.style.display === "none"; detail.style.display = open ? "" : "none"; tog.textContent = open ? "▾" : "▸"; });
    list.append(card);
  }
  if (!n) list.append(el("div", "muted", "no techniques match the filter."));
}

// --------------------------------------------------------------------------- path (kill-chain) view
function buildPath() {
  const c = $("#path-controls");
  const opts = DS.principals.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  c.innerHTML = `
    source <select id="p-src">${opts}</select>
    target <select id="p-dst">${opts}</select>
    scorer <select id="p-scorer"><option value="cls">CLS</option><option value="egq">EGQ</option></select>
    <button id="p-go" style="background:#1f6feb;color:#fff;border:0;padding:5px 12px;border-radius:5px;cursor:pointer">trace</button>`;
  $("#p-src").value = "web"; $("#p-dst").value = "cloud";
  $("#p-go").addEventListener("click", runPath);
  runPath();
}
function runPath() {
  const src = $("#p-src").value, dst = $("#p-dst").value, scorer = $("#p-scorer").value;
  const paths = findPaths(src, dst, scorer);
  const list = $("#path-list"); list.innerHTML = "";
  list.append(el("p", "muted", `Kill chain = a path across seams. The scheduler prioritizes freshly-spawned / frontier edges (★). A path is one traversal; multiple simultaneous paths = parallelism.`));
  if (!paths.length) { list.append(el("div", "muted", `No path ${PNAME[src]} → ${PNAME[dst]} within 5 hops.`)); return; }
  if (paths.length > 1) list.append(el("div", "parallel-note", `${paths.length} parallel paths found — an operator can run them simultaneously.`));
  paths.forEach((p, i) => {
    const card = el("div", "pathcard");
    let h = `<div><span class="score">score ${p.score.toFixed(2)}${p.frontierEdges ? ` · ★${p.frontierEdges} frontier` : ""}</span><b>path ${i + 1}</b> <span class="muted">${PNAME[src]} → ${PNAME[dst]}</span></div>`;
    p.steps.forEach((st) => {
      const s = SEAM[st.seam];
      h += `<div class="pathstep" onclick="showSeam('${st.seam}')">
        <span class="muted">${PNAME[st.from]}</span><span class="arrow"> ──</span><span class="pdot" style="background:${primColor(s.primitive)}"></span>${s.primitive}<span class="arrow">──▸ </span><span class="muted">${PNAME[st.to]}</span>
        &nbsp; ${s.techniques[0].name}${s.kind === "frontier" ? ' <span class="fr" style="color:#ff5c5c">★</span>' : ""}</div>`;
    });
    card.innerHTML = h;
    list.append(card);
  });
}
// Client-side simple-path search mirroring src/scheduler.ts (frontier-priority bonus).
function findPaths(src, dst, scorer, maxLen = 5) {
  const adj = {};
  DS.seams.forEach((s) => s.source.forEach((a) => s.target.forEach((b) => {
    if (a === b) return; (adj[a] = adj[a] || []).push({ seam: s.id, to: b });
  })));
  const scoreOf = (id) => scorer === "egq" ? (SCORE[id].egq || 0) : (SCORE[id].cls || 0);
  const out = [];
  (function walk(node, visited, steps) {
    if (steps.length > maxLen) return;
    if (node === dst && steps.length) {
      let raw = 0, fr = 0;
      steps.forEach((st) => { raw += scoreOf(st.seam); if (SEAM[st.seam].maturity === "frontier") fr++; });
      out.push({ steps: steps.slice(), score: raw * (1 + 0.25 * fr) / steps.length, frontierEdges: fr });
      return;
    }
    (adj[node] || []).forEach((e) => {
      if (visited.has(e.to)) return;
      visited.add(e.to); steps.push({ seam: e.seam, from: node, to: e.to });
      walk(e.to, visited, steps);
      steps.pop(); visited.delete(e.to);
    });
  })(src, new Set([src]), []);
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
}

// expose handlers used in inline onclick
window.showSeam = showSeam; window.showText = showText; window.showCell = showCell;
