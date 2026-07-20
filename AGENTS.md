# Autonomous Developer Steering

The agent is the primary developer for this repository and handles repository inspection, issue management, branches, commits, pull requests, CI follow-up, merging within the authorized classes below, and release-related GitHub interactions.

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

1. Inspect open pull requests, open issues, CI, and review feedback.
2. Re-evaluate `[BLOCKED]` issues whose only blockers are objective GitHub dependencies. Change an issue to `[READY]` when every listed prerequisite issue or pull request is complete.
3. Continue the lowest-numbered active `[IN PROGRESS]` issue first.
4. If none exists, select the highest-priority `[READY]` issue whose dependencies are satisfied.
5. Change a newly selected issue title to `[IN PROGRESS]` before editing code.
6. Work for up to roughly 45 minutes and complete an entire small issue in one run when practical rather than stopping after an arbitrary work unit.
7. Maintain no more than two active implementation branches. Use branches named `agent/issue-<number>-<short-slug>`.
8. While one branch is waiting only on CI, review, or another non-interactive GitHub state, the agent may advance one independent, non-overlapping task on the second branch.
9. Keep each issue updated with decisions, progress, checks, and blockers. Do not combine unrelated issues in one pull request.
10. Run the checks defined by CI or the narrowest relevant local equivalents.
11. Open or update a focused pull request that references the issue.
12. When acceptance criteria are met and checks pass, change the issue title to `[REVIEW]`.
13. Apply the merge policy below. After a merge, verify issue closure, promote newly unblocked issues, and begin the next eligible task in the same run when time remains.
14. When blocked, change the title to `[BLOCKED]` and state the exact decision, credential, environment, or dependency required.
15. If no issue is ready and no pull request needs work, make no repository changes and do not send a routine notification.

## Definition of done

An implementation issue is ready for review only when:

- Its acceptance criteria are satisfied.
- Relevant automated checks pass.
- New behavior is tested or a documented test gap explains why testing is not yet practical.
- User-facing behavior or architecture changes are documented.
- The pull request has a focused summary, validation notes, and remaining risks.
- Work affecting `humanoid/chibi-v1` includes the required comparison views and is visually evaluated against `docs/gold-standard-humanoid-chibi.md`.

## Merge authorization

The agent may autonomously merge a focused pull request after all required checks pass when the change is low risk, reversible, and limited to one or more of these classes:

- documentation
- tests and test fixtures
- CI or repository automation configuration
- schemas, interfaces, manifests, and shared contracts that do not change consequential runtime behavior
- small non-destructive refactors with equivalent behavior
- routine dependency or repository maintenance with no material product impact

The agent must request human review before merging changes involving:

- visual-quality acceptance or subjective model fidelity
- Blender generation, geometry, rigging, animation, materials, or asset-pipeline behavior
- consequential architecture or product decisions
- public production deployment or releases requiring approval
- credentials, secrets, paid infrastructure, or external service commitments
- destructive changes, data migrations, history rewriting, or difficult-to-reverse operations
- security-sensitive behavior or any change whose risk does not clearly fit an authorized low-risk class

When uncertain, do not merge autonomously. Explain the decision required and leave the pull request ready for review.

## Change boundaries

- Prefer small, reversible pull requests.
- Do not combine unrelated issues in one pull request.
- Do not force-push shared branches.
- Do not commit secrets, uploaded source images, generated private assets, or large generated binaries.
- Keep at most two active implementation branches and avoid overlapping edits between them.

## Product principles

- A single image must be sufficient for a useful first result; optional side and back references improve fidelity.
- Generated assets must remain editable, reproducible, and attributable to a model type and pipeline version.
- Model-type-specific behavior belongs behind shared contracts rather than being hard-coded into the UI.
- The final downloadable artifact is a validated `.glb` containing mesh, materials, rig, and the selected animation clips.
- Technical validity does not override the approved visual target. The humanoid base model must preserve the documented proportions, silhouette, expression, faceted geometry, and hand-painted surface language.
