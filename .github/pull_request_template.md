## Issue

Closes #

## Change type

- [ ] Ordinary feature or fix targeting `develop`
- [ ] Integration fix targeting `develop`
- [ ] `Sync:` reconciliation from `main` to `develop`
- [ ] Promotion from `develop` to `main`
- [ ] `Hotfix:` branch created from `main` and targeting `main`
- [ ] Documentation, tests, CI, contract, or maintenance
- [ ] Review-required Blender, visual, architecture, security, credential, or delivery-policy change

## Summary

- 

## Branch contract

- [ ] The branch was created from the correct source branch.
- [ ] The PR targets the correct branch.
- [ ] `main -> develop` synchronization was checked before ordinary branching.
- [ ] A synchronization PR has head `main`, base `develop`, and a title beginning `Sync:`.
- [ ] A synchronization PR contains no changes beyond already-approved `main` history, or its conflicts/additional edits are explicitly reviewed.
- [ ] Feature-specific failures were corrected on this branch rather than after merge.
- [ ] A hotfix includes a plan to reconcile the fix back into `develop` through `Sync:`.

## Acceptance criteria

- [ ] The linked issue acceptance criteria are complete, or this is a routine synchronization/promotion PR that does not require a separate issue.
- [ ] User-facing, architecture, or operating changes are documented.
- [ ] Known limitations and follow-up work are identified.

## Validation

- Checks run:
- CI run:
- Generated or delivery artifacts:
- Artifacts directly inspected:
- Branch ancestry verified:

## Risk and approval

- Risk class:
- Human gate required:
- Remaining decision or subjective acceptance:

## Promotion details

Complete only for `develop -> main`:

- Source commit:
- Target commit:
- Included issues:
- Green `develop` artifact:
- Rollback or forward-fix guidance:
- Human production approval:

## Synchronization details

Complete only for `Sync: main -> develop`:

- `main` commit being reconciled:
- `develop` target commit:
- Conflicts or additional edits: none / described below
- Post-merge ancestry check:
