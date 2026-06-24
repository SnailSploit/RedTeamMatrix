// Shows the data-driven optimizer: ranked priorities + a budget-constrained optimal set,
// plus the program's self-measured data coverage. Run: node src/optimize-demo.ts
import { loadDataset } from "./model.ts";
import { rankPriorities, optimizeUnderBudget, coverage } from "./optimize.ts";

const ds = loadDataset();
const cov = coverage(ds);
console.log("Data coverage (how data-driven the model is right now):");
console.log(`  seams=${cov.seams}  artifact_coverage=${(cov.artifact_coverage * 100).toFixed(1)}%  ` +
  `poc_confirmed=${cov.poc_confirmed}  validation_coverage=${(cov.validation_coverage * 100).toFixed(1)}%\n`);

console.log("Top 12 data-driven priorities (yield/effort, with the data layers that drove each):");
for (const p of rankPriorities(ds, 12)) {
  console.log(`  ${String(p.score).padStart(6)}  ${p.primitive}  ${p.id}  [${p.drivers.join(",")}]`);
}

const budget = 25;
const opt = optimizeUnderBudget(ds, budget);
console.log(`\nBudget-constrained optimum (effort <= ${budget}): ${opt.selected.length} seams, ` +
  `total yield ${opt.totalYield}, effort ${opt.totalEffort}.`);
console.log("These are the highest-value edges to operationalize first under a fixed effort budget.");
console.log("As validations and PoC results are added, the data shifts and the queue re-optimizes — closed loop.");
