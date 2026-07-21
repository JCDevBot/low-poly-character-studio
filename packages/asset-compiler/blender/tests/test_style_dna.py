#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BLENDER_DIR = ROOT / "asset-compiler" / "blender"
sys.path.insert(0, str(BLENDER_DIR))

from generator.style_dna import dna_from_style_document, generation_metadata, load_style_dna

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def main() -> None:
    compact, compact_document = load_style_dna(FIXTURES / "style_dna_compact.json")
    tall, tall_document = load_style_dna(FIXTURES / "style_dna_tall.json")

    assert compact.H != tall.H
    assert compact.head_width != tall.head_width
    assert compact.torso_width != tall.torso_width
    assert compact.leg_length != tall.leg_length
    assert compact.head_width > tall.head_width
    assert tall.leg_length > compact.leg_length

    metadata = generation_metadata(compact, compact_document)
    assert metadata["modelTypeId"] == "humanoid/chibi-v1"
    assert metadata["styleDnaSchema"] == "humanoid-style-dna/v1"
    assert metadata["measurements"]["headWidth"] == compact.head_width

    invalid = json.loads((FIXTURES / "style_dna_compact.json").read_text())
    invalid["blenderHints"].pop("headWidth")
    try:
        dna_from_style_document(invalid)
    except ValueError as error:
        assert "headWidth" in str(error)
    else:
        raise AssertionError("missing headWidth should fail validation")

    invalid_schema = dict(tall_document)
    invalid_schema["schema"] = "unknown/v1"
    try:
        dna_from_style_document(invalid_schema)
    except ValueError as error:
        assert "humanoid-style-dna/v1" in str(error)
    else:
        raise AssertionError("unknown schema should fail validation")

    preset_metadata = generation_metadata(compact, None)
    assert preset_metadata["styleDnaSchema"] == "little-guy-preset/v1"

    print("humanoid StyleDNA contract tests passed")


if __name__ == "__main__":
    main()
