# Task Management

## Source of truth

GitHub Issues are the canonical task list. Pull requests are the canonical implementation, synchronization, and promotion record. Repository documentation defines product, engineering, branch, review, and delivery constraints.

Every agent run reconstructs state from GitHub. Chat history is not task storage.

## Branch roles

- `main`: default branch and production source of truth.
- `develop`: integration branch and source for ordinary feature and fix branches.
- `agent/issue-<number>-<short-slug>`: issue branch for feature, defect, maintenance, integration-fix, spike, and hotfix work.

Ordinary issue branches start from current `develop` and target `develop`. A hotfix branch starts from `main`, targets `main`, uses a PR title beginning `Hotfix:`, and is reconciled back into `develop` after merge.

When `main` contains commits missing from `develop`, reconciliation uses a PR with head `main`, base `develop`, and a title beginning `Sync:`. A synchronization PR carries already-approved production history and is not an ordinary implementation branch.

## Issue title format

Every actionable issue title uses:

```text
[STATE][PRIORITY] Imperative task title
```

Allowed states:

- `READY`: acceptance criteria are clear, dependencies are satisfied, and work may begin.
- `IN PROGRESS`: actively owned by the agent.
- `REVIEW`: implementation and evidence are complete in a pull request.
- `BLOCKED`: safe recovery is exhausted or a named decision, credential, environment, or dependency is required.

Allowed priorities:

- `P0`: blocks repository operation, production stability, or the agreed delivery path.
- `P1`: required for the humanoid MVP.
- `P2`: important reliability, usability, or extensibility work.
- `P3`: later improvement.

Closed issues are complete or intentionally cancelled. State markers do not replace issue closure.

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
Exact issue or pull request numbers, or `None`.

## Implementation notes
Constraints, relevant files, branch source, target branch, testing, evidence, and human gates.
```

## Task types

### Feature or ordinary defect

- Starts from `develop`.
- Targets `develop`.
- Feature-specific failures are corrected on the same issue branch.
- A consequential product or visual change can be implemented fully but remains in `REVIEW` until approved.

### Test, documentation, CI, contract, or maintenance task

- Starts from `develop` and targets `develop`.
- May be autonomously merged when clearly inside the low-risk authorization in `AGENTS.md`.
- Steering, authority, branch-policy, and delivery-policy documentation is not routine documentation and requires human review.

### Integration fix

- Created only when green feature work causes or exposes a failure after reaching `develop`.
- Starts from the failing `develop` commit and targets `develop`.
- Restores green integration before additional ordinary feature merges.
- Links the triggering issue or PR and adds regression coverage when practical.

### Production hotfix

- Represents a production-impacting defect requiring a direct correction to `main`.
- Starts from `main` and targets `main`.
- PR title begins `Hotfix:`.
- Uses the narrowest safe change and required risk review.
- After merge, the exact hotfix is reconciled into `develop` before ordinary work resumes.

### Synchronization

- Is a pull request with head `main`, base `develop`, and title beginning `Sync:`.
- Is required whenever `main` contains commits missing from `develop`.
- Contains only already-approved production history; conflicts or additional edits make it review-required.
- Runs all required CI before merge.
- Verifies after merge that `main` is an ancestor of `develop` and `develop` is green.
- Does not need a new implementation issue when it only performs routine reconciliation, but any synchronization defect or conflict gets a focused issue.

### Promotion

- Is a pull request from `develop` to `main`, not an ordinary implementation branch.
- Includes the exact source and target commits, included issues, green CI, delivery artifact identity, known risks, and rollback or forward-fix guidance.
- Requires explicit human approval.
- Does not hide unrelated or failing work inside a release batch.

### Epic

- Tracks a coordinated outcome and child dependencies.
- Is not selected as one implementation task while independently deliverable children remain open.
- Closes only after child completion and outcome verification.

### Exploratory spike

- Has a strict time box and a knowledge, prototype, or decision-record outcome.
- Avoids production coupling unless the issue explicitly authorizes it.
- Separates learned facts, remaining unknowns, recommendation, and follow-up implementation work.

## Selection and execution rules

The agent selects and advances work deterministically:

1. Complete the GitHub startup handshake in `AGENTS.md`.
2. Inspect open PRs for CI failures, requested changes, merge conflicts, incomplete evidence, pending promotion, or pending synchronization. Follow up before selecting unrelated work.
3. Re-evaluate `BLOCKED` issues with objective GitHub dependencies. Move them to `READY` when every named prerequisite issue is closed and prerequisite PR is merged.
4. If `main` contains commits missing from `develop`, open or continue a `Sync:` PR from `main` to `develop`, merge it after green CI, and verify branch ancestry before new ordinary work.
5. Continue the lowest-numbered open `IN PROGRESS` issue.
6. Otherwise select the lowest priority number among `READY` issues with satisfied dependencies.
7. Break priority ties by lower issue number.
8. Change a newly selected issue to `IN PROGRESS` before editing.
9. Work for up to roughly 45 minutes and complete an entire small issue when practical.
10. Maintain at most two active implementation branches.
11. Start a second implementation issue only when the first waits exclusively on CI, review, or another non-interactive state and the tasks are independent and non-overlapping.
12. Do not begin a `BLOCKED` or `REVIEW` issue unless its state changed or its PR needs follow-up.
13. After an authorized merge into `develop`, verify issue closure, integration CI, delivery evidence, branch ancestry, and newly unblocked tasks.
14. Do not invent work when the queue is empty. Create a new issue only for a clear defect, prerequisite, integration failure, synchronization failure, or bounded follow-up found during approved work.

A queued CI job is not a blocker. Continue useful independent inspection, documentation, artifact review, or eligible non-overlapping work.

## State transitions

```text
READY -> IN PROGRESS -> REVIEW -> closed
                  \-> BLOCKED -> READY
