# Agent Steering Scenarios

These scenarios are behavioral acceptance tests for `AGENTS.md` and `docs/task-management.md`. They describe how the agent should act when a matching GitHub story exists; they are not automatically backlog items.

## Scenario matrix

| Scenario | Pickup rule | Autonomous actions | Required evidence | Human gate | Expected GitHub state |
| --- | --- | --- | --- | --- | --- |
| Small isolated feature | Select when `READY`, dependencies are satisfied, and it wins priority ordering | Verify `main -> develop`, branch from `develop`, implement full criteria, test, document, open PR to `develop`, correct CI on the branch | Relevant tests, green CI, focused PR summary | Only for consequential product behavior or other review-required risk | Closed after authorized merge; otherwise `REVIEW` |
| Reproducible defect | Select as ordinary `READY`; priority reflects impact | Reproduce first, add regression test, implement smallest safe fix, inspect surrounding behavior | Failing-before/passing-after test and green CI | Security, data, consequential behavior, or ambiguous risk | Defect closes on merge; unrelated defect becomes separate issue |
| Test-only coverage gap | Select as low-risk `READY` work | Add deterministic tests without product behavior changes | Test demonstrates intended regression coverage and CI passes | Only when the test encodes a disputed product decision | Agent may merge to `develop` and verify closure |
| Routine dependency or tool update | Select when bounded and reversible | Read authoritative release notes, update lock/config files, test compatibility and rollback | Diff, lockfile, relevant full CI | Major version, security-sensitive change, paid service, or material runtime effect | Low-risk update may merge to `develop`; otherwise `REVIEW` |
| Feature PR CI failure | Continue linked issue regardless of `REVIEW` title | Move issue to `IN PROGRESS`, inspect job/steps/logs, reproduce narrowly, correct original feature branch, rerun CI | Exact failed step, root cause, correction, green rerun | Only when correction requires a consequential decision or unavailable environment | Same PR returns green, then issue returns to `REVIEW` |
| Branch conflict with `develop` | Treat as active PR follow-up | Compare refs and files, reconcile `develop` into feature branch with normal commits, resolve non-consequential conflicts, rerun checks | Branch comparison and refreshed CI | Conflict represents unresolved product or architecture decision | PR becomes mergeable and current |
| Failure first appearing on `develop` | Interrupt additional ordinary merges | Diagnose integration regression, create or update defect, branch from `develop`, add regression coverage, PR to `develop` | Failing integration evidence and green repair | Consequential risk as applicable | Integration-fix PR merges; `develop` returns green |
| Blender geometry, rig, animation, or material change | Pick normally when `READY` | Implement completely, run structural and Blender checks, generate and download artifacts, inspect required views/frames | Automated checks plus direct artifact inspection against applicable gold standard | Product-owner visual or motion approval before merge | Green PR to `develop` remains `REVIEW` until approval |
| Architecture or consequential product decision | Pick only when accepted direction is stated or issue requests a bounded spike | Implement accepted architecture; otherwise produce time-boxed options, tradeoffs, and recommendation | Decision record or implementation validation | Architecture/product decision and final PR approval | `BLOCKED` only when decision is genuinely absent; otherwise `REVIEW` |
| Credential, secret, paid service, or external commitment | Advance only safe local boundary work | Never fabricate credentials, commit secrets, purchase services, or create commitments; implement mocks/fallbacks when scoped | Exact requested permission, credential, account, cost, and secure handoff | Explicit approval and provisioning | `BLOCKED` with smallest required human action |
| Delivery artifact failure on `develop` | Treat as integration follow-up | Inspect workflow and build logs, separate code from infrastructure, retry only transient failure, fix code through branch from `develop` | Run ID, failed step, retry result, repair CI | Environment or external commitment when required | Artifact restored or issue `BLOCKED` precisely |
| Promotion `develop -> main` | Open only from green `develop` with current artifact | Prepare focused promotion PR listing commits, issues, CI, artifact, risks, rollback/forward-fix | Green combined PR CI and exact source artifact identity | Explicit human production-promotion approval | Promotion PR merges to `main`; main evidence verified |
| Production hotfix | Use for production-impacting defect | Branch from `main`, title PR `Hotfix:`, implement narrow fix, test, merge only after required review, synchronize `main -> develop` | Production symptom, regression test, hotfix CI, reconciliation CI | Human production/hotfix approval appropriate to risk | Hotfix reaches both `main` and `develop`; issue closes |
| Production/runtime incident | Override normal ordering only for justified P0 | Correlate release/commit, deduplicate alerts, gather logs, contain safely, prepare hotfix, add regression coverage | Incident timeline, affected release, containment and validation | Incident commander or production authority where applicable | Incident plus linked defect/hotfix; ordinary work resumes after stability |
| Objective dependency blocker | Do not implement while prerequisite remains incomplete | Recheck named issues and PRs every run; promote immediately when all close/merge | Exact dependency state | None for objective promotion | No stale `BLOCKED` state |
| Epic with open child issues | Never select as one implementation issue | Maintain sequencing and work eligible child selected by deterministic ordering | Child status and outcome mapping | Epic-level decision only when necessary | Epic remains tracking/blocking until children and outcome complete |
| Exploratory spike | Select only with strict time box and knowledge outcome | Avoid production coupling, gather evidence, compare options, document learned/unknown, create bounded follow-ups | Reproducible experiment or decision record | Decision when spike exists to choose direction | Spike closes; implementation is separate issue |
| Security-sensitive or destructive change | Select only with explicit scope and safeguards | Prepare backup, rollback, validation, migration and failure-recovery plan; minimize blast radius | Threat/data analysis and tested recovery plan | Mandatory security/data-owner/execution approval | `REVIEW` or `BLOCKED`; never autonomous consequential execution |
| Steering or delivery-policy change | Select as focused governance issue | Change steering, workflow, CI policy and scenario docs consistently; validate actual repository behavior | Diff consistency, CI, scenario audit | Human approval because operating authority changes | PR to `develop` remains `REVIEW` until approval |

