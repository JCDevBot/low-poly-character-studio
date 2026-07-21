#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPACT_JOB="${1:-${COMPACT_JOB:-}}"
TALL_JOB="${2:-${TALL_JOB:-}}"
BLENDER="${BLENDER_COMMAND:-blender}"
RENDER_SCRIPT="$ROOT_DIR/packages/asset-compiler/blender/scripts/render_rig_review.py"
OUTPUT_PARENT="$ROOT_DIR/image-analysis/output"
OUTPUT_DIR="$OUTPUT_PARENT/pr-21-rig-review"
ZIP_PATH="$OUTPUT_PARENT/pr-21-rig-review.zip"

if [[ -z "$COMPACT_JOB" || -z "$TALL_JOB" ]]; then
  cat >&2 <<'USAGE'
Usage: pnpm rig-review COMPACT_JOB_ID TALL_JOB_ID

The jobs must already have completed model and rig stages.
COMPACT_JOB and TALL_JOB environment variables may be used instead of arguments.
USAGE
  exit 2
fi

if ! command -v "$BLENDER" >/dev/null 2>&1; then
  echo "Blender executable not found: $BLENDER" >&2
  echo "Set BLENDER_COMMAND to the Blender executable path." >&2
  exit 1
fi

rm -rf "$OUTPUT_DIR" "$ZIP_PATH"
mkdir -p "$OUTPUT_DIR"

render_job() {
  local label="$1"
  local job_id="$2"
  local job_dir="$ROOT_DIR/.workspace/build-jobs/$job_id"
  local input_blend="$job_dir/artifacts/rig/humanoid-rigged.blend"
  local rig_metadata="$job_dir/artifacts/rig/rig-metadata.json"
  local label_dir="$OUTPUT_DIR/$label"

  if [[ ! -f "$input_blend" ]]; then
    echo "Missing rigged Blend for $label job $job_id: $input_blend" >&2
    exit 1
  fi
  if [[ ! -f "$rig_metadata" ]]; then
    echo "Missing rig metadata for $label job $job_id: $rig_metadata" >&2
    exit 1
  fi

  mkdir -p "$label_dir"
  echo "Rendering $label rig review for job $job_id..."
  "$BLENDER" -b \
    --python "$RENDER_SCRIPT" \
    -- \
    --input-blend "$input_blend" \
    --output-dir "$label_dir" \
    --label "$label" \
    2>&1 | tee "$label_dir/blender-render.log"

  cp "$rig_metadata" "$label_dir/rig-metadata.json"
}

render_job compact "$COMPACT_JOB"
render_job tall "$TALL_JOB"

GIT_HEAD="$(git -C "$ROOT_DIR" rev-parse HEAD)"
python3 - "$OUTPUT_DIR" "$COMPACT_JOB" "$TALL_JOB" "$GIT_HEAD" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

output_dir = Path(sys.argv[1])
manifest = {
    "schema": "rig-review-package/v1",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "gitHead": sys.argv[4],
    "jobs": {
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
echo "Rig review package created:"
echo "$ZIP_PATH"
echo
echo "Upload that ZIP to the review conversation for image analysis."
