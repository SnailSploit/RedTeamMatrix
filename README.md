# RedTeamMatrix

A canonical, machine-readable model of the offensive-security landscape as a **trust hypergraph**,
plus a set of views over it.

→ **The project lives in [`seammap/`](./seammap/).** Start with [`seammap/README.md`](./seammap/README.md).

SEAMMAP models offense as violations of trust relationships ("seams"), not as a list of techniques: six
closed seam primitives, an open set of principals, classic techniques re-homed and 2027 frontier seams
attached to the same primitives — rendered as a hypergraph that spawns its own gaps and self-audits for the
seams nobody wrote down yet.

```bash
cd seammap
node src/build.ts      # render projections + gap register -> web/dataset.json
node src/validate.ts   # definition-of-done invariants
node src/spawn-demo.ts # auto-spawn rule on a hypothetical 2027 node
# open web/index.html
```
