# Execution Loop

```
Human ─ scope ─────────────────▶ Orchestrator (Mode A) ─ decomposition table ─▶ Human approves ─▶ task files
Human ─ "prompts for T[XX]" ───▶ Orchestrator (Mode B) ─ coder + supervisor prompts
Human ─ coder prompt ──────────▶ Coding Agent ─ branch + summary
Human ─ prompt + summary ──────▶ Supervisor ─ verdict
      CONDITIONAL → follow-up: same round, same branch, only the conditions → Supervisor re-checks them
      FAIL        → Round N+1, same branch
      PASS        ↓
Human ─ "supervisor PASS" ─────▶ Orchestrator (Mode C) ─ QA prompt, facts read from the PASS commit
Human ─ QA prompt ─────────────▶ QA Agent ─ spec + report ─▶ Human (optional spot-check) ─▶ Orchestrator
      PASS         → Orchestrator sets DONE → Human merges
      FAIL         → Round N+1, same branch
      RECIPE ERROR → Orchestrator fixes the .livetest.md → new QA prompt (not a round)
      BLOCKED      → QA reruns when the environment is back (not a round)
Round 2 failed → Orchestrator diagnoses and reports before any Round 3
```

| Step | Who | Reads | Produces |
|---|---|---|---|
| Decompose | Orchestrator | spec, index, code, reference | task files, index rows |
| Prompt (B) | Orchestrator | task file, code (blast radius, excerpts) | `orchestrator/generated/T[XX]-{coder,supervisor}-prompt.md` |
| Build | Coding Agent | its prompt only (+ one batched read) | branch, commits, `coding_agent/summaries/T[XX]-summary.md` |
| Review | Supervisor | its prompt + `review-pack` | `supervisor_agent/verdicts/T[XX]-verdict.md` |
| Prompt (C) | Orchestrator | PASS verdict, the branch at its commit | `orchestrator/generated/T[XX]-qa-prompt.md` |
| Live test | QA Agent | its prompt + `qa-preflight` | a `T[XX]` block in the e2e module spec (committed), `qa_agent/reports/T[XX]-qa-report.md` |
| Relay | Human | QA report | signal to the Orchestrator; optional spot-check or veto |
| Close | Orchestrator | verdict, QA report | status, history |
| Merge | Human | — | the main branch |

**If the agent's step cap is hit mid-task:** don't just tell it "finish". Give it a short continuation
prompt that names the remaining steps, the decisions already made (such as the verdict), and a call
budget.
