# Template: Coder Prompt

**The cost is requests, not length.** The coder pays one request for every file it opens and every
search it runs, so the prompt carries everything it would otherwise go and find. A long, complete
prompt is cheap. A short prompt that sends the coder exploring is what costs: in the source project the
coder median was 239 requests per session, and 45 % of those were reads and searches. The role file is
already its system prompt, so never restate it.

Output to `docs/agent_prompt_protocol/orchestrator/generated/T[XX][-roundN|-followupN]-coder-prompt.md`.

## What goes in, and why
- **The task text, pasted in:** objective, what to do, constraints, acceptance criteria. The task file
  stays the one maintained source; the prompt is a snapshot of it, stamped with the commit. Leave out
  the live test and the history (they live in their own files).
- **Code excerpts:** the functions the coder will change or imitate, with `file:line`, read from the
  tree at the stamped commit. Paste the part that matters, not whole files. If a file is too big to
  excerpt, list it under *Read first*: the coder reads that whole list in one turn.
- **Blast radius:** every caller and every read/write of each symbol it changes, plus the traps (a
  search that returns 0 but has a real reader). **Include the test setup helpers** (unit fixtures and
  e2e support) that fake the state the change affects. The coder doesn't search again.
- **Risky criteria:** the ones the coder must prove with mutants before handing in. Name the behaviour
  that must break, not the test code; writing tests is the coder's job. A criterion that says
  **"always"** or **"every"** gets a line naming the path where it is easiest to drop: the failure path,
  the empty case. (Source project: "verdict line always" was proven on the green path only.)
  A **structural** criterion (one definition, no second copy, X calls Y) can't be proven with a mutant.
  Put the exact grep and its expected output in *Done* instead. (Source project: "no second read" had
  no check, and the coder left it in place.)
- **Stop conditions** specific to this task.

## Handover rules
- **Don't commit. Ask the human to.** Name the task-file edits the prompt depends on, and say they must
  be committed before the coder starts. Give the branch base as "from `<main>` once <that commit> is
  in `git log -1`". (Source project: four files were lost to a branch cut before the commit.)
- The branch is always a new one for the coder, `<type>/<short-description>`. An instruction the human
  gave *you* about staying put is never relayed as the coder's base.
- Never phrase a tree check as "confirm `git status` is clean". The coder's rule is *stop and report*.
- Write every path in full, never `…/summaries/…`. (Source project: an elided path put a 14 KB summary
  into the board folder.)

---

~~~markdown
# T[XX] · [name] — Coder, Round [N]

## Branch
From `[base]` at `[sha]` → new branch `[type/name]`. [Round N / follow-up: stay on `[branch]`.]

## Task (from `docs/tasks/T[XX]-[name].md` at `[sha]`)
[objective · what to do · constraints · acceptance criteria, pasted verbatim]

## Code you will touch (at `[sha]`)
`[file]:[from]-[to]`
```
[excerpt]
```

## Read first (one turn, all at once)
- `[file]`: [why]

## Facts verified at `[sha]`
- `[symbol]` is reached from `[file:line]`, `[file:line]`. That is the whole blast radius; don't search again.
- Trap: [e.g. the search tool misses a non-call-shaped read at `file:line`]
- Test setup that fakes the affected state: `[helper]` in `[file:line]` → [still true after this change? | must change]
- Expected to change: `[paths]`. Not expected: `[paths]`.
- E2E part of done? [yes: a route / rendered branch / user-facing string changes, **or gate / auth /
  billing behaviour an e2e setup helper fakes** | no]. (Source project: a quota-gate change broke three
  e2e setups that the prompt had declared out of reach.)

## Risky criteria: prove each with mutants before you hand in
- AC[n]: [the behaviour a mutant must break, e.g. "the header is omitted when the token is null"]

## Fix exactly this   ← Round N / follow-up only
1. [failure or condition, file:line, what done looks like]

## Stop and report if
- [task-specific stop condition]

## Done
Gate ok · every risky-criterion mutant killed · [structural grep: `…` → expected output] · [e2e verdict
quoted | live run of X: output quoted **in the summary**] · committed · summary written to
`docs/agent_prompt_protocol/coding_agent/summaries/T[XX][-roundN]-summary.md`. Then stop.
~~~
