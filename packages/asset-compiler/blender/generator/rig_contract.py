"""Versioned humanoid-basic-v1 rig contract and deterministic joint placement."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .body_topology import resolve_body_landmarks

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
    """Return deterministic joints aligned to the connected body graph.

    Blender uses Z-up, X left/right, and the character faces negative Y.
    """
    marks = resolve_body_landmarks(dna)
    hips_base_z = max(dna.foot_height * 1.4, marks.hips_z * 0.40)
    chest_base_z = dna.torso_center_z
    hand_tail_z = marks.hand_tip_z
    foot_tail_y = marks.toe_y

    entries = (
        Joint("root", None, (0, 0, 0), (0, 0, max(0.05, hips_base_z * 0.45)), False),
        Joint("hips", "root", (0, 0, hips_base_z), (0, 0, marks.hips_z)),
        Joint("spine", "hips", (0, 0, marks.hips_z), (0, 0, chest_base_z)),
        Joint("chest", "spine", (0, 0, chest_base_z), (0, 0, marks.chest_z)),
        Joint("neck", "chest", (0, 0, marks.chest_z), (0, 0, marks.neck_top_z)),
        Joint(
            "head",
            "neck",
            (0, 0, marks.neck_top_z),
            (0, 0, dna.head_center_z + dna.head_height * 0.30),
        ),
        Joint("shoulder.L", "chest", (0, 0, marks.shoulder_z), (-marks.shoulder_x, 0, marks.shoulder_z), False),
        Joint(
            "upper_arm.L",
            "shoulder.L",
            (-marks.shoulder_x, 0, marks.shoulder_z),
            (-marks.elbow_x, 0, marks.elbow_z),
        ),
        Joint(
            "forearm.L",
            "upper_arm.L",
            (-marks.elbow_x, 0, marks.elbow_z),
            (-marks.wrist_x, 0, marks.wrist_z),
        ),
        Joint(
            "hand.L",
            "forearm.L",
            (-marks.wrist_x, 0, marks.wrist_z),
            (-marks.wrist_x, -dna.arm_radius * 0.12, hand_tail_z),
        ),
        Joint("shoulder.R", "chest", (0, 0, marks.shoulder_z), (marks.shoulder_x, 0, marks.shoulder_z), False),
        Joint(
            "upper_arm.R",
            "shoulder.R",
            (marks.shoulder_x, 0, marks.shoulder_z),
            (marks.elbow_x, 0, marks.elbow_z),
        ),
        Joint(
            "forearm.R",
            "upper_arm.R",
            (marks.elbow_x, 0, marks.elbow_z),
            (marks.wrist_x, 0, marks.wrist_z),
        ),
        Joint(
            "hand.R",
            "forearm.R",
            (marks.wrist_x, 0, marks.wrist_z),
            (marks.wrist_x, -dna.arm_radius * 0.12, hand_tail_z),
        ),
        Joint("thigh.L", "hips", (-marks.hip_x, 0, marks.hips_z), (-marks.hip_x, 0, marks.knee_z)),
        Joint("shin.L", "thigh.L", (-marks.hip_x, 0, marks.knee_z), (-marks.hip_x, 0, marks.ankle_z)),
        Joint(
            "foot.L",
            "shin.L",
            (-marks.hip_x, 0, marks.ankle_z),
            (-marks.hip_x, foot_tail_y, dna.foot_height * 0.52),
        ),
        Joint("thigh.R", "hips", (marks.hip_x, 0, marks.hips_z), (marks.hip_x, 0, marks.knee_z)),
        Joint("shin.R", "thigh.R", (marks.hip_x, 0, marks.knee_z), (marks.hip_x, 0, marks.ankle_z)),
        Joint(
            "foot.R",
            "shin.R",
            (marks.hip_x, 0, marks.ankle_z),
            (marks.hip_x, foot_tail_y, dna.foot_height * 0.52),
        ),
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
