from __future__ import annotations

import json
import tempfile
from pathlib import Path

from manifest_contract import ManifestContractError, load_manifest

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / "packages/asset-compiler/blender/tests/fixtures"


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def make_fixture(root: Path, label: str, implementation: str = "humanoid-chibi-generator-v1") -> Path:
    job = f"manifest-{label}"
    plans = root / "plans"
    write_json(plans / "model.json", {
        "kind": "model-plan", "schemaVersion": "1.0.0", "artifactId": f"model-{label}", "jobId": job,
        "createdAt": "2026-07-24T00:00:00Z", "producer": {"id": "fixture", "version": "1.0.0"},
        "modelTypeId": "humanoid/chibi-v1", "implementationId": implementation,
        "styleDnaArtifactId": f"style-{label}", "expectedParts": ["body", "head"], "generationSettings": {"seed": 1},
    })
    write_json(plans / "rig.json", {
        "kind": "rig-plan", "schemaVersion": "1.0.0", "artifactId": f"rig-{label}", "jobId": job,
        "createdAt": "2026-07-24T00:00:00Z", "producer": {"id": "fixture", "version": "1.0.0"},
        "rigId": "humanoid-basic-v1", "implementationId": "humanoid-basic-rig-v1",
        "modelPlanArtifactId": f"model-{label}", "requiredJoints": ["root", "hips", "head"],
    })
    write_json(plans / "animation.json", {
        "kind": "animation-plan", "schemaVersion": "1.0.0", "artifactId": f"animation-{label}", "jobId": job,
        "createdAt": "2026-07-24T00:00:00Z", "producer": {"id": "fixture", "version": "1.0.0"},
        "packId": "humanoid-basic-v1/default-v1", "implementationId": "humanoid-animation-pack-v1",
        "rigPlanArtifactId": f"rig-{label}", "requestedClips": ["a-pose", "idle", "walk", "wave"],
        "frameRate": 24, "rootMotion": "in-place",
    })
    manifest = root / "manifest.json"
    write_json(manifest, {
        "schema": "blender-build-manifest/v1", "jobId": job, "pipelineVersion": "1.0.0",
        "modelType": {"id": "humanoid/chibi-v1", "version": "1.0.0"},
        "artifacts": {
            "styleDna": str(FIXTURES / f"style_dna_{label}.json"),
            "modelPlan": "plans/model.json", "rigPlan": "plans/rig.json", "animationPlan": "plans/animation.json",
        },
        "outputDir": "output",
    })
    return manifest


def main() -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        for label in ("compact", "tall"):
            manifest = make_fixture(root / label, label)
            resolved = load_manifest(manifest, ROOT)
            assert resolved.job_id == f"manifest-{label}"
            assert resolved.requested_clips == ("a-pose", "idle", "walk", "wave")
            assert resolved.runtime["rig"]["rigId"] == "humanoid-basic-v1"

        invalid = make_fixture(root / "invalid", "compact", "unknown-generator")
        try:
            load_manifest(invalid, ROOT)
        except ManifestContractError as error:
            assert "implementationId is not registered" in str(error)
        else:
            raise AssertionError("unregistered implementation must fail before Blender")

    print("manifest compiler contract tests passed")


if __name__ == "__main__":
    main()
