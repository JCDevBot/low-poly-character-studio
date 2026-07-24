#!/usr/bin/env bash
set -euo pipefail

validator="scripts/validate-delivery-route.sh"

expect_pass() {
  local label="$1"
  local base_ref="$2"
  local head_ref="$3"
  local title="$4"

  if ! bash "$validator" "$base_ref" "$head_ref" "$title"; then
    echo "Expected route to pass: $label" >&2
    exit 1
  fi
}

expect_fail() {
  local label="$1"
  local base_ref="$2"
  local head_ref="$3"
  local title="$4"

  if bash "$validator" "$base_ref" "$head_ref" "$title" >/dev/null 2>&1; then
    echo "Expected route to fail: $label" >&2
    exit 1
  fi
}

expect_pass "ordinary feature to develop" "develop" "agent/issue-35-main-develop-sync" "Permit synchronization routes"
expect_pass "integration fix to develop" "develop" "agent/issue-99-integration-fix" "Restore green integration"
expect_pass "develop promotion to main" "main" "develop" "Promote develop to main"
expect_pass "explicit hotfix to main" "main" "agent/issue-100-production-fix" "Hotfix: restore production"
expect_pass "explicit main synchronization to develop" "develop" "main" "Sync: reconcile production into develop"

expect_fail "implicit main synchronization to develop" "develop" "main" "Merge main into develop"
expect_fail "develop targeting itself" "develop" "develop" "Invalid self pull request"
expect_fail "ordinary feature targeting main" "main" "agent/issue-101-feature" "Add feature"
expect_fail "hotfix without required title" "main" "agent/issue-102-fix" "Fix production"
expect_fail "unsupported target" "release" "agent/issue-103-release" "Target unsupported branch"

echo "Delivery route policy matrix passed."
