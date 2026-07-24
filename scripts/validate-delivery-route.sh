#!/usr/bin/env bash
set -euo pipefail

base_ref="${1:-${BASE_REF:-}}"
head_ref="${2:-${HEAD_REF:-}}"
pr_title="${3:-${PR_TITLE:-}}"

fail() {
  echo "$1" >&2
  exit 1
}

if [[ -z "$base_ref" || -z "$head_ref" ]]; then
  fail "Delivery route validation requires base and head refs."
fi

if [[ "$base_ref" == "develop" ]]; then
  if [[ "$head_ref" == "main" ]]; then
    if [[ "$pr_title" == Sync:* ]]; then
      exit 0
    fi
    fail "Pull requests from main to develop must be explicit synchronization PRs with a title beginning 'Sync:'."
  fi

  if [[ "$head_ref" == "develop" ]]; then
    fail "Ordinary work must use a feature or fix branch and target develop."
  fi

  exit 0
fi

if [[ "$base_ref" == "main" ]]; then
  if [[ "$head_ref" == "develop" ]]; then
    exit 0
  fi

  if [[ "$head_ref" == agent/issue-* && "$pr_title" == Hotfix:* ]]; then
    exit 0
  fi

  fail "Pull requests to main must be a develop promotion or an explicitly titled Hotfix from an agent/issue-* branch."
fi

fail "Unsupported pull request target: $base_ref"
