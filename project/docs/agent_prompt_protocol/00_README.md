# Agent Prompt Protocol

How this project is built by agents with the human in the loop. Handoff is human copy-paste, the only mode.

## Agents

| Agent | Tool · launch | System prompt |
|---|---|---|
| **Orchestrator** | Claude Code | `CLAUDE.md` (imports `AGENTS.md`) |
| **Coding Agent** | `scripts/agent/opencode.sh coder` * | `coding_agent/role_and_goals.md` |
| **Supervisor** | `scripts/agent/opencode.sh supervisor` * | `supervisor_agent/role_and_goals.md` |
| **QA Agent** | `scripts/agent/opencode.sh qa` * | `qa_agent/role_and_goals.md` |

\* The launcher runs `opencode --agent <role>` with a lean global config home (`.opencode/home`), so your
global plugins and MCP servers don't load, since their injected instructions cost requests.

**Loop guard** (`.opencode/plugins/loop-guard.ts`, loaded for every OpenCode session in the repo): it
compares consecutive tool calls across the whole session. The 2nd identical call runs with a warning
appended, the 3rd is blocked without executing, and the 5th aborts the session. Two identical
text-only replies get a system-prompt warning, and the 4th aborts. In the source project, before the
guard, one model wasted 670 requests on identical repeats, up to 297 in a row.

The three executing agents are defined in `opencode.jsonc`: model, system prompt, a `steps` cap, the
tools they may not use, and permission guards for the hard rules. OpenCode also loads `AGENTS.md`. The
human stays in the loop after QA: they relay the QA report to the Orchestrator, spot-check when they
choose, and can veto.

Flow and round rules: [`workflows/execution_loop.md`](./workflows/execution_loop.md).

## The cost model: requests, not tokens

The executing agents are billed **per request**, and one tool call is one request. In the source
project: about 600 requests per task, QA 47 % of them, coder 40 %, Supervisor 13 %. Everything in this
protocol follows from that:

- **The Orchestrator discovers; the agents execute.** Prompts carry the task text, code excerpts,
  blast radius, selectors and data shapes, so no agent spends requests rediscovering them. A long,
  complete prompt is cheap.
- **One script call replaces a command sequence**, and prints a verdict rather than logs. What each
  script runs in this stack is set in `agent-protocol.config.json`:

  | Command | Replaces | Used by |
  |---|---|---|
  | `node scripts/agent/gate.mjs [<test file>]` | typecheck + lint + unit suite vs known failures | coder, supervisor |
  | `node scripts/agent/e2e.mjs [<filter>]` | the e2e suite, environment probe first | coder (when e2e is part of done), QA |
  | `node scripts/agent/review-pack.mjs <base> [--short] [--no-gate]` | git log/diff/stat, hard-rule checks, route→spec leads, gate | supervisor; coder's summary |
  | `node scripts/agent/mutants.mjs <<'EOF' [ … ] EOF` | edit → run → restore per mutant | coder (self-check), supervisor |
  | `node scripts/agent/qa-preflight.mjs <branch> <sha>` | checkout/HEAD/tree checks, env probes, dev-server env | QA |

- **Rounds are the biggest multiplier.** A follow-up is a new coder session plus a new supervisor
  session. The coder proves its risky criteria with mutants before handing in, so surviving mutants
  stop turning into CONDITIONALs.

## Where each rule lives: one place only

| Rule | Home |
|---|---|
| Project, commands, hard rules, product invariants, engineering principles, git | `AGENTS.md` |
| Orchestrator job, round limit, status lifecycle, optional product filter and model policy | `CLAUDE.md` |
| Coder workflow, regression ownership, summary format | `coding_agent/role_and_goals.md` |
| Review checklist, severity, verdict format | `supervisor_agent/role_and_goals.md` |
| Live-test execution, QA verdicts, report format | `qa_agent/role_and_goals.md` |
| Task conventions, live-test sections, the board | `docs/tasks/00-INDEX.md` |
| What to build for one task / how to live-test it | its task file / its `.livetest.md` |

Prompts point to these homes and never restate them. `docs/lessons_learned.md` holds case histories,
and no agent is required to read it.

## Changing the protocol

A new rule goes to its one home, and names what it replaces or why nothing does. A rule that can be a
script check (`agent-protocol.config.json` → `reviewPack.ruleChecks`) or an `opencode.jsonc` permission
becomes one instead of prose. Human directives become hard rules in `AGENTS.md`. Earlier revisions
are in git history.

## Directory

```text
AGENTS.md                   shared instructions (OpenCode; imported by CLAUDE.md)
CLAUDE.md                   Orchestrator instructions (Claude Code)
agent-protocol.config.json  the commands and rule checks the scripts run
opencode.jsonc              the coder / supervisor / qa agents
scripts/agent/              gate · e2e · review-pack · mutants · qa-preflight · opencode.sh (launcher)
.opencode/                  plugins/loop-guard.ts · home/ (lean config home for the launcher)
docs/tasks/00-INDEX.md      conventions + the status board
docs/agent_prompt_protocol/
├── 00_README.md
├── orchestrator/      templates/{scope_to_tasks, generate_coder_prompt, generate_supervisor_prompt,
│                      generate_qa_prompt, round_n_debugger} · generated/ (gitignored)
├── coding_agent/      role_and_goals · summaries/ (gitignored)
├── supervisor_agent/  role_and_goals · verdicts/ (gitignored)
├── qa_agent/          role_and_goals · reports/ (gitignored)
└── workflows/         execution_loop
```
