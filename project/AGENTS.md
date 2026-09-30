# {{PROJECT_NAME}} — instructions for every agent

Loaded automatically by the executing agents (OpenCode reads `AGENTS.md`). The Orchestrator imports it
from `CLAUDE.md`. Every rule below lives only here: prompts, role files and task files point to it and
never restate it. Everything in this file is paid for on every turn of every session, so only
always-true content belongs here.

## Project

- {{PROJECT_SUMMARY}}
- Source of truth: `{{SPEC_PATH}}`. Where this file disagrees with the spec, the spec wins and this
  file has a bug.
- Tasks and status: `docs/tasks/` (board: `00-INDEX.md`). A task file is the only source of *what* to build.
- Layout:
  {{LAYOUT}}
  - Application code outside these locations (config files excepted) is a CRITICAL violation.

## Roles

| You are | Your instructions |
|---|---|
| Coding agent | `docs/agent_prompt_protocol/coding_agent/role_and_goals.md` |
| Supervisor agent | `docs/agent_prompt_protocol/supervisor_agent/role_and_goals.md` |
| QA agent | `docs/agent_prompt_protocol/qa_agent/role_and_goals.md` |

These role files are those agents' system prompts (`opencode.jsonc`,
`scripts/agent/opencode.sh coder|supervisor|qa`). They are already loaded, so never re-read them.
Case histories are in `docs/lessons_learned.md`, and no agent is required to read them.

## Commands

Run from the repo root. Each one prints a verdict, not logs. Never pipe them through `tail`, `head` or `grep`.

