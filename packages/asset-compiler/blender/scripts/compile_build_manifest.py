from __future__ import annotations

import argparse
import hashlib
import json
import runpy
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIR.parents[3]
COMPILER_DIR = REPOSITORY_ROOT / "packages" / "asset-compiler" / "compiler"
sys.path.insert(0, str(COMPILER_DIR))

from manifest_contract import load_manifest


def parse_args():
    parser = argparse.ArgumentParser(description="Compile one versioned build manifest through Blender")
    parser.add_argument("--manifest", type=Path, required=True)
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def run_script(script: Path, arguments: list[str]) -> None:
    previous = sys.argv
    try:
        sys.argv = [str(script), "--", *arguments]
        runpy.run_path(str(script), run_name="__main__")
    finally:
        sys.argv = previous


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    args = parse_args()
    resolved = load_manifest(args.manifest, REPOSITORY_ROOT)
    output = resolved.output_dir
    model_dir = output / "model"
    rig_dir = output / "rig"
    animation_dir = output / "animate"
    review_dir = output / "review"
    for directory in (model_dir, rig_dir, animation_dir, review_dir):
        directory.mkdir(parents=True, exist_ok=True)

    runtime = resolved.runtime
    run_script(
        REPOSITORY_ROOT / runtime["model"]["script"],
        ["--style-dna", str(resolved.style_dna), "--output-dir", str(model_dir), "--job-id", resolved.job_id],
    )
    run_script(
        REPOSITORY_ROOT / runtime["rig"]["script"],
        [
            "--input-blend", str(model_dir / "humanoid.blend"),
            "--style-dna", str(resolved.style_dna),
            "--output-dir", str(rig_dir),
            "--job-id", resolved.job_id,
        ],
    )
    run_script(
        REPOSITORY_ROOT / runtime["animation"]["script"],
        [
            "--input-blend", str(rig_dir / "humanoid-rigged.blend"),
            "--output-dir", str(animation_dir),
            "--job-id", resolved.job_id,
        ],
    )
    run_script(
        REPOSITORY_ROOT / runtime["review"]["script"],
        [
            "--input-blend", str(animation_dir / "humanoid-animated.blend"),
            "--metadata", str(animation_dir / "animation-metadata.json"),
            "--output-dir", str(review_dir),
            "--label", resolved.job_id,
        ],
    )

    outputs = [
        model_dir / "generation-metadata.json",
        rig_dir / "rig-metadata.json",
        animation_dir / "animation-metadata.json",
        animation_dir / "humanoid-animated.glb",
        review_dir / "review-manifest.json",
    ]
    missing = [str(path) for path in outputs if not path.is_file()]
    if missing:
        raise ValueError(f"Compiler did not produce required outputs: {missing}")

    metadata = json.loads((animation_dir / "animation-metadata.json").read_text(encoding="utf-8"))
    actual_clips = [clip["name"] for clip in metadata.get("clips", [])]
    if actual_clips != list(resolved.requested_clips):
        raise ValueError(f"Generated clips {actual_clips} do not match requested clips {list(resolved.requested_clips)}")

    result = {
        "schema": "blender-compile-result/v1",
        "jobId": resolved.job_id,
        "modelType": {"id": resolved.model_type_id, "version": resolved.model_type_version},
        "pipelineVersion": resolved.pipeline_version,
        "sourceManifest": str(resolved.source),
        "implementations": {
            "model": runtime["model"]["implementationId"],
            "rig": runtime["rig"]["implementationId"],
            "animation": runtime["animation"]["implementationId"],
        },
        "requestedClips": list(resolved.requested_clips),
        "completedAt": datetime.now(timezone.utc).isoformat(),
        "outputs": [
            {"path": str(path.relative_to(output)), "sha256": sha256(path), "bytes": path.stat().st_size}
            for path in outputs
        ],
    }
    (output / "compile-result.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Compiled manifest {resolved.source} to {output}")


if __name__ == "__main__":
    main()