## Cross-scenario assertions

1. `get_repo` is the first availability test. A hidden schema is not a connector outage.
2. `main` is production truth and `develop` is integration truth.
3. Ordinary work branches from `develop` and targets `develop`.
4. A red feature stays on its feature branch until corrected.
5. A regression first appearing on `develop` is repaired through a focused branch from `develop`.
6. `develop -> main` is a reviewed promotion, not silent automation.
7. A hotfix starts from `main` and is incomplete until reconciled into `develop`.
8. Human gates restrict merge, promotion, credentials, destructive execution, or subjective acceptance; they do not prevent complete implementation and evidence preparation.
9. `BLOCKED` is the last safe state after the troubleshooting ladder, not a substitute for inspecting logs or retrying transient operations.
10. Queued CI does not end a run while useful independent work remains.
11. Interrupted runs verify existing writes before repeating them.
12. Generated-artifact claims distinguish automated structure, direct inspection, and remaining subjective judgment.
13. Build artifacts prove a specific build, not a public deployment.
14. Repository-specific contracts override generic Git-flow assumptions.

## Expected decision examples

### Feature is red before merge

The agent updates the feature branch, not `develop`, until the feature-to-`develop` PR is green.

### Feature was green but `develop` turns red

The agent creates a focused integration-fix branch from the failing `develop` commit. It does not rewrite the already merged feature history or commit directly to `develop`.

### `main` receives a hotfix

The agent pauses new feature branching, synchronizes the hotfix into `develop`, verifies green CI, and only then resumes ordinary work.

### `develop` is green and ready for production

The agent opens or updates a `develop -> main` promotion PR and prepares all evidence. It does not merge until a human explicitly approves production promotion.
