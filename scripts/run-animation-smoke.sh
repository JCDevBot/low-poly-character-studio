#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PINNED_BLENDER="$ROOT_DIR/.tools/blender/current/blender"
if [[ -n "${BLENDER_COMMAND:-}" ]]; then
  BLENDER="$BLENDER_COMMAND"
elif [[ -x "$PINNED_BLENDER" ]]; then
  BLENDER="$PINNED_BLENDER"
else
  BLENDER="blender"
fi

if [[ "$BLENDER" == */* ]]; then
  [[ -x "$BLENDER" ]] || { echo "Blender executable not found: $BLENDER" >&2; exit 1; }
elif ! command -v "$BLENDER" >/dev/null 2>&1; then
  echo "Blender executable not found: $BLENDER" >&2
  exit 1
fi

BLENDER_ARGS=(--background --factory-startup --python-exit-code 1)
MODEL_SCRIPT="$ROOT_DIR/packages/asset-compiler/blender/scripts/build_humanoid_job.py"
RIG_SCRIPT="$ROOT_DIR/packages/asset-compiler/blender/scripts/build_humanoid_rig_job.py"
ANIMATION_SCRIPT="$ROOT_DIR/packages/asset-compiler/blender/scripts/build_humanoid_animation_job.py"
OUTPUT_PARENT="$ROOT_DIR/image-analysis/output"
OUTPUT_DIR="$OUTPUT_PARENT/animation-smoke"
RIG_REVIEW_BUILD_DIR="$OUTPUT_PARENT/pr-21-rig-build"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

run_fixture() {
  local label="$1"
  local fixture="$ROOT_DIR/packages/asset-compiler/blender/tests/fixtures/style_dna_${label}.json"
  local fixture_dir="$OUTPUT_DIR/$label"
  local model_dir="$fixture_dir/model"
  local rig_dir="$fixture_dir/rig"
  local animate_dir="$fixture_dir/animate"
  local input_rig="$RIG_REVIEW_BUILD_DIR/$label/rig/humanoid-rigged.blend"
  mkdir -p "$animate_dir"

  if [[ -f "$input_rig" ]]; then
    echo "Reusing rig review artifact for $label animation smoke."
  else
    echo "Rig review artifact unavailable; building fresh $label rig."
    mkdir -p "$model_dir" "$rig_dir"
    "$BLENDER" "${BLENDER_ARGS[@]}" --python "$MODEL_SCRIPT" -- \
      --style-dna "$fixture" --output-dir "$model_dir" --job-id "animation-smoke-$label"
    "$BLENDER" "${BLENDER_ARGS[@]}" --python "$RIG_SCRIPT" -- \
      --input-blend "$model_dir/humanoid.blend" --style-dna "$fixture" \
      --output-dir "$rig_dir" --job-id "animation-smoke-$label"
    input_rig="$rig_dir/humanoid-rigged.blend"
  fi

  "$BLENDER" "${BLENDER_ARGS[@]}" --python "$ANIMATION_SCRIPT" -- \
    --input-blend "$input_rig" \
    --output-dir "$animate_dir" --job-id "animation-smoke-$label"

  python3 - "$animate_dir/animation-metadata.json" "$animate_dir/humanoid-animated.glb" <<'PY'
import json
import struct
import sys
from pathlib import Path

metadata_path = Path(sys.argv[1])
glb_path = Path(sys.argv[2])
expected = ["a-pose", "idle", "walk", "wave"]
metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
assert metadata["schema"] == "humanoid-animation-pack/v1"
assert metadata["rigId"] == "humanoid-basic-v1"
assert [clip["name"] for clip in metadata["clips"]] == expected
assert [clip["name"] for clip in metadata["clips"] if clip["loop"]] == ["idle", "walk"]
assert glb_path.is_file() and glb_path.stat().st_size > 0

raw = glb_path.read_bytes()
magic, version, total_length = struct.unpack_from("<4sII", raw, 0)
assert magic == b"glTF" and version == 2 and total_length == len(raw)
chunk_length, chunk_type = struct.unpack_from("<II", raw, 12)
assert chunk_type == 0x4E4F534A
payload = json.loads(raw[20:20 + chunk_length].decode("utf-8").rstrip(" \t\r\n\x00"))
assert [animation.get("name") for animation in payload.get("animations", [])] == expected
PY
}

run_fixture compact
run_fixture tall

echo "Compact and tall humanoid animation smoke tests passed."
