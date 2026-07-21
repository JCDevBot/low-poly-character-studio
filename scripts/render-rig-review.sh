#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPACT_JOB="${1:-${COMPACT_JOB:-}}"
TALL_JOB="${2:-${TALL_JOB:-}}"
BLENDER="${BLENDER_COMMAND:-blender}"
MODEL_SCRIPT="$ROOT_DIR/packages/asset-compiler/blender/scripts/build_humanoid_job.py"
RIG_SCRIPT="$ROOT_DIR/packages/asset-compiler/blender/scripts/build_humanoid_rig_job.py"
RENDER_SCRIPT="$ROOT_DIR/packages/asset-compiler/blender/scripts/render_rig_review.py"
COMPACT_FIXTURE="$ROOT_DIR/packages/asset-compiler/blender/tests/fixtures/style_dna_compact.json"
TALL_FIXTURE="$ROOT_DIR/packages/asset-compiler/blender/tests/fixtures/style_dna_tall.json"
OUTPUT_PARENT="$ROOT_DIR/image-analysis/output"
OUTPUT_DIR="$OUTPUT_PARENT/pr-21-rig-review"
BUILD_DIR="$OUTPUT_PARENT/pr-21-rig-build"
ZIP_PATH="$OUTPUT_PARENT/pr-21-rig-review.zip"
FAILURE_ZIP_PATH="$OUTPUT_PARENT/pr-21-rig-review-failed.zip"
MODE="fresh-direct"
CURRENT_STEP="initialization"

write_package_manifest() {
  local status="$1"
  local detail="$2"
  local git_head
  git_head="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || printf 'unknown')"
  python3 - \
    "$OUTPUT_DIR" \
    "$status" \
    "$detail" \
    "${COMPACT_SOURCE:-pending}" \
    "${TALL_SOURCE:-pending}" \
    "$git_head" \
    "$MODE" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

output_dir = Path(sys.argv[1])
manifest = {
    "schema": "rig-review-package/v2",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "status": sys.argv[2],
    "detail": sys.argv[3],
    "gitHead": sys.argv[6],
    "mode": sys.argv[7],
    "sources": {
        "compact": sys.argv[4],
        "tall": sys.argv[5],
    },
    "uploadInstruction": "Upload the ZIP to the review conversation; do not commit generated images.",
}
output_dir.mkdir(parents=True, exist_ok=True)
(output_dir / "package-manifest.json").write_text(
    json.dumps(manifest, indent=2) + "\n",
    encoding="utf-8",
)
PY
}

create_zip() {
  local source="$1"
  local destination="$2"
  python3 - "$source" "$destination" <<'PY'
import sys
import zipfile
from pathlib import Path

source = Path(sys.argv[1])
destination = Path(sys.argv[2])
destination.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob("*")):
        if path.is_file():
            archive.write(path, Path(source.name) / path.relative_to(source))
PY
}

on_error() {
  local exit_code=$?
  local line_number="$1"
  local failed_command="$2"
  trap - ERR
  set +e

  mkdir -p "$OUTPUT_DIR"
  cat > "$OUTPUT_DIR/failure-summary.txt" <<EOF
PR #21 rig review failed.

Step: $CURRENT_STEP
Exit code: $exit_code
Line: $line_number
Command: $failed_command

The normal review ZIP was not created because Blender or a validation step failed.
Upload pr-21-rig-review-failed.zip so the logs and partial outputs can be analyzed.
EOF

  write_package_manifest "failed" "$CURRENT_STEP exited with code $exit_code"
  create_zip "$OUTPUT_DIR" "$FAILURE_ZIP_PATH"

  echo >&2
  echo "Rig review failed during: $CURRENT_STEP" >&2
  echo "A diagnostic package was created:" >&2
  echo "$FAILURE_ZIP_PATH" >&2
  echo "Upload that ZIP to the review conversation." >&2
  exit "$exit_code"
}

trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR

CURRENT_STEP="checking Blender executable"
if ! command -v "$BLENDER" >/dev/null 2>&1; then
  echo "Blender executable not found: $BLENDER" >&2
  echo "Set BLENDER_COMMAND to the Blender executable path." >&2
  false
