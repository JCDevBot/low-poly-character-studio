"""Validated humanoid StyleDNA loading for Blender generation."""

from __future__ import annotations

import json
from dataclasses import asdict, replace
from pathlib import Path
from typing import Any

from .character_dna import LittleGuyDNA

STYLE_DNA_SCHEMA = "humanoid-style-dna/v1"
MODEL_TYPE_ID = "humanoid/chibi-v1"

_REQUIRED_HINTS = (
    "totalHeight",
    "headWidth",
    "headDepth",
    "headHeight",
    "eyeSpacing",
    "eyeZ",
    "torsoWidth",
    "waistWidth",
    "legLength",
)


def _number(hints: dict[str, Any], name: str, minimum: float, maximum: float) -> float:
    value = hints.get(name)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"StyleDNA blenderHints.{name} must be a number")
    result = float(value)
    if not minimum <= result <= maximum:
        raise ValueError(
            f"StyleDNA blenderHints.{name} must be between {minimum} and {maximum}; got {result}"
        )
    return result


def validate_style_dna(document: Any) -> dict[str, Any]:
    if not isinstance(document, dict):
        raise ValueError("StyleDNA document must be a JSON object")
    if document.get("schema") != STYLE_DNA_SCHEMA:
        raise ValueError(f"StyleDNA schema must be {STYLE_DNA_SCHEMA}")
    if document.get("modelTypeId") != MODEL_TYPE_ID:
        raise ValueError(f"StyleDNA modelTypeId must be {MODEL_TYPE_ID}")

    hints = document.get("blenderHints")
    if not isinstance(hints, dict):
        raise ValueError("StyleDNA blenderHints must be an object")
    missing = [name for name in _REQUIRED_HINTS if name not in hints]
    if missing:
        raise ValueError(f"StyleDNA is missing blenderHints: {', '.join(missing)}")

    total_height = _number(hints, "totalHeight", 0.5, 3.0)
    head_height = _number(hints, "headHeight", total_height * 0.20, total_height * 0.60)
    head_width = _number(hints, "headWidth", head_height * 0.55, head_height * 1.45)
    head_depth = _number(hints, "headDepth", head_height * 0.45, head_height * 1.35)
    eye_spacing = _number(hints, "eyeSpacing", head_width * 0.15, head_width * 0.75)
    eye_z = _number(hints, "eyeZ", total_height - head_height, total_height)
    torso_width = _number(hints, "torsoWidth", head_width * 0.35, head_width * 1.10)
    waist_width = _number(hints, "waistWidth", torso_width * 0.55, torso_width * 1.10)
    leg_length = _number(hints, "legLength", total_height * 0.12, total_height * 0.48)

    normalized = dict(document)
    normalized["blenderHints"] = {
        **hints,
        "totalHeight": total_height,
        "headWidth": head_width,
        "headDepth": head_depth,
        "headHeight": head_height,
        "eyeSpacing": eye_spacing,
        "eyeZ": eye_z,
        "torsoWidth": torso_width,
        "waistWidth": waist_width,
        "legLength": leg_length,
    }
    return normalized


def dna_from_style_document(document: Any) -> tuple[LittleGuyDNA, dict[str, Any]]:
    normalized = validate_style_dna(document)
    hints = normalized["blenderHints"]
    total_height = hints["totalHeight"]
    head_height = hints["headHeight"]
    head_width = hints["headWidth"]
    torso_width = hints["torsoWidth"]

    dna = replace(
        LittleGuyDNA(),
        H=total_height,
        head_height_ratio=head_height / total_height,
        head_width_as_head_height=head_width / head_height,
        head_depth_ratio=hints["headDepth"] / total_height,
        eye_center_from_top_ratio=(total_height - hints["eyeZ"]) / total_height,
        eye_spacing_ratio=hints["eyeSpacing"] / head_height,
        shoulder_width_ratio=(torso_width / 0.68) / head_height,
        waist_width_ratio=hints["waistWidth"] / head_height,
        waist_from_top_ratio=1 - ((hints["legLength"] + 0.08) / total_height),
    )
    return dna, normalized


def load_style_dna(path: str | Path) -> tuple[LittleGuyDNA, dict[str, Any]]:
    source = Path(path)
    if not source.is_file():
        raise ValueError(f"StyleDNA file does not exist: {source}")
    try:
        document = json.loads(source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"StyleDNA file is not valid JSON: {error}") from error
    return dna_from_style_document(document)


def generation_metadata(dna: LittleGuyDNA, style_document: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "schema": "humanoid-generation-metadata/v1",
        "modelTypeId": MODEL_TYPE_ID,
        "styleDnaSchema": style_document.get("schema") if style_document else "little-guy-preset/v1",
        "source": style_document.get("source") if style_document else "packages/configs/presets/little_guy_style.json",
        "resolvedDna": asdict(dna),
        "measurements": {
            "totalHeight": dna.H,
            "headHeight": dna.head_height,
            "headWidth": dna.head_width,
            "headDepth": dna.head_depth,
            "torsoWidth": dna.torso_width,
            "waistZ": dna.waist_z,
            "legLength": dna.leg_length,
        },
    }
