# Template: Round N and Follow-ups

Every follow-up or round is a whole new coder session plus a whole new supervisor session. In the
source project that was typically 150–400 requests. Preventing one is worth more than any prompt trim,
so the diagnosis in §2 matters.

## Input
Task file; the latest coder summary; the latest verdict; the latest QA report, if any; the human's notes.

## 1. Classify
| Outcome | Next |
|---|---|
| Supervisor CONDITIONAL | **Follow-up**, same round, same branch. The coder prompt lists only the conditions, each with the mutant that must die. The supervisor prompt re-checks only them. |
| Supervisor FAIL, or QA FAIL | **New round**, same branch. |
| QA PASS with known-debt reds | **Close the task.** Check each named TD and its evidence yourself (the code path is unchanged vs the merge-base). Append the reds to their TD rows as "seen again". Don't open a round for another task's defect. (Source project: a known webhook-ordering bug, owned by another task, failed a correct branch and nearly forced a fourth round.) |
| Supervisor PASS | Generate the **QA prompt** now (`generate_qa_prompt.md`), from the PASS commit. |
| QA RECIPE ERROR | **Not a round.** Fix the `.livetest.md`, record it in the history, and regenerate only the QA prompt. |
| QA BLOCKED | **Not a round.** No prompt change; QA reruns once the environment is back. |
| Round 2 failed | **Stop.** Diagnose and report to the human before any Round 3 prompt. |
| Agent hit its step cap mid-task | **Not a round.** Write a short continuation prompt for the same session: the remaining steps, the decisions already made (for example, the verdict and why), and a call budget. |

## 2. Diagnose: one short paragraph each
- What failed, with the exact evidence.
- Why the tests didn't catch it, and why the review didn't.
- Whose gap it is: code, task file, prompt, or protocol. When it is yours, say so.
- **What would have prevented this session?** A fact missing from the prompt? A risky criterion you
  didn't mark? A test setup helper outside the blast radius? Fix that in the template or the checklist.
- A QA failure labelled "pre-existing" or "environment": check whether this branch's behaviour change
  explains it before accepting the label.

## 3. Update the task file
- If the task was wrong, fix its body in place.
- Append to `.history.md`: the outcome (verdict, and QA separately), the failure with file:line, and
  what changed.
- If behaviour or procedure changed, update `.livetest.md`.

## 4. Prompts
`generate_coder_prompt.md` with **Fix exactly this**; `generate_supervisor_prompt.md` with **Re-check
only** for a follow-up, or **Focus** for a new round. The QA prompt is generated only after the next PASS.