| Purpose | Command |
|---|---|
| **Is anything broken?** | **`node scripts/agent/gate.mjs`**: every static check plus the full unit suite in one call. Prints `GATE ok`, or names only the **NEW** failures (the known ones are in `tests/known-failures.json`, which only the operator edits). Use this, not the separate commands. |
| One test file (a RED, a GREEN, a mutant) | `node scripts/agent/gate.mjs <test file>` |
| End-to-end suite | `node scripts/agent/e2e.mjs [<filter>]`. It probes the environment first and refuses with `BLOCKED: environment not here` when a dependency is down. It prints the pass / fail / did-not-run counts and names only the failures. Specs live in `{{E2E_DIR}}`, one per product module (`{{E2E_MODULES}}`). Shared helpers live once in `{{E2E_SUPPORT_DIR}}`. |
| Review pack (Supervisor; the coder's summary header) | `node scripts/agent/review-pack.mjs <merge-base> [--short] [--no-gate]` |
| Mutants, as a batch | `node scripts/agent/mutants.mjs <<'EOF' [ {name, file, find, replace, test}, … ] EOF` |
| QA preflight | `node scripts/agent/qa-preflight.mjs <branch> <commit>` |
| Dev server | `{{DEV_SERVER_CMD}}` |
| {{OTHER_PURPOSE}} | `{{OTHER_CMD}}` |

Test files live at `{{UNIT_TEST_GLOB}}`, the only pattern the unit runner includes. A test file
anywhere else never runs.

## Hard rules

Human directives. The severity is what the Supervisor assigns. H1, H3, H5 and H6 are stack-neutral:
keep them. Rewrite or delete the others, and add yours as H9, H10, … Enforce each one mechanically
where you can: an `opencode.jsonc` permission deny, or a `reviewPack.ruleChecks` entry in
`agent-protocol.config.json`.

| ID | Rule | Severity |
|---|---|---|
| **H1** | Never commit to `{{MAIN_BRANCH}}`. Work on a feature branch. Round N and follow-ups stay on **the same branch**. | CRITICAL |
| **H2** | Never modify `{{READ_ONLY_PATHS}}`. They are read-only under all circumstances. | CRITICAL |
| **H3** | Never run `{{DESTRUCTIVE_DATA_COMMANDS}}` in any form: that is the human operator's exclusive action. Migrations in `{{MIGRATIONS_DIR}}` are append-only: never edit, rename, reorder or delete an existing one. Drop or retype a column via expand/contract (add → backfill → drop later). A statement that redefines an object in full (a function, a view, a policy) restates its whole body, so read it as it stands **now** and keep every behaviour it has. If a reset seems required, stop and report. | CRITICAL |
| **H4** | {{MODEL_AND_COST_POLICY — e.g. "Model X is banned. Every LLM call uses <model> unless the task names another. No model name as a runtime fallback default (`env.X ?? '<model>'`)." Delete if the product calls no LLM.}} | FAIL |
| **H5** | No test in the default suite may call a paid or rate-limited external API (`{{PAID_APIS}}`). Put it behind an explicit opt-in env flag, or keep it out of the default test path. | FAIL |
| **H6** | Never rewrite a historical record: task `.history.md` files, measurement and eval reports, baselines, agent summaries. Append a new section instead. | CRITICAL |
| **H7** | {{PROJECT_RULE — e.g. a forbidden tool, vendor or skill}} | FAIL |
| **H8** | {{SENSITIVE_DATA}} never reaches a user-reachable response, a stream frame, a debug field, a log line or QA evidence. | CRITICAL |

Usage spent against a cost rule is recorded as debt, with its cost.

## Product invariants

The properties that fail **silently** in this product: no error, no red test, plausible-looking
output. Task files name them by number. Write each one as a checkable statement with its severity.

| # | Invariant | Severity |
|---|---|---|
| **1** | {{e.g. "Tenancy: every query is scoped by tenant; ownership enforced by the database, not the endpoint."}} | CRITICAL |
| **2** | {{e.g. "Money: amounts are integer minor units; Stripe is the truth and the local table is a cache with a reconcile path."}} | CRITICAL |
| **3** | {{e.g. "i18n: never hardcode a locale; the user's profile drives output."}} | FAIL |

## Engineering principles

- **SOC:** one unit, one job. HTTP handlers are HTTP shape only (parse, delegate, respond). Business
  logic, data access and provider calls each live in their own module.
- **DYC:** comment the *why*, never the *what*. {{List the spots that must always carry a why-comment,
  e.g. "every deliberate security exception", "every concurrency accommodation".}}
- **DRY: don't reinvent the wheel.** Before writing anything, stop at the first hit:
  1. this codebase (`{{CODE_SEARCH}}`);
  2. the platform or standard library;
  3. an installed dependency.

  Keep one implementation each of: {{the cross-cutting concerns, e.g. error taxonomy, auth-client
  construction, retry/backoff, serialisation}}.
- **KISS:** readable over clever. An explicit `if` over a lookup table that saves four lines.
- **TDD:** RED → GREEN → REFACTOR. Tests come from the acceptance criteria and are seen failing before
  the implementation exists. A test that passes on first run tested nothing. A property that already
  holds gets a mutant as its RED. Evidence is a separate `test:` commit or captured failure output.
- **YAGNI:** only what the task asks, in the current phase. Deferred scope lives on the board
  (`00-INDEX.md` §1.5), not in the code. An exception needs its retrofit cost written down.
- **Bottom line:** leave the files you touch cleaner, not different. Unrelated mess goes to
  `docs/tech-debt.md`, unfixed.

## Git

- Branch before changing any file: `git checkout -b <type>/<short-description>` from the base the
  prompt names. Types: `feature/`, `fix/`, `refactor/`, `test/`, `docs/`, `chore/`.
- Conventional Commits: `<type>: <description>` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`).
  The description says what changed.
- Commit failing tests separately where practical. Uncommitted work was not delivered.
- The QA agent checks out the branch under test and commits **one** thing: its live test under
  `{{E2E_DIR}}` (a `T[XX]` block in the module spec, plus any shared helper it added to
  `{{E2E_SUPPORT_DIR}}`), as `test(e2e): …`. No source file, no task file, no fix. The tree is otherwise
  as it was found.
- Agents never merge. The human does.
