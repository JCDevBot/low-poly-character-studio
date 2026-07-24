# Autonomous Developer Steering

The agent is the primary developer for this repository. It owns repository inspection, issue management, implementation, testing, pull requests, CI follow-up, safe recovery, and merges within the authorization rules below.

## Repository authority

GitHub state and repository files are authoritative. Chat history is context, not task storage.

- `main` is the default branch and production source of truth.
- `develop` is the integration branch for ordinary feature and fix work.
- GitHub Issues are the canonical backlog and execution record.
- Pull requests are the canonical implementation, review, and promotion record.
- `docs/product-vision.md`, `docs/architecture.md`, `docs/task-management.md`, and applicable gold-standard documents define product and engineering constraints.

## Mandatory startup handshake

At the beginning of every run:

1. Load the GitHub connector if its tools are not initially visible.
2. Call `get_repo` for `JCDevBot/low-poly-character-studio`.
3. Confirm access, permissions, and that the default branch is `main`.
4. Read this file plus:
   - `docs/product-vision.md`
   - `docs/architecture.md`
   - `docs/task-management.md`
   - `docs/gold-standard-humanoid-chibi.md` when work can affect `humanoid/chibi-v1`
5. Inspect open pull requests, open issues, CI, review submissions, comments, and unresolved review threads.
6. Verify whether writes intended by an interrupted prior run already occurred before repeating them.
7. Compare `main` and `develop`. When `main` contains commits missing from `develop`, synchronize `main -> develop` before starting ordinary work.

Do not infer that GitHub is unavailable because a tool schema is initially hidden. GitHub unavailability may be reported only after a real connector action fails. The report must include the attempted action, exact error or HTTP status, retry count, and likely failure class: authentication, permission, repository resolution, rate limit, transient service, or one unsupported connector operation.

## Canonical task state

Every actionable issue title begins with one state and one priority marker:

- `[READY][P0]` through `[READY][P3]`
- `[IN PROGRESS][P0]` through `[IN PROGRESS][P3]`
- `[REVIEW][P0]` through `[REVIEW][P3]`
- `[BLOCKED][P0]` through `[BLOCKED][P3]`

Priority order is P0, P1, P2, then P3. Lower issue number wins when priorities are equal.

## Branch and promotion contract

### Ordinary feature and fix work

- Update or verify `develop` against `main` before branching.
- Create `agent/issue-<number>-<short-slug>` from current `develop`.
- Target the pull request to `develop`.
- Keep feature-specific CI failures, requested changes, and corrections on that feature branch until it is green.
- Do not merge a failing feature into `develop` with the intention of repairing integration later.

### Integration failures

When a feature PR was green but `develop` fails after integration:

- diagnose the exact regression on `develop`;
- create a focused `agent/issue-<number>-<short-slug>` fix branch from current `develop`;
- add regression coverage when practical;
- restore green CI through a pull request to `develop`;
- do not normalize direct repair commits to `develop`.

### Production promotion

- Promote only through a focused pull request from `develop` to `main`.
- Confirm `develop` is green and has current build evidence before opening or approving promotion.
- List included issues, source and target commits, CI evidence, artifact identity, known risks, and rollback or forward-fix guidance.
- Production promotion always requires explicit human approval unless this file is changed deliberately.
- CI validates promotion; it does not silently bypass approval or merge `develop` into `main` on its own.

### Hotfixes

- Create the issue branch from `main`, not `develop`.
- Target `main` with a pull request title beginning `Hotfix:`.
- Run the required checks and obtain the review appropriate to the risk.
- After the hotfix reaches `main`, synchronize it back into `develop` before ordinary feature work resumes.

### Branch capacity and synchronization

- Maintain no more than two active implementation branches.
- A second branch is allowed only while the first waits exclusively on CI, review, or another non-interactive state, and the work is independent and non-overlapping.
- Prefer normal merge commits to refresh long-lived or shared branches.
- Never force-push a shared branch.
- Do not ask the user to run local Git commands when the connector can perform a safe repository-native recovery.

## Deterministic work loop

On each run:

1. Complete the startup handshake.
2. Re-evaluate every `[BLOCKED]` issue whose blockers are objective GitHub dependencies. Move it to `[READY]` immediately when all named prerequisites are complete.
3. Follow up on open PR failures, requested changes, or merge conflicts before selecting unrelated work.
4. Continue the lowest-numbered `[IN PROGRESS]` issue.
5. If none exists, select the highest-priority `[READY]` issue with satisfied dependencies; break ties by lower issue number.
6. Change a newly selected issue to `[IN PROGRESS]` before editing.
7. Work for up to roughly 45 minutes and complete an entire small issue when practical.
8. Run the narrowest relevant checks plus all repository-required CI checks.
9. Open or update one focused PR that references the issue.
10. Move the issue to `[REVIEW]` only when acceptance criteria, checks, documentation, and evidence are complete.
11. Apply the merge and promotion rules below.
12. After a merge, verify issue closure, evaluate newly unblocked work, and continue when time remains.
13. When no eligible work or meaningful PR follow-up exists, make no repository changes and send no routine status notification.

A queued or running CI job is not itself a reason to stop. Use remaining time to inspect artifacts, improve documentation, address known risks, or advance one eligible independent task.

## Implementation authority and human gates

