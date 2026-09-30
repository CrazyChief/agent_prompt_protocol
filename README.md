# Agent Prompt Protocol (portable edition)

A way to build software with four AI agents and one human in the loop. It works with any tech stack.

| Agent | Job | Typical runtime |
|---|---|---|
| **Orchestrator** | Turns scope into task files, writes complete prompts, keeps the board true. Writes no application or test code. | Claude Code (reads `CLAUDE.md`) |
| **Coding agent** | Implements one task with TDD on a feature branch, proves its risky criteria with mutants, writes a summary. | OpenCode (or any agent CLI) |
| **Supervisor** | Reviews the branch against the task, from the code, and runs mutants. Writes a verdict: PASS / CONDITIONAL / FAIL. | OpenCode |
| **QA agent** | After a Supervisor PASS, runs the task's live-test recipe as an automated end-to-end spec against the running app. Writes a report. | OpenCode |

Handoff is **human copy-paste**: the human carries each prompt, summary and verdict between agents,
and can veto at any point.

This is the **fifth version** of the protocol. It has been used across **five production projects**:
200+ tasks and 500+ rounds. Each project's lessons were folded back into the rules, templates and
scripts. This edition is distilled from version 5, with the project-specific parts turned into slots.

The central fact behind every rule: **the executing agents are billed per request, and one tool call is
one request.** So the Orchestrator discovers and the agents execute. Prompts are long and complete,
scripts replace command sequences, and rounds are the thing to prevent.

The numbers quoted in the docs ("in the source project: …", request counts, percentages) were
measured on the fifth project: 72 agent sessions, analysed call by call from the OpenCode database.
The "(Source project: …)" examples in the templates also come from there. The rules they justify are
the accumulated result of all five projects.

> **NOTE**: This protocol is mainly adapted for Claude Code (with Anthropic models) + Ollama based models for OpenCode for now!
> Just because the old style Ollama subscription utilized per-request usage we carry here with steps allowed to execute per agent.
> This may NOT be efficient and beneficial for per-token use, so do NOT expect too much from it.

> This protocol will be updated with alternative (per-token) usage once we will migrate to another providers.

---

## Install

```sh
cp -R project/. /path/to/your/repo/
cat /path/to/your/repo/.gitignore.protocol >> /path/to/your/repo/.gitignore && rm /path/to/your/repo/.gitignore.protocol
chmod +x /path/to/your/repo/scripts/agent/opencode.sh
```

This gives you:

```text
AGENTS.md                       rules every agent follows (template: fill it in)
CLAUDE.md                       the Orchestrator's instructions (template: fill the slots)
agent-protocol.config.json      what the scripts run in YOUR stack (edit this first)
opencode.jsonc                  the coder / supervisor / qa agents (models, steps, permissions)
.opencode/plugins/loop-guard.ts stops an agent that repeats the same tool call
.opencode/home/opencode/        a lean config home for the launcher
scripts/agent/                  gate · e2e · review-pack · mutants · qa-preflight · opencode.sh
docs/agent_prompt_protocol/     role files, Orchestrator templates, workflow
docs/tasks/00-INDEX.md          the task board
```

The scripts need **Node ≥ 18** (no npm dependencies) and **git**, whatever your project is written in.

## Adapt: in this order

1. **`agent-protocol.config.json`**: your typecheck, lint, unit-test and e2e commands. The one hard
   requirement is that your test runners can write **JUnit XML**:
   - Vitest `--reporter=junit`
   - Jest `jest-junit`
   - pytest `--junitxml`
   - Go `gotestsum --junitfile`
   - cargo `nextest --profile ci`
   - Gradle and Maven (built in)
   - Playwright `--reporter=junit`

   Then:
   - Run `node scripts/agent/gate.mjs` until it prints `GATE ok` or names real failures.
   - Record today's known failures once with `node scripts/agent/gate.mjs --record`. That is the
     operator's action, and agents are never told about it.
