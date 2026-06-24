const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const ROOT = path.join(__dirname, "web");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end("nf"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "text/plain" });
    res.end(d);
  });
});

(async () => {
  await new Promise((r) => server.listen(8123, r));
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));

  await page.goto("http://localhost:8123/index.html", { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500)); // let cose layout settle

  const views = ["graph", "matrix", "tree", "gaps", "path"];
  for (const v of views) {
    await page.click(`nav button[data-view="${v}"]`);
    await new Promise((r) => setTimeout(r, v === "graph" ? 2500 : 900));
    await page.screenshot({ path: path.join(__dirname, `shot-${v}.png`) });
    console.log(`shot-${v}.png`);
  }

  // sanity: assert each view rendered real content
  const checks = await page.evaluate(() => ({
    meta: document.querySelector("#meta").textContent,
    matrixRows: document.querySelectorAll("#matrix tr").length,
    treeBranches: document.querySelectorAll("#tree .branch").length,
    gapRows: document.querySelectorAll("#gaps-list .gaprow").length,
    pathCards: document.querySelectorAll("#path-list .pathcard").length,
    cyType: typeof window.cy,
    cyIsFn: window.cy && typeof window.cy.nodes === "function",
    cyNodes: (window.cy && typeof window.cy.nodes === "function") ? window.cy.nodes().length : -1,
    cyEdges: (window.cy && typeof window.cy.edges === "function") ? window.cy.edges().length : -1,
  }));
  console.log("RENDER CHECKS:", JSON.stringify(checks));
  console.log("CONSOLE ERRORS:", errs.length ? errs.join(" | ") : "none");

  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
