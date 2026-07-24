# Delivery Workflow

## Branch roles

- `main` is the default branch and production source of truth.
- `develop` is the integration branch and source for ordinary feature and fix branches.
- `agent/issue-<number>-<short-slug>` is the working branch convention.

This repository currently produces GitHub Actions build artifacts. It does not yet claim a public development or production deployment environment.

## Ordinary feature or fix flow

```text
accepted main
  -> Sync: main into develop when needed
  -> branch from current develop
  -> implement and test on the issue branch
  -> pull request to develop
  -> correct failures on the issue branch until green
  -> approve and merge according to risk
  -> verify develop CI and delivery artifact
```

### Before branching

1. Confirm the default branch is `main`.
2. Compare `main` and `develop`.
3. When `main` has commits missing from `develop`, open or continue a PR with head `main`, base `develop`, and title beginning `Sync:`.
4. Merge the synchronization PR after required CI passes and verify `main` is an ancestor of `develop`.
5. Confirm `develop` is green.
6. Create the issue branch from the current `develop` head.

### Feature PR requirements

An ordinary feature or fix PR:

- targets `develop`;
- links one issue;
- satisfies the issue acceptance criteria;
- includes relevant tests and documentation;
- remains on the feature branch while CI or review corrections are needed;
- does not merge red code into `develop` for later repair.

## Integration failure flow

A feature can pass in isolation and still fail after integration with other changes.

When a failure first appears on `develop`:

```text
develop failure
  -> diagnose exact regression
  -> create focused issue if one does not exist
  -> branch from failing develop
  -> add regression coverage
  -> pull request back to develop
  -> restore green integration
```

Do not normalize direct repair commits to `develop`. Pause additional ordinary feature merges until integration is green.

## Promotion flow

A production promotion is a pull request from `develop` to `main`.

Before opening or approving promotion:

- `develop` CI is green;
- the current `develop` push has a traceable build artifact;
- the PR lists included issues and exact source and target commits;
- known risks and rollback or forward-fix guidance are documented;
- no unrelated failing work is hidden in the batch.

```text
green develop
  -> promotion PR: develop -> main
  -> CI validates the combined result
  -> human approval
  -> merge to main
  -> main CI and production build evidence
  -> Sync: main -> develop before new work
```

CI/CD validates and records evidence. It does not silently merge a promotion or bypass required human approval.

## Main-to-develop synchronization flow

Use synchronization whenever a production promotion, hotfix, or other approved `main` change is not yet contained in `develop`.

```text
main ahead of develop
  -> PR head main, base develop
  -> title begins Sync:
  -> route-policy and full CI pass
  -> merge to develop
  -> verify main is an ancestor of develop
  -> verify develop is green
  -> resume ordinary work
```

Synchronization rules:

- A `main -> develop` PR without a `Sync:` title fails route-policy validation.
- A routine sync contains only already-approved `main` history and may merge autonomously when green.
- Conflicts, additional edits, or a product decision require a focused issue and human review.
- Do not force-push, rewrite history, or use an unrelated feature branch to carry production history.

## Hotfix flow

Use a hotfix only for a production-impacting defect that should not wait for the next normal promotion.

```text
main
  -> issue branch created from main
  -> PR titled Hotfix: ... targeting main
  -> focused validation and approval
  -> merge to main
  -> Sync: main back into develop
  -> verify develop is green
```

The hotfix is incomplete until `develop` contains the production correction.

## CI branch policy

CI runs on:

- pull requests targeting `develop`;
- pull requests targeting `main`;
- pushes to `develop`;
- pushes to `main`;
- manual workflow dispatch.

The CI branch-policy job permits:

- ordinary issue branches targeting `develop`;
- `main` targeting `develop` only when the PR title begins `Sync:`;
- `develop` targeting `main` for promotion;
- `agent/issue-*` targeting `main` only when the PR title begins `Hotfix:`.

The policy is implemented by `scripts/validate-delivery-route.sh`. `scripts/test-delivery-route.sh` exercises valid and invalid feature, synchronization, promotion, and hotfix routes during CI.

## Build evidence

Pushes to `develop` and `main` upload a Studio artifact named with the branch and exact commit. The artifact contains:

- the built Studio distribution;
- repository and branch;
- exact source commit;
- workflow run and attempt;
- a linkable run identifier.

This artifact is an immutable delivery candidate for the retention period. It is not evidence that a public environment was deployed.

## Failure ownership

| Failure | Correction location |
| --- | --- |
| Feature PR test, build, or review failure | Original feature branch |
| Conflict with newer `develop` | Original feature branch after reconciliation |
| Failure first discovered on `develop` | Focused integration-fix branch from `develop` |
| Synchronization conflict or extra required change | Focused issue branch; do not hide changes inside the `Sync:` PR |
| Production defect | Hotfix branch from `main`, then `Sync:` to `develop` |
| Transient GitHub Actions failure | Retry after inspecting the run; do not change product code without evidence |
| Missing credential or environment | Block with the exact provisioning or approval required |

## Repository protection policy

The intended GitHub rules are tracked in issue #33:

- `main` requires PRs, green required checks, resolved conversations, and human production approval.
- `develop` requires PRs, green required checks, and resolved conversations.
- Green low-risk PRs into `develop` may retain autonomous merge authority under `AGENTS.md`.
- Consequential changes require human review.
- Force-pushes and deletion are blocked on both long-lived branches.

The current connector does not expose branch-protection or ruleset administration, so issue #33 remains blocked on repository-settings capability.

## Future deployment environments

A public development site, production Studio, Blender worker, cloud storage, credentials, or paid infrastructure requires a separate approved issue. That issue must define:

- environment ownership;
- artifact promotion rather than uncontrolled rebuilds;
- secrets and permissions;
- smoke checks and health signals;
- rollback or forward-fix behavior;
- monitoring and incident routing;
- cost and external-service commitments.
