# Tech debt

Noticed, not fixed. Agents record debt in their summaries/verdicts; the Orchestrator registers it here
and points it at the task that will absorb it (same change surface and proof), or leaves the owner `—`.
Rows are never deleted: a fixed row is marked CLOSED with the task and date.

| ID | Date | Found by | Area | Problem (with file:line and evidence) | Proposed fix | Owner | Status |
|---|---|---|---|---|---|---|---|
