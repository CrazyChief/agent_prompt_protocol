# Template: QA Prompt

**Generated after the Supervisor's PASS, not in Mode B.** Before the coder works there are no
selectors, routes or final strings to hand over. After the PASS they exist, and you can read them from
the branch. Handing them over is the biggest single saving in the pipeline. In the source project,
over 24 QA sessions: median 206 requests, max 931. 41 % of those calls were reading app code to
rediscover these facts, 13 % were one-statement SQL calls, and 19 % were browser-MCP clicks. Only 3 %
were actual e2e runs.

You hand over **facts**: where things are, what they are called, what the data looks like. You don't
hand over test code; the QA agent writes the test. Pick the **module spec** it belongs to (the module
of the product surface under test, not the task). Name a new module only when no existing module owns
that surface, and say so.

**Read the PASS commit against the recipe.** Trace each expected outcome to the code that produces it.
A mismatch (for example, a refusal message that differs by user state) is a recipe fix you make
**before** QA runs. Record it in the history as "recipe tightened before QA", not as a RECIPE ERROR.
In the source project this step repeatedly caught gaps that both the coder and the Supervisor had missed.

Output to `docs/agent_prompt_protocol/orchestrator/generated/T[XX][-roundN]-qa-prompt.md`.
Read the facts from the PASS commit (`git show <sha>:<path>`, or a worktree), never from memory or an
older task file.

---

```markdown
# T[XX] · [name] — QA, Round [N]

Branch `[branch]` · commit `[sha from the PASS verdict]` · base URL `[url]`
Report → `docs/agent_prompt_protocol/qa_agent/reports/T[XX][-roundN]-qa-report.md`
Spec → `[e2e dir]/[module].spec.*`, new block `describe('T[XX] · [name]')` [or: extend the existing `T[XX]` block, which has steps …; add …]

## Recipe (from `docs/tasks/T[XX]-[name].livetest.md` at `[sha]`)
[pasted verbatim]

## Facts at `[sha]`: use these, don't read application source
- Routes: `[path]` → `[page file]`
- Selectors per step: step [n] → `[role + name | test id | exact text]`
- Data: `[table]`([columns that matter]); a setup row looks like `[insert … values …]`
- Env: `[VAR]` normal value `[…]`; the recipe sets it to `[…]` (restart the dev server after)
- Test account: [how the spec creates it and signs in]
- External services: [CLI commands with their exact form; known lag (search indexes, webhooks); confirmation prompts]
- Support helpers to use (`[e2e support dir]`): `[helper(args)]` in `[file]:[line]`, [what it does]. A missing variant becomes a parameter on the helper, not a copy in the spec.

## Judgement steps (capture the artefact, then judge it against this)
- Step [n]: [explicit criterion]

## Traps
- [e.g. the env change applies only after a dev-server restart; state left in an external service by earlier runs]
```
