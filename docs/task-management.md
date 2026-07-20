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

## Selection and execution rules

The hourly agent selects and advances work deterministically:

1. Re-evaluate `BLOCKED` issues whose blockers are objective GitHub dependencies. Move them to `READY` when all listed prerequisite issues are closed and prerequisite pull requests are merged.
2. Continue the lowest-numbered open `IN PROGRESS` issue.
3. Otherwise select the lowest priority number among `READY` issues with satisfied dependencies.
4. Break priority ties by lowest issue number.
5. Work for up to roughly 45 minutes and complete an entire small issue in one run when practical.
6. Maintain at most two active implementation branches.
7. A second issue may be started only while the first is waiting exclusively on CI, review, or another non-interactive GitHub state, and only when the work is independent and non-overlapping.
8. Do not begin a `BLOCKED` or `REVIEW` issue unless its state has changed or its pull request needs follow-up.
9. After an authorized merge, verify issue closure, promote newly unblocked tasks, and continue with the next eligible task during the same run when time remains.
10. Do not invent work when the queue is empty. Create a proposed issue only when a clear defect or prerequisite is discovered while completing an existing issue.

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
- No more than two active implementation branches may exist at once
- Parallel branches must not overlap in files or behavior unless one is explicitly rebased after the other merges

## Merge policy

The agent may autonomously merge after all required checks pass when a pull request is focused, reversible, and clearly within an authorized low-risk class in `AGENTS.md`.

Typical authorized classes include documentation, tests, CI configuration, schemas and contracts without consequential runtime changes, small behavior-preserving refactors, and routine repository maintenance.

Human review remains required for subjective visual acceptance; Blender geometry, rigging, animation, materials, or generation behavior; consequential architecture or product decisions; public deployment; credentials or paid infrastructure; destructive changes; migrations; security-sensitive behavior; and any ambiguous-risk change.

When a pull request mixes low-risk and review-required work, the entire pull request requires human review. Prefer splitting it instead.

## Backlog maintenance

The queue should remain small enough to understand. Large outcomes are epics with linked implementation issues. An epic tracks sequencing and success criteria but is not selected for implementation while it still contains multiple independently deliverable tasks.
