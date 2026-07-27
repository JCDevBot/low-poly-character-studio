# Task Management

## Source of truth

GitHub Issues are the canonical task list. Pull requests are the canonical implementation, synchronization, milestone, and promotion record. Repository documentation defines product, engineering, branch, review, and delivery constraints.

Every agent run reconstructs state from GitHub. Chat history is not task storage.

## Goal and milestone model

A **goal** is a repository-defined outcome established by product vision, an epic or issue, or an explicit product-owner directive recorded in GitHub.

A **task** is a bounded implementation unit required to advance that goal. Completing a task does not automatically create a human checkpoint.

A **milestone** is a coherent, testable user-visible outcome for which human testing or feedback would materially guide acceptance, refinement, or the next goal.

The normal cycle is:

```text
product owner defines goal and standards
-> agent completes and integrates required tasks
-> agent presents a testable milestone
-> product owner accepts, refines, or defines the next goal
```

The agent should not request routine approval for task selection, implementation details, green CI, merges into `develop`, or individual issue completion.

An explicit product-owner goal or priority override may supersede normal issue ordering. Record the override on the selected issue, identify any deferred issue, and treat the override as complete when the selected goal reaches a milestone, becomes genuinely blocked, or is superseded.

## Branch roles

- `main`: default branch and production source of truth.
- `develop`: integration branch and source for ordinary feature and fix branches.
- `agent/issue-<number>-<short-slug>`: issue branch for feature, defect, maintenance, integration-fix, spike, and hotfix work.

Ordinary issue branches start from current `develop` and target `develop`. A hotfix branch starts from `main`, targets `main`, uses a PR title beginning `Hotfix:`, and is reconciled back into `develop` after merge.

When `main` contains commits missing from `develop`, reconciliation uses a PR with head `main`, base `develop`, and a title beginning `Sync:`. A synchronization PR carries already-approved production history and is not an ordinary implementation branch.

## Issue title format

Every actionable issue uses:

```text
[STATE][PRIORITY] Imperative task title
```

Allowed states:

- `READY`: acceptance criteria are clear, dependencies are satisfied, and work may begin.
- `IN PROGRESS`: actively owned by the agent.
- `REVIEW`: a meaningful milestone is ready for product-owner testing or a specifically named unresolved human decision is required.
- `BLOCKED`: safe recovery is exhausted and a genuine exception prevents autonomous completion.

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
Constraints, relevant files, branch source, target branch, testing, evidence, and genuine exceptions.
```

When an issue is part of a larger goal, identify the parent outcome or milestone it advances.

## Task types

### Feature or ordinary defect

- Starts from `develop`.
- Targets `develop`.
- Feature-specific failures are corrected on the same issue branch.
- May merge autonomously into `develop` when the intended outcome is already established, required checks pass, evidence is complete, and no genuine exception remains.
- Visual or consequential implementation does not require a routine approval stop merely because of its category.

### Test, documentation, CI, contract, or maintenance task

- Starts from `develop` and targets `develop`.
- May merge autonomously after required checks pass when no genuine exception remains.
- Steering, authority, branch-policy, and delivery-policy changes require an explicit product-owner directive. Once that directive is recorded, the agent may implement and integrate the authorized change without a second routine approval request unless the implementation introduces a new unresolved decision.

### Integration fix

- Created only when green feature work causes or exposes a failure after reaching `develop`.
- Starts from the failing `develop` commit and targets `develop`.
- Restores green integration before additional ordinary feature merges.
- Links the triggering issue or PR and adds regression coverage when practical.

### Production hotfix

- Represents a production-impacting defect requiring a direct correction to `main`.
- Starts from `main` and targets `main`.
- PR title begins `Hotfix:`.
- Uses the narrowest safe change and required unresolved-risk review.
- After merge, the exact hotfix is reconciled into `develop` before ordinary work resumes.

### Synchronization

- Is a pull request with head `main`, base `develop`, and title beginning `Sync:`.
- Is required whenever `main` contains commits missing from `develop`.
- Contains only accepted production history whenever practical.
- Runs all required CI before merge.
- Verifies after merge that `main` is an ancestor of `develop` and `develop` is green.
- Does not need a new implementation issue when it only performs routine reconciliation, but any synchronization defect or unresolved conflict gets a focused issue.

### Promotion

- Is a pull request from `develop` to `main`, not an ordinary implementation branch.
- Includes exact source and target commits, included issues, green CI, delivery artifact identity, known risks, and rollback or forward-fix guidance.
- Requires explicit human approval.
- Does not hide unrelated or failing work inside a release batch.

### Epic

- Tracks a coordinated goal or milestone and child dependencies.
- Is not selected as one implementation task while independently deliverable children remain open.
- Closes only after the user-visible outcome is verified.

### Exploratory spike

- Has a strict time box and a knowledge, prototype, or decision-record outcome.
- Avoids production coupling unless the issue explicitly authorizes it.
- Separates learned facts, remaining unknowns, recommendation, and follow-up implementation work.
- Uses a safe reversible experiment to reduce uncertainty before escalating a decision.

## Selection and execution rules

The agent selects and advances work deterministically:

1. Complete the GitHub startup handshake in `AGENTS.md`.
2. Inspect open PRs for CI failures, requested changes, merge conflicts, incomplete evidence, pending promotion, or pending synchronization. Follow up before selecting unrelated work.
3. Re-evaluate `BLOCKED` issues with objective GitHub dependencies. Move them to `READY` when every named prerequisite issue is closed and prerequisite PR is merged.
4. If `main` contains commits missing from `develop`, open or continue a `Sync:` PR from `main` to `develop`, merge it after green CI, and verify branch ancestry before new ordinary work.
5. Continue the lowest-numbered open `IN PROGRESS` issue.
6. Otherwise select the lowest priority number among `READY` issues with satisfied dependencies.
7. Break priority ties by lower issue number unless a recorded product-owner goal override applies.
8. Change a newly selected issue to `IN PROGRESS` before editing.
9. Work for up to roughly 45 minutes and complete an entire small issue when practical.
10. Maintain at most two active implementation branches.
11. Start a second active implementation issue only when the first waits exclusively on CI, an external dependency, or another non-interactive state and the tasks are independent and non-overlapping.
12. A complete green PR waiting only for milestone-level human testing does not consume active implementation capacity until feedback requires changes.
13. Do not begin a `BLOCKED` or `REVIEW` issue unless its state changed, its PR needs follow-up, or the named human decision has been supplied.
14. When an issue satisfies acceptance criteria and no genuine exception remains, merge its focused green PR into `develop`, close or verify the issue, and continue.
15. After integration, verify CI, delivery evidence, branch ancestry, and newly unblocked tasks.
16. Continue through the tasks required for the current goal until a coherent milestone is complete, a genuine exception occurs, time expires, or no eligible work remains.
17. Do not invent work when the queue is empty. Create a new issue only for a clear defect, prerequisite, integration failure, synchronization failure, or bounded follow-up found during approved work.

A queued CI job is not a blocker. Continue useful independent inspection, documentation, artifact review, or eligible non-overlapping work.

## State transitions

The normal task path is:

```text
READY -> IN PROGRESS -> closed
                   \-> REVIEW -> IN PROGRESS or closed
                   \-> BLOCKED -> READY
