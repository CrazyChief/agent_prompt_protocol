# 00-INDEX — Task Status Board

The single source of truth for task registration and status in `{{PROJECT_NAME}}`.
Mode A reads this file for the status board and the max task ID; Mode B reads task files.

---

## §1 Conventions

### §1.1 Status lifecycle

Defined in `CLAUDE.md` → Status lifecycle (`BACKLOG`, `IN PROGRESS`, `BLOCKED`, `DONE`). `DONE` means
Supervisor PASS **and** QA PASS, relayed by the human. The merge is recorded in the task's board note
when it happens.

### §1.2 Task files: three per task, split by who reads them

| File | Holds | Loaded by |
|---|---|---|
| `T[XX]-[name].md` | objective, background, what to do, constraints, acceptance criteria, risky criteria | coder, supervisor |
| `T[XX]-[name].livetest.md` | the live-test recipe only | QA |
| `T[XX]-[name].history.md` | the round history only (appended, never rewritten) | Orchestrator |

The title line inside the main file is `# T[XX] · [name]`; the other two append `— Live test` and
`— Round History`. The main file carries a one-line pointer to both.

**Why split:** every agent used to load every section. The history grows every round, so it grows
fastest on exactly the tasks that are going badly, and no executing agent needs it. In the source
project the split cut the coder's load by 29–39 % and QA's by 66–69 %, with no loss of information.

> **Test-path convention:** task files state test paths in the shape the unit runner includes
> (`AGENTS.md` → Commands). A test file anywhere else silently never runs.

### §1.3 ID assignment

The first new ID is (max existing ID in §3) + 1, then sequential. Never renumber, never reuse a deleted ID.

### §1.4 Stages

| Stage | Deliverable |
|---|---|
| **0** | {{e.g. foundations: schema, core pipeline, measurement}} |
| **1** | {{…}} |
| **2** | {{…}} |

### §1.5 Deferred / never

| Item | Status |
|---|---|
| {{feature}} | {{Stage N: deferred, not decomposed. / **Never.**}} |

### §1.6 Live-test recipe (mandatory)

**Every task has a live-test recipe, in its own `.livetest.md` file** (§1.2). The Orchestrator writes it
at decomposition and keeps it current across rounds. The QA agent reads it as the operator, then runs it
after a Supervisor PASS as an automated e2e spec (a `T[XX] ·` block in the module spec), and reports
PASS, FAIL, RECIPE ERROR or BLOCKED. The Coding Agent and the Supervisor neither run it nor edit it.

It must contain, in this order:

1. **Setup:** the exact commands, SQL or configuration needed to reach the state under test, and **how
   to undo them**. If the state is destructive or hard to restore, say so. A test nobody can safely
   run is not a test.
2. **The steps:** what a user does, in order.
3. **Expected outcome:** what should be observed, as assertions, including **what must NOT appear**.
4. **Failure layer:** for each way it can go wrong, the layer that owns it (client, API, server,
   database, provider, test setup).
5. **The negative direction:** the check that the change doesn't misfire on the normal path. A guard
   that always refuses, or a parser that eats valid output, passes every positive test.
6. **The pre-existing-data baseline:** what the rows already in the database, and the state already in
   external services, look like when the operator starts, and which steps a *correct* implementation
   makes look wrong. A procedure that assumes freshly-shaped data fires a false alarm on the data
   that actually exists.
7. **Scriptable steps, and the ones that aren't:** write each mechanical step as something a script can
   assert (a URL, a status code, a row, a string, a count). **Mark the steps that need a person's
   judgement.** Unmarked, they get scripted into an assertion that passes on anything. Once scripted,
   every later QA run re-runs every earlier recipe for free.

**Read the recipe as the operator before shipping it.** At every step, ask whether a correct
implementation passes, and whether the step depends on luck. **Test the property, not an example of
it.** A recipe is reviewed, not just written.

**Why this is mandatory.** A change can pass review with a killed mutant and a wiring check, then fail
its first live run in one request, because nothing in the suite drove the real pair of components. The
live test finds it in thirty seconds, but only if one was written down.

---

## §2 Current scope of this board

{{Which stages/phases this board covers now.}}

---

## §3 Status board

| ID | Task | Stage | Depends on | Parallelisable with | Status |
|---|---|---|---|---|---|

> Board notes go below the table, newest first: registrations, execution order, DONE and merge
> records, and decisions waiting on the human.
