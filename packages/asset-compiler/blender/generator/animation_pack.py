"""Deterministic basic animation pack for humanoid-basic-v1."""

from __future__ import annotations

from dataclasses import dataclass
from math import radians
from typing import Mapping

from .rig_contract import JOINT_PARENTS, RIG_ID

ANIMATION_PACK_ID = "humanoid-basic-v1/default-v1"
ANIMATION_METADATA_SCHEMA = "humanoid-animation-pack/v1"
FPS = 24


@dataclass(frozen=True)
class KeyPose:
    frame: int
    rotations: Mapping[str, tuple[float, float, float]]


@dataclass(frozen=True)
class ClipSpec:
    name: str
    start: int
    end: int
    loop: bool
    root_motion: bool
    key_poses: tuple[KeyPose, ...]


CLIPS = (
    ClipSpec(
        "a-pose",
        1,
        1,
        False,
        False,
        (
            KeyPose(
                1,
                {
                    "shoulder.L": (0.0, radians(-8), radians(-8)),
                    "upper_arm.L": (0.0, radians(-10), radians(-28)),
                    "shoulder.R": (0.0, radians(8), radians(8)),
                    "upper_arm.R": (0.0, radians(10), radians(28)),
                },
            ),
        ),
    ),
    ClipSpec(
        "idle",
        1,
        49,
        True,
        False,
        (
            KeyPose(1, {"hips": (0.0, 0.0, radians(-1.5)), "chest": (0.0, 0.0, radians(1.0))}),
            KeyPose(25, {"hips": (0.0, 0.0, radians(1.5)), "chest": (0.0, 0.0, radians(-1.0))}),
            KeyPose(49, {"hips": (0.0, 0.0, radians(-1.5)), "chest": (0.0, 0.0, radians(1.0))}),
        ),
    ),
    ClipSpec(
        "walk",
        1,
        25,
        True,
        False,
        (
            KeyPose(1, {"thigh.L": (radians(24), 0.0, 0.0), "thigh.R": (radians(-24), 0.0, 0.0), "shin.L": (0.0, 0.0, 0.0), "shin.R": (0.0, 0.0, 0.0), "upper_arm.L": (radians(-16), 0.0, 0.0), "upper_arm.R": (radians(16), 0.0, 0.0)}),
            KeyPose(7, {"thigh.L": (0.0, 0.0, 0.0), "thigh.R": (0.0, 0.0, 0.0), "shin.L": (radians(18), 0.0, 0.0), "shin.R": (radians(6), 0.0, 0.0)}),
            KeyPose(13, {"thigh.L": (radians(-24), 0.0, 0.0), "thigh.R": (radians(24), 0.0, 0.0), "shin.L": (0.0, 0.0, 0.0), "shin.R": (0.0, 0.0, 0.0), "upper_arm.L": (radians(16), 0.0, 0.0), "upper_arm.R": (radians(-16), 0.0, 0.0)}),
            KeyPose(19, {"thigh.L": (0.0, 0.0, 0.0), "thigh.R": (0.0, 0.0, 0.0), "shin.L": (radians(6), 0.0, 0.0), "shin.R": (radians(18), 0.0, 0.0)}),
            KeyPose(25, {"thigh.L": (radians(24), 0.0, 0.0), "thigh.R": (radians(-24), 0.0, 0.0), "shin.L": (0.0, 0.0, 0.0), "shin.R": (0.0, 0.0, 0.0), "upper_arm.L": (radians(-16), 0.0, 0.0), "upper_arm.R": (radians(16), 0.0, 0.0)}),
        ),
    ),
    ClipSpec(
        "wave",
        1,
        49,
        False,
        False,
        (
            KeyPose(1, {"shoulder.R": (0.0, 0.0, radians(12)), "upper_arm.R": (0.0, 0.0, radians(55)), "forearm.R": (radians(-80), 0.0, 0.0), "hand.R": (0.0, radians(12), 0.0)}),
            KeyPose(13, {"hand.R": (0.0, radians(-24), 0.0)}),
            KeyPose(25, {"hand.R": (0.0, radians(24), 0.0)}),
            KeyPose(37, {"hand.R": (0.0, radians(-24), 0.0)}),
            KeyPose(49, {"hand.R": (0.0, radians(12), 0.0)}),
        ),
    ),
)


def validate_animation_pack() -> None:
    names = [clip.name for clip in CLIPS]
    if names != ["a-pose", "idle", "walk", "wave"]:
        raise ValueError(f"Unexpected animation clips: {names}")
    valid_joints = set(JOINT_PARENTS)
    for clip in CLIPS:
        if clip.start > clip.end:
            raise ValueError(f"Clip {clip.name} has an invalid frame range")
        if clip.root_motion:
            raise ValueError(f"MVP clip {clip.name} must be in-place")
        frames = [pose.frame for pose in clip.key_poses]
        if frames != sorted(frames) or frames[0] < clip.start or frames[-1] > clip.end:
            raise ValueError(f"Clip {clip.name} keyframes fall outside its range")
        unknown = sorted({joint for pose in clip.key_poses for joint in pose.rotations} - valid_joints)
        if unknown:
            raise ValueError(f"Clip {clip.name} references unknown joints: {unknown}")
        if clip.loop and clip.key_poses[0].rotations != clip.key_poses[-1].rotations:
            raise ValueError(f"Looping clip {clip.name} must repeat its first pose at the final frame")


def animation_metadata() -> dict:
    validate_animation_pack()
    return {
        "schema": ANIMATION_METADATA_SCHEMA,
        "packId": ANIMATION_PACK_ID,
        "rigId": RIG_ID,
        "fps": FPS,
        "clips": [
            {
                "name": clip.name,
                "startFrame": clip.start,
                "endFrame": clip.end,
                "durationSeconds": (clip.end - clip.start) / FPS,
                "loop": clip.loop,
                "rootMotion": clip.root_motion,
                "targetJoints": sorted({joint for pose in clip.key_poses for joint in pose.rotations}),
            }
            for clip in CLIPS
        ],
    }


def apply_animation_pack(armature) -> dict:
    """Create Blender actions on an existing humanoid-basic-v1 armature."""
    import bpy

    validate_animation_pack()
    if armature.type != "ARMATURE":
        raise ValueError("Animation target must be an armature")
    missing = sorted(set(JOINT_PARENTS) - set(armature.pose.bones.keys()))
    if missing:
        raise ValueError(f"Animation target is missing joints: {missing}")

    if armature.animation_data is None:
        armature.animation_data_create()

    for clip in CLIPS:
        previous = bpy.data.actions.get(clip.name)
        if previous is not None:
            bpy.data.actions.remove(previous)
        action = bpy.data.actions.new(clip.name)
        action.use_fake_user = True
        action["animationPackId"] = ANIMATION_PACK_ID
        action["loop"] = clip.loop
        action["rootMotion"] = clip.root_motion
        action["fps"] = FPS
        armature.animation_data.action = action

        current_rotations = {bone.name: (0.0, 0.0, 0.0) for bone in armature.pose.bones}
        for bone in armature.pose.bones:
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = current_rotations[bone.name]
        for pose in clip.key_poses:
            current_rotations.update(pose.rotations)
            for bone in armature.pose.bones:
                bone.rotation_euler = current_rotations[bone.name]
                bone.keyframe_insert("rotation_euler", frame=pose.frame, group=bone.name)

    armature.animation_data.action = None
    armature["animationPackId"] = ANIMATION_PACK_ID
    armature["animationMetadataSchema"] = ANIMATION_METADATA_SCHEMA
    return animation_metadata()