```

Use `REVIEW` only when:

- an integrated coherent milestone is ready for product-owner testing or acceptance; or
- a specifically named consequential decision cannot be resolved from repository steering, acceptance criteria, prior direction, or a safe reversible experiment.

Move an issue from `REVIEW` back to `IN PROGRESS` when feedback requires changes, its PR fails CI, it conflicts with the target branch, or it no longer satisfies acceptance criteria.

Before changing an issue to `REVIEW`, link the relevant PR or integrated build and post:

- the coherent outcome available to test;
- exact testing instructions;
- checks performed and results;
- generated or delivery artifacts inspected;
- known limitations and unresolved subjective questions;
- the precise decision requested and why further autonomous work would not materially improve it.

When an issue is blocked, post:

- the exact failure or missing requirement;
- troubleshooting steps and retries already attempted;
- why the condition satisfies the genuine-exception definition;
- the smallest action needed to unblock it;
- exact issue, PR, credential, environment, external actor, or decision dependency.

Before closing an implementation issue, record the focused PR, checks, evidence, limitations, and parent goal advanced when that information is not already clear from the PR.

## Genuine exceptions

A genuine exception exists only when the next required action depends on:

- unavailable access, credentials, environment, or an external actor;
- contradictory steering or acceptance criteria;
- a consequential unresolved product or architecture decision;
- credentials, secrets, spending, paid infrastructure, legal or external commitments;
- public production deployment requiring approval;
- destructive, difficult-to-reverse, migration, or history-rewriting work not already authorized;
- security-sensitive behavior with unresolved material risk.

Category alone is not an exception. Architecture, Blender, geometry, rigging, animation, materials, generation, and visual work may integrate into `develop` when the intended outcome is established and evidence is complete.

Before escalating, investigate repository history, inspect artifacts, run the narrowest tests, attempt safe GitHub-native recovery, and use a bounded reversible experiment when practical.

## Branch synchronization

Before creating an ordinary branch:

1. compare `main` and `develop`;
2. when `main` contains commits missing from `develop`, create or continue a PR with head `main`, base `develop`, and title `Sync: <concise reason>`;
3. require green route-policy and repository CI;
4. merge the synchronization PR when no genuine exception remains;
5. verify `main` is an ancestor of `develop` and `develop` CI is green;
6. branch from the resulting `develop` head.

A `main -> develop` PR without the `Sync:` title must fail CI. Do not use force-pushes, direct history rewriting, or an unrelated feature branch as the normal synchronization mechanism.

When `develop` advances while a feature branch is active:

- refresh only when required to resolve conflict, consume a dependency, or validate integration;
- use normal commits or merge commits;
- resolve objectively determined reversible conflicts autonomously;
- escalate only when the conflict exposes a genuine exception;
- never force-push a shared branch.

## Failure ownership

| Failure point | Required location of the correction |
| --- | --- |
| Feature PR test or build failure | Original feature branch |
| Review feedback on feature behavior | Original feature branch |
| Feature branch conflict with newer `develop` | Original feature branch after reconciling `develop` |
| Failure first appearing after merge to `develop` | New focused integration-fix branch from `develop` |
| Development delivery artifact failure caused by code | Integration-fix branch from `develop` |
| Synchronization route or conflict failure | Focused P0/P1 issue when normal resolution is insufficient |
| Transient GitHub Actions or connector failure | Retry and document; do not change code without evidence |
| Production defect | Hotfix branch from `main`, then `Sync:` reconciliation to `develop` |
| Credential, hosting, or external-service absence | `BLOCKED` with the exact provisioning action required |

## Pull request conventions

- Branch: `agent/issue-<number>-<short-slug>`.
- Ordinary PR base: `develop`.
- Synchronization PR: head `main`, base `develop`, title begins `Sync:`.
- Promotion PR: head `develop`, base `main`.
- Hotfix PR: issue branch created from `main`, base `main`, title begins `Hotfix:`.
- PR title: concise imperative description, except required `Sync:` and `Hotfix:` prefixes.
- PR body includes `Closes #<number>` when merge should close the issue.
- One issue per PR unless an issue explicitly defines grouped work.
- Draft PRs are preferred while implementation or evidence is incomplete.
- Parallel active implementation branches must not overlap files or behavior unless one is deliberately reconciled after the other merges.
- A complete green PR should not remain open merely for category-based approval when no genuine exception exists.

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

