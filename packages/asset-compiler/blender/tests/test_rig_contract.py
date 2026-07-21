#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BLENDER_DIR = ROOT / "asset-compiler" / "blender"
sys.path.insert(0, str(BLENDER_DIR))

from generator.character_dna import LittleGuyDNA
from generator.rig_contract import JOINT_PARENTS, RIG_ID, build_joint_spec, validate_joint_spec


def main() -> None:
    compact = LittleGuyDNA(H=1.30)
    tall = LittleGuyDNA(H=1.65)
    compact_joints = build_joint_spec(compact)
    tall_joints = build_joint_spec(tall)

    assert RIG_ID == "humanoid-basic-v1"
    assert tuple(joint.name for joint in compact_joints) == tuple(JOINT_PARENTS)
    assert compact_joints == build_joint_spec(compact)
    assert compact_joints != tall_joints

    by_name = {joint.name: joint for joint in compact_joints}
    assert by_name["head"].parent == "neck"
    assert by_name["forearm.L"].parent == "upper_arm.L"
    assert by_name["shin.R"].parent == "thigh.R"
    assert by_name["foot.L"].tail[1] < by_name["foot.L"].head[1]

    invalid = list(compact_joints)
    invalid.pop()
    try:
        validate_joint_spec(invalid)
    except ValueError as error:
        assert "missing" in str(error)
    else:
        raise AssertionError("missing joint should fail validation")

    print("humanoid rig contract tests passed")


if __name__ == "__main__":
    main()