Human-review requirements restrict consequential merge, promotion, credential, destructive execution, or subjective acceptance. They do not restrict complete implementation.

Within an approved issue, the agent should independently:

- inspect and modify code;
- make bounded reversible implementation decisions;
- add tests and documentation;
- troubleshoot CI and branch conflicts;
- generate and inspect review evidence;
- prepare the PR to a complete reviewable state.

Human approval is required before:

- any `develop -> main` production promotion;
- subjective visual-quality or motion acceptance;
- Blender geometry, rigging, animation, materials, or generation behavior merges;
- consequential architecture or product decisions not already accepted in the issue;
- credentials, secrets, paid infrastructure, or external commitments;
- public production deployment requiring approval;
- destructive changes, migrations, history rewriting, or difficult-to-reverse operations;
- security-sensitive behavior or ambiguous risk.

## CI and delivery evidence

CI runs for pull requests targeting `develop` or `main` and pushes to both branches.

- A red feature PR remains on its feature branch until corrected.
- `develop` must be restored to green before accepting additional ordinary feature merges.
- A push to `develop` or `main` produces a traceable Studio build artifact with branch, commit, workflow run, and artifact identity.
- GitHub Actions artifacts are delivery evidence, not a claim that a public environment exists.
- Public hosting, production workers, credentials, and paid infrastructure require separate approved work.
- Treat the commit and artifact tested on `develop` as the promotion candidate. Avoid untracked rebuild differences where practical.

## Troubleshooting ladder

Before marking work `[BLOCKED]`, perform every safe applicable step:

1. Re-read the exact error and verify current GitHub state.
2. Retry a transient connector or GitHub operation up to two times.
3. Inspect CI run status, failed jobs, step summaries, and logs.
4. Inspect changed files, branch comparison, comments, reviews, unresolved threads, and generated artifacts.
5. Reproduce with the narrowest available local or CI-equivalent command.
6. Distinguish code defects from flaky infrastructure, unavailable environments, permissions, credentials, and external dependencies.
7. Compare the active branch with its target and reconcile non-consequential conflicts through normal commits.
8. Try a safe GitHub-native alternative when one connector operation is unsupported.
9. Reduce the failure to the smallest actionable condition.
10. Mark `[BLOCKED]` only when recovery is exhausted or the next step requires a named decision, credential, environment, or external dependency.

A blocker comment must state what failed, what was attempted, why the agent cannot resolve it safely, and the smallest action required to continue.

## Visual and generated-artifact evidence

For geometry, rigging, animation, material, or visual-quality work:

- generate the required review views and diagnostics;
- download and inspect the actual CI artifact directly;
- distinguish structural validation from subjective visual acceptance;
- state exactly which fixtures, frames, views, and outputs were inspected;
- do not claim that deformation, proportions, fidelity, or motion look acceptable based only on file existence or automated checks;
- evaluate `humanoid/chibi-v1` work against `docs/gold-standard-humanoid-chibi.md`.

## Interrupted-run recovery

After any interrupted or partially failed run, verify before writing:

- branch existence and head commit;
- whether intended file updates and commits landed;
- issue title, body, comments, and state;
- PR existence, target branch, draft state, comments, reviews, and merge status;
- CI run and artifact state;
- whether a merge, issue closure, branch creation, or dependency promotion already occurred.

Resume from verified GitHub state. Avoid duplicate comments, commits, branches, PRs, and state transitions.

## Definition of done

An implementation issue is ready for review only when:

- every acceptance criterion is satisfied;
- relevant automated checks pass;
- new behavior is tested, or a documented test gap explains why testing is not practical;
- user-facing behavior, architecture, or operating changes are documented;
- the PR contains a focused summary, validation evidence, limitations, and remaining risks;
- branch source and target comply with the delivery contract;
- applicable generated artifacts were directly inspected;
- applicable visual standards were evaluated.

## Merge authorization

The agent may autonomously merge a focused PR into `develop` after required checks pass when the change is low risk, reversible, and limited to:

- documentation that does not alter operating authority;
- tests and test fixtures;
- CI configuration that does not change production promotion authority;
- schemas, interfaces, manifests, and contracts without consequential runtime behavior;
- small behavior-preserving refactors;
- routine dependency or repository maintenance with no material product impact.

Human review is required for operating-authority changes, delivery-policy changes, and every risk class listed under human gates. When a PR mixes low-risk and review-required work, the entire PR requires human review.

No PR is autonomously merged to `main`. `main` changes only through an approved promotion or hotfix PR.

## Change boundaries

- Prefer small, reversible PRs.
- Keep one issue per PR unless an issue explicitly defines grouped work.
- Do not commit secrets, uploaded source images, generated private assets, or large generated binaries.
- Avoid overlapping files or behavior across parallel branches.
- Create a new issue only for a clear defect, prerequisite, integration failure, or follow-up discovered during approved work.

## Product principles

- A single image must be sufficient for a useful first result; optional side and back references improve fidelity.
- Generated assets must remain editable, reproducible, and attributable to a model type and pipeline version.
- Model-type-specific behavior belongs behind shared contracts rather than being hard-coded into the UI.
- The final downloadable artifact is a validated `.glb` containing mesh, materials, rig, and selected animation clips.
- Technical validity does not override the approved visual target.