fi

if [[ -n "$COMPACT_JOB" || -n "$TALL_JOB" ]]; then
  if [[ -z "$COMPACT_JOB" || -z "$TALL_JOB" ]]; then
    echo "Provide both compact and tall job IDs, or neither." >&2
    exit 2
  fi
  MODE="existing-jobs"
fi

rm -rf "$OUTPUT_DIR" "$BUILD_DIR" "$ZIP_PATH" "$FAILURE_ZIP_PATH"
mkdir -p "$OUTPUT_DIR" "$BUILD_DIR"

render_rig() {
  local label="$1"
  local input_blend="$2"
  local rig_metadata="$3"
  local label_dir="$OUTPUT_DIR/$label"

  if [[ ! -f "$input_blend" ]]; then
    echo "Missing rigged Blend for $label: $input_blend" >&2
    return 1
  fi
  if [[ ! -f "$rig_metadata" ]]; then
    echo "Missing rig metadata for $label: $rig_metadata" >&2
    return 1
  fi

  mkdir -p "$label_dir"
  CURRENT_STEP="rendering $label review images"
  "$BLENDER" -b \
    --python "$RENDER_SCRIPT" \
    -- \
    --input-blend "$input_blend" \
    --output-dir "$label_dir" \
    --label "$label" \
    2>&1 | tee "$label_dir/blender-render.log"

  cp "$rig_metadata" "$label_dir/rig-metadata.json"
}

build_and_render() {
  local label="$1"
  local fixture="$2"
  local fixture_build="$BUILD_DIR/$label"
  local model_dir="$fixture_build/model"
  local rig_dir="$fixture_build/rig"
  local label_dir="$OUTPUT_DIR/$label"

  mkdir -p "$model_dir" "$rig_dir" "$label_dir"
  CURRENT_STEP="building fresh $label model"
  echo "Building fresh $label model from $(basename "$fixture")..."
  "$BLENDER" -b \
    --python "$MODEL_SCRIPT" \
    -- \
    --style-dna "$fixture" \
    --output-dir "$model_dir" \
    --job-id "rig-review-$label" \
    2>&1 | tee "$label_dir/blender-model.log"

  CURRENT_STEP="rigging fresh $label model"
  echo "Rigging fresh $label model..."
  "$BLENDER" -b \
    --python "$RIG_SCRIPT" \
    -- \
    --input-blend "$model_dir/humanoid.blend" \
    --style-dna "$fixture" \
    --output-dir "$rig_dir" \
    --job-id "rig-review-$label" \
    2>&1 | tee "$label_dir/blender-rig.log"

  render_rig "$label" "$rig_dir/humanoid-rigged.blend" "$rig_dir/rig-metadata.json"
}

render_existing_job() {
  local label="$1"
  local job_id="$2"
  local job_dir="$ROOT_DIR/.workspace/build-jobs/$job_id"
  render_rig \
    "$label" \
    "$job_dir/artifacts/rig/humanoid-rigged.blend" \
    "$job_dir/artifacts/rig/rig-metadata.json"
}

if [[ "$MODE" == "fresh-direct" ]]; then
  COMPACT_SOURCE="fresh:style_dna_compact.json"
  TALL_SOURCE="fresh:style_dna_tall.json"
  build_and_render compact "$COMPACT_FIXTURE"
  build_and_render tall "$TALL_FIXTURE"
else
  COMPACT_SOURCE="job:$COMPACT_JOB"
  TALL_SOURCE="job:$TALL_JOB"
  render_existing_job compact "$COMPACT_JOB"
  render_existing_job tall "$TALL_JOB"
fi

CURRENT_STEP="packaging successful review"
write_package_manifest "completed" "compact and tall review renders completed"
create_zip "$OUTPUT_DIR" "$ZIP_PATH"

echo
echo "Rig review package created from $MODE artifacts:"
echo "$ZIP_PATH"
echo
echo "Upload that ZIP to the review conversation for image analysis."
