# Autonomous Developer Steering

The agent is the primary developer for this repository and handles repository inspection, issue management, branches, commits, pull requests, CI follow-up, and release-related GitHub interactions.

## Required context

Before selecting or implementing work, read:

1. `docs/product-vision.md`
2. `docs/architecture.md`
3. `docs/gold-standard-humanoid-chibi.md` for work affecting `humanoid/chibi-v1`
4. `docs/task-management.md`
5. The relevant open GitHub issue and linked pull request, if any

Repository files and GitHub state are authoritative. Do not rely on conversation memory to determine task state.

## Canonical task state

GitHub Issues are the canonical backlog and execution record. Every actionable issue title begins with exactly one state marker and one priority marker:

- `[READY][P0]` through `[READY][P3]`
- `[IN PROGRESS][P0]` through `[IN PROGRESS][P3]`
- `[REVIEW][P0]` through `[REVIEW][P3]`
- `[BLOCKED][P0]` through `[BLOCKED][P3]`

Priority order is P0, P1, P2, then P3. Lower issue number wins when priorities are equal.

## Hourly work loop

On each scheduled run:

1. Inspect open pull requests and open issues.
2. Re-evaluate `[BLOCKED]` issues whose only blockers are objective GitHub dependencies. Change an issue to `[READY]` when every listed prerequisite issue or pull request is complete.
3. Continue the oldest `[IN PROGRESS]` issue first.
4. If none exists, select the highest-priority `[READY]` issue whose dependencies are satisfied.
5. Change the selected issue title to `[IN PROGRESS]` before editing code.
6. Work on one issue only. Use a branch named `agent/issue-<number>-<short-slug>`.
7. Keep the issue updated with decisions, progress, checks, and blockers.
8. Run the checks defined by CI or the narrowest relevant local equivalents.
9. Open or update a draft pull request that references the issue.
10. When acceptance criteria are met and checks pass, change the issue title to `[REVIEW]`.
11. When blocked, change the title to `[BLOCKED]` and state the exact decision, credential, environment, or dependency required.
12. If no issue is ready and no pull request needs work, make no repository changes and do not send a routine notification.

## Definition of done

An implementation issue is ready for review only when:

- Its acceptance criteria are satisfied.
- Relevant automated checks pass.
- New behavior is tested or a documented test gap explains why testing is not yet practical.
- User-facing behavior or architecture changes are documented.
- The pull request has a focused summary, validation notes, and remaining risks.
- Work affecting `humanoid/chibi-v1` includes the required comparison views and is visually evaluated against `docs/gold-standard-humanoid-chibi.md`.

## Change boundaries

- Prefer small, reversible pull requests.
- Do not combine unrelated issues in one pull request.
- Do not force-push shared branches.
- Do not commit secrets, uploaded source images, generated private assets, or large generated binaries.
- Do not merge a pull request unless the user has explicitly authorized autonomous merging for that class of change.
- Architecture changes, destructive migrations, paid infrastructure, credentials, and public production deployment require user review.

## Product principles

- A single image must be sufficient for a useful first result; optional side and back references improve fidelity.
- Generated assets must remain editable, reproducible, and attributable to a model type and pipeline version.
- Model-type-specific behavior belongs behind shared contracts rather than being hard-coded into the UI.
- The final downloadable artifact is a validated `.glb` containing mesh, materials, rig, and the selected animation clips.
- Technical validity does not override the approved visual target. The humanoid base model must preserve the documented proportions, silhouette, expression, faceted geometry, and hand-painted surface language.
