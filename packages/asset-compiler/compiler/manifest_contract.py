from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

MANIFEST_SCHEMA = "blender-build-manifest/v1"
ARTIFACT_SCHEMA = "1.0.0"


class ManifestContractError(ValueError):
    pass


@dataclass(frozen=True)
class ResolvedManifest:
    source: Path
    job_id: str
    model_type_id: str
    model_type_version: str
    pipeline_version: str
    style_dna: Path
    model_plan: Path
    rig_plan: Path
    animation_plan: Path
    output_dir: Path
    runtime: dict[str, Any]
    requested_clips: tuple[str, ...]


def _read_json(path: Path, label: str) -> dict[str, Any]:
    if not path.is_file():
        raise ManifestContractError(f"{label} does not exist: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ManifestContractError(f"{label} is not valid JSON: {error}") from error
    if not isinstance(value, dict):
        raise ManifestContractError(f"{label} must be a JSON object")
    return value


def _resolve(base: Path, value: Any, label: str) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise ManifestContractError(f"{label} must be a non-empty path")
    path = Path(value)
    return path if path.is_absolute() else (base / path).resolve()


def _require_artifact(path: Path, kind: str, job_id: str) -> dict[str, Any]:
    artifact = _read_json(path, kind)
    if artifact.get("kind") != kind:
        raise ManifestContractError(f"{path} kind must be {kind}")
    if artifact.get("schemaVersion") != ARTIFACT_SCHEMA:
        raise ManifestContractError(f"{path} schemaVersion must be {ARTIFACT_SCHEMA}")
    if artifact.get("jobId") != job_id:
        raise ManifestContractError(f"{path} jobId must match {job_id}")
    if not artifact.get("artifactId"):
        raise ManifestContractError(f"{path} artifactId is required")
    return artifact


def load_manifest(path: str | Path, repository_root: str | Path) -> ResolvedManifest:
    source = Path(path).resolve()
    root = Path(repository_root).resolve()
    manifest = _read_json(source, "build manifest")
    if manifest.get("schema") != MANIFEST_SCHEMA:
        raise ManifestContractError(f"build manifest schema must be {MANIFEST_SCHEMA}")

    job_id = manifest.get("jobId")
    if not isinstance(job_id, str) or not job_id:
        raise ManifestContractError("build manifest jobId is required")
    pipeline_version = manifest.get("pipelineVersion")
    if not isinstance(pipeline_version, str) or not pipeline_version:
        raise ManifestContractError("build manifest pipelineVersion is required")

    model_type = manifest.get("modelType")
    if not isinstance(model_type, dict):
        raise ManifestContractError("build manifest modelType is required")
    model_type_id = model_type.get("id")
    model_type_version = model_type.get("version")
    if not isinstance(model_type_id, str) or not isinstance(model_type_version, str):
        raise ManifestContractError("modelType id and version are required")

    registry = _read_json(root / "packages/model-types/runtime-registry.json", "runtime registry")
    runtime = registry.get("modelTypes", {}).get(model_type_id)
    if not isinstance(runtime, dict):
        raise ManifestContractError(f"runtime registry does not support {model_type_id}")
    if runtime.get("version") != model_type_version:
        raise ManifestContractError("model type version is incompatible with runtime registry")

    refs = manifest.get("artifacts")
    if not isinstance(refs, dict):
        raise ManifestContractError("build manifest artifacts are required")
    base = source.parent
    style_dna = _resolve(base, refs.get("styleDna"), "artifacts.styleDna")
    model_plan_path = _resolve(base, refs.get("modelPlan"), "artifacts.modelPlan")
    rig_plan_path = _resolve(base, refs.get("rigPlan"), "artifacts.rigPlan")
    animation_plan_path = _resolve(base, refs.get("animationPlan"), "artifacts.animationPlan")
    output_dir = _resolve(base, manifest.get("outputDir"), "outputDir")

    style = _read_json(style_dna, "StyleDNA")
    if style.get("schema") != "humanoid-style-dna/v1" or style.get("modelTypeId") != model_type_id:
        raise ManifestContractError("StyleDNA is incompatible with the selected model type")
    model_plan = _require_artifact(model_plan_path, "model-plan", job_id)
    rig_plan = _require_artifact(rig_plan_path, "rig-plan", job_id)
    animation_plan = _require_artifact(animation_plan_path, "animation-plan", job_id)

    if model_plan.get("modelTypeId") != model_type_id:
        raise ManifestContractError("model plan modelTypeId is incompatible")
    if model_plan.get("implementationId") != runtime["model"]["implementationId"]:
        raise ManifestContractError("model plan implementationId is not registered")
    if rig_plan.get("implementationId") != runtime["rig"]["implementationId"]:
        raise ManifestContractError("rig plan implementationId is not registered")
    if rig_plan.get("rigId") != runtime["rig"]["rigId"]:
        raise ManifestContractError("rig plan rigId is not registered")
    if animation_plan.get("implementationId") != runtime["animation"]["implementationId"]:
        raise ManifestContractError("animation plan implementationId is not registered")
    if animation_plan.get("packId") != runtime["animation"]["packId"]:
        raise ManifestContractError("animation plan packId is not registered")
    if rig_plan.get("modelPlanArtifactId") != model_plan.get("artifactId"):
        raise ManifestContractError("rig plan must reference the selected model plan")
    if animation_plan.get("rigPlanArtifactId") != rig_plan.get("artifactId"):
        raise ManifestContractError("animation plan must reference the selected rig plan")

    requested = animation_plan.get("requestedClips")
    if not isinstance(requested, list) or not requested or not all(isinstance(item, str) for item in requested):
        raise ManifestContractError("animation plan requestedClips must be a non-empty string array")

    return ResolvedManifest(
        source=source,
        job_id=job_id,
        model_type_id=model_type_id,
        model_type_version=model_type_version,
        pipeline_version=pipeline_version,
        style_dna=style_dna,
        model_plan=model_plan_path,
        rig_plan=rig_plan_path,
        animation_plan=animation_plan_path,
        output_dir=output_dir,
        runtime=runtime,
        requested_clips=tuple(requested),
    )
