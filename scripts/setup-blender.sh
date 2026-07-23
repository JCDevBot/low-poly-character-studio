#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="${BLENDER_VERSION_FILE:-$ROOT_DIR/.blender-version}"
TOOLS_DIR="${BLENDER_TOOLS_DIR:-$ROOT_DIR/.tools/blender}"
EXPECTED_VERSION="5.2.0"
EXPECTED_BUILD_HASH="fbe6228777e7"
EXPECTED_LINUX_X64_SHA256="96f6c181a30f4950607839dc84d42a354b250d8a0231b098b59b7bc69c351c48"

if [[ ! -f "$VERSION_FILE" ]]; then
  echo "Blender version file not found: $VERSION_FILE" >&2
  exit 1
fi

BLENDER_VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"
if [[ "$BLENDER_VERSION" != "$EXPECTED_VERSION" ]]; then
  echo "Unsupported pinned Blender version: $BLENDER_VERSION" >&2
  echo "Update scripts/setup-blender.sh checksums before changing .blender-version." >&2
  exit 1
fi

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "The repository-managed Blender toolchain currently supports Linux x86_64 only." >&2
  echo "Set BLENDER_COMMAND to an installed Blender executable on other platforms." >&2
  exit 1
fi

RELEASE_SERIES="${BLENDER_VERSION%.*}"
ARCHIVE_NAME="blender-${BLENDER_VERSION}-linux-x64.tar.xz"
DOWNLOAD_URL="https://download.blender.org/release/Blender${RELEASE_SERIES}/${ARCHIVE_NAME}"
INSTALL_NAME="blender-${BLENDER_VERSION}-linux-x64"
INSTALL_DIR="$TOOLS_DIR/$INSTALL_NAME"
CURRENT_LINK="$TOOLS_DIR/current"
BLENDER_EXECUTABLE="$INSTALL_DIR/blender"

verify_blender() {
  local executable="$1"
  local output

  [[ -x "$executable" ]] || return 1
  output="$("$executable" --version 2>&1)" || return 1
  grep -Fq "Blender $EXPECTED_VERSION" <<<"$output" || return 1
  grep -Fq "$EXPECTED_BUILD_HASH" <<<"$output" || return 1
}

mkdir -p "$TOOLS_DIR"

if ! verify_blender "$BLENDER_EXECUTABLE"; then
  ARCHIVE_TMP="$(mktemp "$TOOLS_DIR/.${ARCHIVE_NAME}.XXXXXX")"
  STAGING_DIR="$(mktemp -d "$TOOLS_DIR/.blender-staging.XXXXXX")"
  cleanup() {
    rm -f "$ARCHIVE_TMP"
    rm -rf "$STAGING_DIR"
  }
  trap cleanup EXIT

  echo "Downloading Blender $BLENDER_VERSION from $DOWNLOAD_URL"
  curl \
    --fail \
    --location \
    --retry 5 \
    --retry-all-errors \
    --retry-delay 2 \
    --output "$ARCHIVE_TMP" \
    "$DOWNLOAD_URL"

  printf '%s  %s\n' "$EXPECTED_LINUX_X64_SHA256" "$ARCHIVE_TMP" | sha256sum --check --status
  echo "Verified Blender archive SHA-256."

  tar -xJf "$ARCHIVE_TMP" -C "$STAGING_DIR"
  STAGED_INSTALL="$STAGING_DIR/$INSTALL_NAME"
  if ! verify_blender "$STAGED_INSTALL/blender"; then
    echo "Downloaded Blender did not match version $EXPECTED_VERSION and build $EXPECTED_BUILD_HASH." >&2
    exit 1
  fi

  rm -rf "$INSTALL_DIR"
  mv "$STAGED_INSTALL" "$INSTALL_DIR"
  echo "Installed Blender at $INSTALL_DIR"
fi

ln -sfn "$INSTALL_NAME" "$CURRENT_LINK"
BLENDER_EXECUTABLE="$CURRENT_LINK/blender"

if ! verify_blender "$BLENDER_EXECUTABLE"; then
  echo "Pinned Blender verification failed after installation." >&2
  exit 1
fi

"$BLENDER_EXECUTABLE" --version

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "executable=$BLENDER_EXECUTABLE"
    echo "version=$BLENDER_VERSION"
    echo "build_hash=$EXPECTED_BUILD_HASH"
  } >> "$GITHUB_OUTPUT"
fi

echo "Pinned Blender executable: $BLENDER_EXECUTABLE"