2. **`AGENTS.md`**: replace every `{{…}}`. Keep hard rules H1, H3, H5 and H6 as they are; they are
   stack-neutral. Write your product invariants: the things that fail silently in *your* domain.
3. **`CLAUDE.md`**: the Orchestrator's slots (spec path, stages, the optional product filter, the
   optional model policy).
4. **`opencode.jsonc`**: pick models per role, keep the `steps` caps, deny the tools your global setup
   injects, and translate your hard rules into `permission.bash` denies.
5. **`agent-protocol.config.json` → `reviewPack.ruleChecks`**: one regex check per hard rule that a
   diff can reveal (a banned model name, an edited migration, a secret-shaped string).
6. **`docs/tasks/00-INDEX.md`**: stages (your roadmap phases) and the board.

To find what is left, run `grep -rn "{{" AGENTS.md CLAUDE.md docs/ agent-protocol.config.json opencode.jsonc`.

## Placeholders

| Placeholder | Meaning | Example |
|---|---|---|
| `{{PROJECT_NAME}}` | repo / product name | `acme-api` |
| `{{PROJECT_SUMMARY}}` | 2–4 lines: what it is, the stack | "B2B invoicing API: Go + Postgres + Stripe" |
| `{{SPEC_PATH}}` | the source-of-truth spec | `docs/spec.md` |
| `{{MAIN_BRANCH}}` | protected branch | `main` |
| `{{LAYOUT}}` | where code lives (bullets) | `cmd/`, `internal/`, `migrations/` |
| `{{READ_ONLY_PATHS}}` | repos/dirs agents must never modify | a sibling repo, a vendored SDK |
| `{{MIGRATIONS_DIR}}` | schema migrations directory, or "none" | `db/migrations/` |
| `{{DESTRUCTIVE_DATA_COMMANDS}}` | commands only the human may run | `supabase db reset`, `rails db:drop` |
| `{{PAID_APIS}}` | external APIs that cost money | `OpenAI`, `Stripe live mode` |
| `{{SENSITIVE_DATA}}` | what must never reach a response, log or evidence | PII, source documents, keys |
| `{{E2E_DIR}}` · `{{E2E_SUPPORT_DIR}}` | e2e specs · shared e2e helpers | `tests/e2e/` · `tests/e2e/support/` |
| `{{E2E_MODULES}}` | product modules, one e2e spec each | `auth, billing, dashboard` |
| `{{BASE_URL}}` | the running app for QA | `http://localhost:3000` |
| `{{CODE_SEARCH}}` | how to find existing code / callers (optional tool) | `rg`, `ripwire`, an LSP, IDE search |

## What is deliberately not here

- **Stack-specific prose.** The original named Nuxt, Supabase, Stripe and Playwright. Here those are
  slots, and the patterns stay: a shared e2e support module, setup helpers, a live-test recipe per task.
- **The changelog agent** from the original. It is independent of this loop.
- **Case histories.** A few one-line "(Source project: …)" examples stay in the templates, because they explain why a
  rule exists. Keep adding your own the same way: one line, next to the rule it justifies.

## If you don't use OpenCode

The role files are plain system prompts. Load them however your agent CLI takes a system prompt, and
enforce the same limits by other means:
- a step cap;
- denied tools (todo lists, sub-agents, browser MCP for QA);
- edit permissions (the Supervisor writes only verdicts; QA writes only e2e specs and reports);
- a loop guard.

`opencode.jsonc` documents each limit and why it exists.

# Donations

> Suggested to donate? Please include your github, so we will be able to showcase you here! Thanks!

<a href="https://www.buymeacoffee.com/crazychiefv" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" style="height: 60px !important;width: 217px !important;" ></a>

# Contribution

You're wellcome to open PR

# LICENSE

Agent Prompt Protocol is licensed under Apache-2.0. See [LICENSE](LICENSE) for the full license text.
