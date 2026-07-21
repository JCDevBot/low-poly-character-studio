#!/usr/bin/env bash
set -euo pipefail

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
MODE="fresh-direct"

if ! command -v "$BLENDER" >/dev/null 2>&1; then
  echo "Blender executable not found: $BLENDER" >&2
  echo "Set BLENDER_COMMAND to the Blender executable path." >&2
  exit 1
fi

if [[ -n "$COMPACT_JOB" || -n "$TALL_JOB" ]]; then
  if [[ -z "$COMPACT_JOB" || -z "$TALL_JOB" ]]; then
    echo "Provide both compact and tall job IDs, or neither." >&2
    exit 2
  fi
  MODE="existing-jobs"
fi

rm -rf "$OUTPUT_DIR" "$BUILD_DIR" "$ZIP_PATH"
mkdir -p "$OUTPUT_DIR" "$BUILD_DIR"

render_rig() {
  local label="$1"
  local input_blend="$2"
  local rig_metadata="$3"
  local label_dir="$OUTPUT_DIR/$label"

  if [[ ! -f "$input_blend" ]]; then
    echo "Missing rigged Blend for $label: $input_blend" >&2
    exit 1
  fi
  if [[ ! -f "$rig_metadata" ]]; then
    echo "Missing rig metadata for $label: $rig_metadata" >&2
    exit 1
  fi

  mkdir -p "$label_dir"
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
  echo "Building fresh $label model from $(basename "$fixture")..."
  "$BLENDER" -b \
    --python "$MODEL_SCRIPT" \
    -- \
    --style-dna "$fixture" \
    --output-dir "$model_dir" \
    --job-id "rig-review-$label" \
    2>&1 | tee "$label_dir/blender-model.log"

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
  build_and_render compact "$COMPACT_FIXTURE"
  build_and_render tall "$TALL_FIXTURE"
  COMPACT_SOURCE="fresh:style_dna_compact.json"
  TALL_SOURCE="fresh:style_dna_tall.json"
else
  render_existing_job compact "$COMPACT_JOB"
  render_existing_job tall "$TALL_JOB"
  COMPACT_SOURCE="job:$COMPACT_JOB"
  TALL_SOURCE="job:$TALL_JOB"
fi

GIT_HEAD="$(git -C "$ROOT_DIR" rev-parse HEAD)"
python3 - "$OUTPUT_DIR" "$COMPACT_SOURCE" "$TALL_SOURCE" "$GIT_HEAD" "$MODE" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

output_dir = Path(sys.argv[1])
manifest = {
    "schema": "rig-review-package/v2",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "gitHead": sys.argv[4],
    "mode": sys.argv[5],
    "sources": {
        "compact": sys.argv[2],
        "tall": sys.argv[3],
    },
    "uploadInstruction": "Upload the ZIP to the review conversation; do not commit generated images.",
}
(output_dir / "package-manifest.json").write_text(
    json.dumps(manifest, indent=2) + "\n",
    encoding="utf-8",
)
PY

python3 - "$OUTPUT_DIR" "$ZIP_PATH" <<'PY'
import sys
import zipfile
from pathlib import Path

source = Path(sys.argv[1])
destination = Path(sys.argv[2])
with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob("*")):
        if path.is_file():
            archive.write(path, Path(source.name) / path.relative_to(source))
PY

echo
echo "Rig review package created from $MODE artifacts:"
echo "$ZIP_PATH"
echo
echo "Upload that ZIP to the review conversation for image analysis."
