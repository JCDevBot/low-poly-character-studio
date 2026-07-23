#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BLENDER_DIR = ROOT / "asset-compiler" / "blender"
sys.path.insert(0, str(BLENDER_DIR))

from generator.body_topology import normalized_weights_for_point, resolve_body_landmarks
from generator.character_dna import LittleGuyDNA
from generator.rig_contract import build_joint_spec
from generator.underarm_web_weights import UNDERARM_WEB_WEIGHT_SCHEMA


def main() -> None:
    dna = LittleGuyDNA(H=1.30)
    marks = resolve_body_landmarks(dna)
    joints = {joint.name: joint for joint in build_joint_spec(dna)}
    radius = dna.arm_radius

    assert UNDERARM_WEB_WEIGHT_SCHEMA == "underarm-web-weights/v1"

    samples = {
        "inner": (
            -(marks.shoulder_x - radius * 1.02),
            0.0,
            marks.shoulder_z - radius * 0.80,
        ),
        "mid": (
            -(marks.shoulder_x - radius * 0.62),
            0.0,
            marks.shoulder_z - radius * 0.58,
        ),
        "outer": (
            -(marks.shoulder_x - radius * 0.25),
            0.0,
            marks.shoulder_z - radius * 0.31,
        ),
    }
    weights = {
        name: normalized_weights_for_point(point, dna, joints)
        for name, point in samples.items()
    }

    for result in weights.values():
        assert set(result) == {"chest", "upper_arm.L"}, result
        assert abs(sum(result.values()) - 1.0) < 1e-9

    inner = weights["inner"]["upper_arm.L"]
    mid = weights["mid"]["upper_arm.L"]
    outer = weights["outer"]["upper_arm.L"]
    assert inner <= 0.22, weights
    assert 0.34 <= mid <= 0.58, weights
    assert outer >= 0.62, weights
    assert inner + 0.16 < mid < outer - 0.12, weights

    outside = normalized_weights_for_point(
        (samples["mid"][0], radius * 1.60, samples["mid"][2]),
        dna,
        joints,
    )
    assert outside["upper_arm.L"] < outer

    shirt = normalized_weights_for_point(
        samples["outer"],
        dna,
        joints,
        part_name="Clothing_AFrameShirt",
    )
    assert "upper_arm.L" not in shirt

    print("localized underarm web weight tests passed")


if __name__ == "__main__":
    main()