Delivery routing is implemented by `scripts/validate-delivery-route.sh` and tested by `scripts/test-delivery-route.sh`. Changes to either require an explicit product-owner directive because they alter delivery policy. Once authorized, the agent may implement and integrate the stated policy change unless a new genuine exception appears.

## Review and merge policy

The agent may autonomously merge a focused PR into `develop` when:

- its intended outcome is established by repository steering, issue acceptance criteria, or an explicit recorded product-owner directive;
- all required checks pass;
- applicable generated and visual artifacts have been directly inspected;
- limitations and risks are documented;
- the change is sufficiently bounded for safe integration;
- no genuine exception remains.

This authority applies to architecture, Blender, geometry, rigging, animation, materials, generation, visual behavior, documentation, tests, CI, contracts, and maintenance. Category alone does not require a human approval stop.

Subjective product acceptance occurs at a coherent milestone. The agent must distinguish objective validation from human acceptance, but it may integrate completed work into `develop` before the milestone checkpoint.

A routine green `Sync:` PR may merge autonomously when no genuine exception remains.

Human approval remains required before:

- every `develop -> main` promotion;
- public production deployment requiring approval;
- credentials, secrets, spending, paid infrastructure, legal or external commitments;
- destructive, migration, history-rewriting, or difficult-to-reverse operations not already authorized;
- security-sensitive behavior with unresolved material risk;
- consequential product or architecture decisions not resolved by repository steering, issue criteria, prior recorded direction, or a safe reversible experiment;
- repository operating-authority changes without an explicit product-owner directive.

No PR is autonomously merged into `main`.

## Milestone notification

Notify the product owner when a coherent goal or milestone is complete and human feedback would materially guide the project. Include:

- the user-visible outcome achieved;
- the exact build, branch, commit, workflow run, and artifact to test;
- focused testing instructions;
- objective validation and artifact-inspection evidence;
- known limitations, subjective questions, and material risks;
- the requested decision: accept, refine the goal, or define the next goal.

Do not send routine notifications for unchanged review state, queued CI, task starts, ordinary merges, or issue transitions.

## Backlog and runtime feedback

- Deduplicate runtime errors before creating new work.
- Link defects to the release, commit, logs, and existing issue when known.
- Treat a production incident as P0 only when impact justifies interruption of normal ordering.
- A code-caused delivery or runtime failure creates or updates a defect issue; an infrastructure-only failure creates or updates an infrastructure issue.
- Close epics only after verifying the user-visible outcome, not merely child issue closure.