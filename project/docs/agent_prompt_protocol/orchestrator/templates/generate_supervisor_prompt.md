# Template: Supervisor Prompt

The Supervisor has its role, checklist and verdict format as its system prompt, and `review-pack` gives
it the diff in one call. The prompt adds only what it can't know: the task text, the risks worth a
mutant, and the coder's summary. Aim for one pack call, one batched read, one mutants call and one write.

Output to `docs/agent_prompt_protocol/orchestrator/generated/T[XX][-roundN|-followupN]-supervisor-prompt.md`.

**Focus items are review guidance, not test code.** Name the behaviour, where it lives, and the
mutation that should turn a test red (`find` / `replace` at `file:line`). The Supervisor runs it. You
never write or edit tests. `mutants.mjs` requires `find` to occur exactly once, so check that before
you hand the string over.

---

```markdown
# T[XX] · [name] — Supervisor, Round [N]

Branch `[branch]` · merge-base `[sha]`
Verdict → `docs/agent_prompt_protocol/supervisor_agent/verdicts/T[XX][-roundN|-followupN]-verdict.md`

## Task (from `docs/tasks/T[XX]-[name].md` at `[sha]`)
[acceptance criteria · invariants at risk · shared seams, pasted verbatim]

## Focus: answer each in the verdict
1. [risk], `[file:line]`, mutant: replace `[find]` with `[replace]`; `[test file]` should go red
Tool traps: [e.g. the pack's route grep misses a route built from a variable; check `file:line`]

## Re-check only   ← follow-up only
1. [condition from the previous verdict, with its mutant]

## Coder summary
[PASTE THE CODING AGENT SUMMARY HERE]
```
