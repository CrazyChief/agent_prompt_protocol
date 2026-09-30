# Template: Scope to Tasks (Mode A)

Raw scope in, registered task files out. Four deliverables, in order. Don't write task files before
the human approves the decomposition table.

---

## Deliverable 1: integration analysis (short)

Investigate first:
- the spec (`CLAUDE.md` → Where things live);
- `docs/tasks/00-INDEX.md`;
- adjacent task files;
- the code (orient with your code-search tool, then find callers and uses of what the scope touches);
- any reference implementation, read-only.

Report:
* **Alignment and phase** (`00-INDEX.md` §1.4). Later-phase scope is deferred, not decomposed.
* **Audience:** if `CLAUDE.md` has a product filter, apply it. Scope that serves someone else goes to
  `docs/future_improvements.md`.
* **Invariants at risk**, by number from `AGENTS.md` → Product invariants.
* **Existing tasks** it depends on or overlaps with, and open debt in `docs/tech-debt.md` it could absorb.
* **What the reference does**, with file:line, where applicable.

## Deliverable 2: decomposition table → human approval

| ID | Title | Stage | Depends on | Parallelisable with | Objective (one line) |
|---|---|---|---|---|---|

* IDs: the max existing ID in `00-INDEX.md` §3, plus one, sequential. Never renumber or reuse.
* Atomic: one objective, one merge, about six acceptance criteria at most. Two independent objectives
  are two tasks.

**Stop here until the human approves.**

## Deliverable 3: task files

`docs/tasks/T[XX]-[name].md`:

```markdown
# T[XX] · [name]

- **Status:** `BACKLOG`
- **Stage:** [phase]
- **Depends on:** [real task IDs, or —]
- **Primary docs:** [spec §…, other docs, as relative links]

**Objective:** [one sentence]

> **Live test:** `T[XX]-[name].livetest.md` (QA runs it). **Round History:** `T[XX]-[name].history.md` (Orchestrator's).

## Background
[What was observed or decided, with evidence: ids, file:line, the reference's file:line.]

## What to do
1. [concrete step]

## Constraints
- [task-specific constraints only; hard rules are not repeated here]
- **Invariants at risk:** [by number from AGENTS.md → Product invariants, or None]
- **Shared seams:** [the production implementation behind any seam this task adds a caller to, or None]
- **Not in scope:** [what a reader might expect here but belongs elsewhere]

## Files & paths
[expected files; test paths in the shape the unit runner includes]

## Acceptance criteria
- [ ] [testable, unambiguous]
- [ ] [for a shared seam: a test drives the real implementation with only the network/DB faked]

## Risky criteria
[the criteria a weak test could miss, each with the path where it is easiest to drop (the failure
path, the empty case, the "every" in "every order"). The coder proves each with mutants; the
Supervisor re-runs them. A structural criterion ("one definition") gets the grep that proves it.]
```

Next to it, never inside it (the coder pays for every line of the main file):
* `T[XX]-[name].livetest.md`: run by the QA agent, per `00-INDEX.md` §1.6.
* `T[XX]-[name].history.md`: `*No rounds recorded yet.*`, or the registration note.

## Deliverable 4: register

Append rows to `00-INDEX.md` §3, sorted by ID, status `BACKLOG`. Add an execution-order note if the
order changed. Point any debt the task absorbs at it in `docs/tech-debt.md`.

## Self-check
- [ ] Investigated before decomposing; table approved before writing.
- [ ] IDs sequential; every dependency exists.
- [ ] Each task atomic; criteria checkable; risky criteria marked; `.livetest.md` read as the operator.
- [ ] Index rows added. Only markdown written.

Report to the human: files created, index rows added, and the first task whose dependencies are `DONE`.
