"""Versioned humanoid-basic-v1 rig contract and deterministic joint placement."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

RIG_ID = "humanoid-basic-v1"


@dataclass(frozen=True)
class Joint:
    name: str
    parent: str | None
    head: tuple[float, float, float]
    tail: tuple[float, float, float]
    deform: bool = True


JOINT_PARENTS = {
    "root": None,
    "hips": "root",
    "spine": "hips",
    "chest": "spine",
    "neck": "chest",
    "head": "neck",
    "shoulder.L": "chest",
    "upper_arm.L": "shoulder.L",
    "forearm.L": "upper_arm.L",
    "hand.L": "forearm.L",
    "shoulder.R": "chest",
    "upper_arm.R": "shoulder.R",
    "forearm.R": "upper_arm.R",
    "hand.R": "forearm.R",
    "thigh.L": "hips",
    "shin.L": "thigh.L",
    "foot.L": "shin.L",
    "thigh.R": "hips",
    "shin.R": "thigh.R",
    "foot.R": "shin.R",
}


def build_joint_spec(dna) -> tuple[Joint, ...]:
    """Return deterministic joints from resolved humanoid DNA.

    Blender uses Z-up, X left/right, and the character faces negative Y.
    """
    hips_z = dna.waist_z
    chest_z = dna.torso_center_z + dna.torso_height * 0.28
    shoulder_z = dna.torso_center_z + dna.torso_height * 0.38
    neck_z = dna.neck_z
    head_z = dna.head_center_z
    shoulder_x = dna.shoulder_width / 2
    elbow_z = dna.torso_center_z - 0.05
    wrist_z = dna.torso_center_z - 0.25
    hip_x = dna.hip_width * 0.22
    knee_z = max(dna.foot_height + 0.08, hips_z - dna.leg_length * 0.5)
    ankle_z = dna.foot_height

    entries = (
        Joint("root", None, (0, 0, 0), (0, 0, hips_z * 0.35), False),
        Joint("hips", "root", (0, 0, hips_z * 0.35), (0, 0, hips_z)),
        Joint("spine", "hips", (0, 0, hips_z), (0, 0, dna.torso_center_z)),
        Joint("chest", "spine", (0, 0, dna.torso_center_z), (0, 0, chest_z)),
        Joint("neck", "chest", (0, 0, chest_z), (0, 0, neck_z)),
        Joint("head", "neck", (0, 0, neck_z), (0, 0, head_z + dna.head_height * 0.3)),
        Joint("shoulder.L", "chest", (0, 0, shoulder_z), (-shoulder_x, 0, shoulder_z), False),
        Joint("upper_arm.L", "shoulder.L", (-shoulder_x, 0, shoulder_z), (-shoulder_x * 1.08, 0, elbow_z)),
        Joint("forearm.L", "upper_arm.L", (-shoulder_x * 1.08, 0, elbow_z), (-shoulder_x * 1.18, 0, wrist_z)),
        Joint("hand.L", "forearm.L", (-shoulder_x * 1.18, 0, wrist_z), (-shoulder_x * 1.18, -0.01, wrist_z - 0.09)),
        Joint("shoulder.R", "chest", (0, 0, shoulder_z), (shoulder_x, 0, shoulder_z), False),
        Joint("upper_arm.R", "shoulder.R", (shoulder_x, 0, shoulder_z), (shoulder_x * 1.08, 0, elbow_z)),
        Joint("forearm.R", "upper_arm.R", (shoulder_x * 1.08, 0, elbow_z), (shoulder_x * 1.18, 0, wrist_z)),
        Joint("hand.R", "forearm.R", (shoulder_x * 1.18, 0, wrist_z), (shoulder_x * 1.18, -0.01, wrist_z - 0.09)),
        Joint("thigh.L", "hips", (-hip_x, 0, hips_z), (-hip_x, 0, knee_z)),
        Joint("shin.L", "thigh.L", (-hip_x, 0, knee_z), (-hip_x, 0, ankle_z)),
        Joint("foot.L", "shin.L", (-hip_x, 0, ankle_z), (-hip_x, -dna.foot_length * 0.45, ankle_z)),
        Joint("thigh.R", "hips", (hip_x, 0, hips_z), (hip_x, 0, knee_z)),
        Joint("shin.R", "thigh.R", (hip_x, 0, knee_z), (hip_x, 0, ankle_z)),
        Joint("foot.R", "shin.R", (hip_x, 0, ankle_z), (hip_x, -dna.foot_length * 0.45, ankle_z)),
    )
    validate_joint_spec(entries)
    return entries


def validate_joint_spec(joints: Iterable[Joint]) -> None:
    joints = tuple(joints)
    by_name = {joint.name: joint for joint in joints}
    if set(by_name) != set(JOINT_PARENTS):
        missing = sorted(set(JOINT_PARENTS) - set(by_name))
        extra = sorted(set(by_name) - set(JOINT_PARENTS))
        raise ValueError(f"Rig joints do not match {RIG_ID}; missing={missing}, extra={extra}")
    if len(by_name) != len(joints):
        raise ValueError("Rig joint names must be unique")
    for name, expected_parent in JOINT_PARENTS.items():
        joint = by_name[name]
        if joint.parent != expected_parent:
            raise ValueError(f"Joint {name} parent must be {expected_parent}")
        if joint.head == joint.tail:
            raise ValueError(f"Joint {name} must have non-zero length")
        if joint.parent and joint.parent not in by_name:
            raise ValueError(f"Joint {name} references missing parent {joint.parent}")
