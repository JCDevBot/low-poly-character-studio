# Task Management

## Source of truth

GitHub Issues are the canonical task list. Pull requests are the canonical implementation record. Repository documentation defines product and engineering constraints.

A scheduled agent run must reconstruct state from GitHub every time. Chat history is not task storage.

## Issue title format

Every actionable issue title uses:

```text
[STATE][PRIORITY] Imperative task title
```

Allowed states:

- `READY`: acceptance criteria are clear, dependencies are satisfied, and work may begin
- `IN PROGRESS`: actively owned by the agent
- `REVIEW`: implementation is in a pull request and acceptance criteria are believed complete
- `BLOCKED`: work cannot continue without a named dependency or decision

Allowed priorities:

- `P0`: blocks the end-to-end product or repository operation
- `P1`: required for the humanoid MVP
- `P2`: important reliability, usability, or extensibility work
- `P3`: later improvement

Closed issues are complete or intentionally cancelled. State markers are not used as a substitute for closing completed issues.

## Required issue sections

Each issue should contain:

```markdown
## Outcome
What becomes true when this task is complete.

## Scope
The bounded work included in this issue.

## Acceptance criteria
- [ ] Verifiable result

## Dependencies
Links or `None`.

## Implementation notes
Constraints, relevant files, and decisions.
```

## Selection rules

The hourly agent selects work deterministically:

1. Re-evaluate `BLOCKED` issues whose blockers are objective GitHub dependencies. Move them to `READY` when all listed prerequisite issues are closed and prerequisite pull requests are merged.
2. Continue the lowest-numbered open `IN PROGRESS` issue.
3. Otherwise select the lowest priority number among `READY` issues with satisfied dependencies.
4. Break priority ties by lowest issue number.
5. Do not begin a `BLOCKED` or `REVIEW` issue unless its state has changed.
6. Do not invent work when the queue is empty. Create a proposed issue only when a clear defect or prerequisite is discovered while completing an existing issue.

## State transitions

```text
READY -> IN PROGRESS -> REVIEW -> closed
                 \-> BLOCKED -> READY
```

Before changing an issue to `REVIEW`, the agent must link its pull request and post:

- concise implementation summary
- checks performed and results
- known limitations or follow-up issues

When an issue is blocked, the issue comment must state:

- what failed or is missing
- why the agent cannot resolve it safely
- the smallest action needed to unblock it

An issue blocked only by other GitHub work should list exact issue or pull request numbers so a scheduled run can resolve the dependency without interpretation.

## Branch and pull request conventions

- Branch: `agent/issue-<number>-<short-slug>`
- Pull request title: concise imperative description
- Pull request body includes `Closes #<number>` when the issue should close on merge
- One issue per pull request unless an issue explicitly defines a grouped migration
- Draft pull requests are preferred until CI is green and acceptance criteria are complete

## Merge policy

The default is human-reviewed merging. The agent may prepare, update, rebase, and validate pull requests, but does not merge without explicit authorization for that class of change.

CI, documentation, and other low-risk autonomous merge categories may be authorized later in `AGENTS.md`.

## Backlog maintenance

The queue should remain small enough to understand. Large outcomes are epics with linked implementation issues. An epic tracks sequencing and success criteria but is not selected for implementation while it still contains multiple independently deliverable tasks.
