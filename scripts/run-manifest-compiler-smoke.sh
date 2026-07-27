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

WORK_DIR="$ROOT_DIR/image-analysis/output/manifest-compiler-smoke"
COMPILER="$ROOT_DIR/packages/asset-compiler/blender/scripts/compile_build_manifest.py"
FIXTURES="$ROOT_DIR/packages/asset-compiler/blender/tests/fixtures"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"

write_fixture() {
  local label="$1"
  local fixture_dir="$WORK_DIR/$label"
  mkdir -p "$fixture_dir/plans"
  python3 - "$fixture_dir" "$FIXTURES/style_dna_${label}.json" "$label" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
style = Path(sys.argv[2]).resolve()
label = sys.argv[3]
job = f"manifest-smoke-{label}"
base = {
    "schemaVersion": "1.0.0",
    "jobId": job,
    "createdAt": "2026-07-24T00:00:00Z",
    "producer": {"id": "manifest-smoke-fixture", "version": "1.0.0"},
}
artifacts = {
    "model.json": {
        **base, "kind": "model-plan", "artifactId": f"model-{label}",
        "modelTypeId": "humanoid/chibi-v1", "implementationId": "humanoid-chibi-generator-v1",
        "styleDnaArtifactId": f"style-{label}", "expectedParts": ["body", "head", "hair", "shirt", "briefs"],
        "generationSettings": {"deterministicSeed": 1},
    },
    "rig.json": {
        **base, "kind": "rig-plan", "artifactId": f"rig-{label}",
        "rigId": "humanoid-basic-v1", "implementationId": "humanoid-basic-rig-v1",
        "modelPlanArtifactId": f"model-{label}", "requiredJoints": ["root", "hips", "spine", "head"],
    },
    "animation.json": {
        **base, "kind": "animation-plan", "artifactId": f"animation-{label}",
        "packId": "humanoid-basic-v1/default-v1", "implementationId": "humanoid-animation-pack-v1",
        "rigPlanArtifactId": f"rig-{label}", "requestedClips": ["a-pose", "idle", "walk", "wave"],
        "frameRate": 24, "rootMotion": "in-place",
    },
}
for name, value in artifacts.items():
    (root / "plans" / name).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
manifest = {
    "schema": "blender-build-manifest/v1",
    "jobId": job,
    "pipelineVersion": "1.0.0",
    "modelType": {"id": "humanoid/chibi-v1", "version": "1.0.0"},
    "artifacts": {
        "styleDna": str(style),
        "modelPlan": "plans/model.json",
        "rigPlan": "plans/rig.json",
        "animationPlan": "plans/animation.json",
    },
    "outputDir": "output",
}
(root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
PY
}

run_fixture() {
  local label="$1"
  local fixture_dir="$WORK_DIR/$label"
  write_fixture "$label"
  "$BLENDER" --background --factory-startup --python-exit-code 1 \
    --python "$COMPILER" -- --manifest "$fixture_dir/manifest.json"
  python3 - "$fixture_dir/output/compile-result.json" <<'PY'
import json
import sys
from pathlib import Path
result_path = Path(sys.argv[1])
result = json.loads(result_path.read_text(encoding="utf-8"))
assert result["schema"] == "blender-compile-result/v1"
assert result["requestedClips"] == ["a-pose", "idle", "walk", "wave"]
assert result["implementations"] == {
    "model": "humanoid-chibi-generator-v1",
    "rig": "humanoid-basic-rig-v1",
    "animation": "humanoid-animation-pack-v1",
}
for output in result["outputs"]:
    path = result_path.parent / output["path"]
    assert path.is_file() and path.stat().st_size == output["bytes"]
PY
}

run_fixture compact
run_fixture tall

echo "Compact and tall fixtures passed through the manifest-driven Blender compiler."