```

Move an issue from `REVIEW` back to `IN PROGRESS` when its PR fails CI, receives required changes, conflicts with the target branch, or no longer satisfies acceptance criteria.

Before changing an issue to `REVIEW`, link the PR and post:

- concise implementation summary;
- checks performed and results;
- generated or delivery artifacts inspected;
- known limitations and follow-up issues;
- exact human decision required, when applicable.

When an issue is blocked, post:

- the exact failure or missing requirement;
- troubleshooting steps and retries already attempted;
- why the agent cannot resolve it safely;
- the smallest action needed to unblock it;
- exact issue, PR, credential, environment, or decision dependency.

## Branch synchronization

Before creating an ordinary branch:

1. compare `main` and `develop`;
2. when `main` contains commits missing from `develop`, create or continue a PR with head `main`, base `develop`, and title `Sync: <concise reason>`;
3. require green route-policy and repository CI;
4. merge the synchronization PR only when it contains no unreviewed conflict resolution or extra changes;
5. verify `main` is an ancestor of `develop` and `develop` CI is green;
6. branch from the resulting `develop` head.

A `main -> develop` PR without the `Sync:` title must fail CI. Do not use force-pushes, direct history rewriting, or an unrelated feature branch as the normal synchronization mechanism.

When `develop` advances while a feature branch is active:

- refresh only when required to resolve conflict, consume a dependency, or validate integration;
- use normal commits or merge commits;
- resolve non-consequential conflicts autonomously;
- request a decision only when the conflict represents an unresolved product or architecture choice;
- never force-push a shared branch.

## Failure ownership

| Failure point | Required location of the correction |
| --- | --- |
| Feature PR test or build failure | Original feature branch |
| Review feedback on feature behavior | Original feature branch |
| Feature branch conflict with newer `develop` | Original feature branch after reconciling `develop` |
| Failure first appearing after merge to `develop` | New focused integration-fix branch from `develop` |
| Development delivery artifact failure caused by code | Integration-fix branch from `develop` |
| Synchronization route or conflict failure | Focused P0/P1 issue; do not hide edits inside the `Sync:` PR |
| Transient GitHub Actions or connector failure | Retry and document; do not change code without evidence |
| Production defect | Hotfix branch from `main`, then `Sync:` reconciliation to `develop` |
| Credential, hosting, or external-service absence | `BLOCKED` with the exact approved provisioning action required |

## Pull request conventions

- Branch: `agent/issue-<number>-<short-slug>`.
- Ordinary PR base: `develop`.
- Synchronization PR: head `main`, base `develop`, title begins `Sync:`.
- Promotion PR: head `develop`, base `main`.
- Hotfix PR: issue branch created from `main`, base `main`, title begins `Hotfix:`.
- PR title: concise imperative description, except required `Sync:` and `Hotfix:` prefixes.
- PR body includes `Closes #<number>` when merge should close the issue.
- One issue per PR unless an issue explicitly defines grouped work.
- Draft PRs are preferred until CI is green and acceptance evidence is complete.
- Parallel implementation branches must not overlap files or behavior unless one is deliberately reconciled after the other merges.

## CI and delivery requirements

CI runs on PRs targeting `develop` or `main` and pushes to both branches.

A PR is green only when every required job succeeds. A successful branch push produces traceable build evidence containing:

- branch;
- source commit;
- workflow run;
- build artifact identity;
- validation results.

An artifact is evidence of a build, not proof of public deployment. Public environments, credentials, or paid services require separate approved work.

`develop` must be green before accepting more ordinary feature merges or opening a promotion PR.

Delivery routing is implemented by `scripts/validate-delivery-route.sh` and tested by `scripts/test-delivery-route.sh`. Changes to either are delivery-policy changes and require human review.

## Review and merge policy

The agent may autonomously merge into `develop` only when the PR is focused, reversible, green, and clearly inside a low-risk class authorized by `AGENTS.md`.

A routine green `Sync:` PR may merge autonomously only when it contains no conflicts or changes beyond already-approved `main` history.

Human review remains required for:

- changes to steering, authority, branch policy, or release behavior;
- synchronization conflict resolution or additional edits;
- subjective visual acceptance;
- Blender geometry, rigging, animation, materials, or generation behavior;
- consequential architecture or product decisions;
- security-sensitive behavior;
- credentials, paid infrastructure, or external commitments;
- destructive actions, migrations, or difficult-to-reverse changes;
- ambiguous risk.

Every `develop -> main` promotion requires human approval. No PR is autonomously merged into `main`.

When a PR mixes low-risk and review-required work, the entire PR requires human review. Prefer splitting it.

## Backlog and runtime feedback

- Deduplicate runtime errors before creating new work.
- Link defects to the release, commit, logs, and existing issue when known.
- Treat a production incident as P0 only when impact justifies interruption of normal ordering.
- A code-caused delivery or runtime failure creates or updates a defect issue; an infrastructure-only failure creates or updates an infrastructure issue.
- Close epics only after verifying the user-visible outcome, not merely child issue closure.
