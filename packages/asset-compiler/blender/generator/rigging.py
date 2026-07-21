"""Blender armature creation and deterministic low-poly skinning for humanoid-basic-v1."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import bpy
from mathutils import Matrix

from .rig_contract import RIG_ID, Joint, build_joint_spec, validate_joint_spec

RIG_METADATA_SCHEMA = "humanoid-rig-metadata/v1"

RIGID_PART_BONES = {
    "Body_Head": "head",
    "Face_LeftEye": "head",
    "Face_RightEye": "head",
    "Body_LeftEar": "head",
    "Body_RightEar": "head",
    "Body_Neck": "neck",
    "Body_Torso": "chest",
    "Clothing_AFrameShirt": "chest",
    "Clothing_Boxers": "hips",
    "Body_LeftUpperArm": "upper_arm.L",
    "Body_RightUpperArm": "upper_arm.R",
    "Body_LeftForearm": "forearm.L",
    "Body_RightForearm": "forearm.R",
    "Body_LeftHand": "hand.L",
    "Body_RightHand": "hand.R",
    "Body_LeftFoot": "foot.L",
    "Body_RightFoot": "foot.R",
}

LEG_PART_BONES = {
    "Body_LeftLeg": ("thigh.L", "shin.L"),
    "Body_RightLeg": ("thigh.R", "shin.R"),
}

SMOKE_POSES = {
    "shoulder": {"upper_arm.L": (0.0, 0.0, 0.35), "upper_arm.R": (0.0, 0.0, -0.35)},
    "elbow": {"forearm.L": (0.45, 0.0, 0.0), "forearm.R": (0.45, 0.0, 0.0)},
    "hip": {"thigh.L": (0.25, 0.0, 0.0), "thigh.R": (-0.25, 0.0, 0.0)},
    "knee": {"shin.L": (-0.45, 0.0, 0.0), "shin.R": (-0.45, 0.0, 0.0)},
}


def _create_armature(joints: Iterable[Joint]) -> bpy.types.Object:
    joints = tuple(joints)
    validate_joint_spec(joints)
    armature_data = bpy.data.armatures.new(RIG_ID)
    armature = bpy.data.objects.new(RIG_ID, armature_data)
    bpy.context.collection.objects.link(armature)
    armature.show_in_front = True
    armature["rigId"] = RIG_ID

    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = {}
    for joint in joints:
        bone = armature_data.edit_bones.new(joint.name)
        bone.head = joint.head
        bone.tail = joint.tail
        bone.use_deform = joint.deform
        edit_bones[joint.name] = bone
    for joint in joints:
        if joint.parent:
            edit_bones[joint.name].parent = edit_bones[joint.parent]
            edit_bones[joint.name].use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    armature.select_set(False)
    return armature


def _clear_groups(mesh: bpy.types.Object) -> None:
    for group in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(group)


def _bind_rigid(mesh: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    _clear_groups(mesh)
    group = mesh.vertex_groups.new(name=bone_name)
    group.add([vertex.index for vertex in mesh.data.vertices], 1.0, "REPLACE")
    modifier = mesh.modifiers.new(name=RIG_ID, type="ARMATURE")
    modifier.object = armature


def _bind_leg(
    mesh: bpy.types.Object,
    armature: bpy.types.Object,
    upper_bone: str,
    lower_bone: str,
    knee_z: float,
) -> None:
    _clear_groups(mesh)
    upper = mesh.vertex_groups.new(name=upper_bone)
    lower = mesh.vertex_groups.new(name=lower_bone)
    blend_half_width = max(0.015, mesh.dimensions.z * 0.08)
    inverse = mesh.matrix_world.inverted()
    for vertex in mesh.data.vertices:
        world_z = (mesh.matrix_world @ vertex.co).z
        if world_z >= knee_z + blend_half_width:
            upper_weight = 1.0
        elif world_z <= knee_z - blend_half_width:
            upper_weight = 0.0
        else:
            upper_weight = (world_z - (knee_z - blend_half_width)) / (blend_half_width * 2)
        lower_weight = 1.0 - upper_weight
        if upper_weight > 0:
            upper.add([vertex.index], upper_weight, "REPLACE")
        if lower_weight > 0:
            lower.add([vertex.index], lower_weight, "REPLACE")
    # Keep the object transform stable when the armature modifier is evaluated.
    mesh.matrix_world = Matrix(inverse.inverted())
    modifier = mesh.modifiers.new(name=RIG_ID, type="ARMATURE")
    modifier.object = armature


def validate_skinning(meshes: Iterable[bpy.types.Object], armature: bpy.types.Object) -> dict:
    valid_bones = {bone.name for bone in armature.data.bones if bone.use_deform}
    weighted_vertices = 0
    for mesh in meshes:
        if mesh.type != "MESH":
            continue
        modifiers = [modifier for modifier in mesh.modifiers if modifier.type == "ARMATURE" and modifier.object == armature]
        if len(modifiers) != 1:
            raise ValueError(f"{mesh.name} must have exactly one {RIG_ID} armature modifier")
        for vertex in mesh.data.vertices:
            total = 0.0
            for membership in vertex.groups:
                group = mesh.vertex_groups[membership.group]
                if group.name not in valid_bones:
                    raise ValueError(f"{mesh.name} vertex {vertex.index} references invalid deform joint {group.name}")
                total += membership.weight
            if abs(total - 1.0) > 1e-5:
                raise ValueError(f"{mesh.name} vertex {vertex.index} weights sum to {total}, expected 1.0")
            weighted_vertices += 1
    if weighted_vertices == 0:
        raise ValueError("Rig contains no weighted mesh vertices")
    return {"meshCount": len(tuple(meshes)), "weightedVertexCount": weighted_vertices}


def apply_humanoid_rig(root: bpy.types.Object, dna) -> tuple[bpy.types.Object, dict]:
    joints = build_joint_spec(dna)
    armature = _create_armature(joints)
    armature.parent = root
    meshes = [child for child in root.children if child.type == "MESH"]
    by_name = {joint.name: joint for joint in joints}

    missing = sorted((set(RIGID_PART_BONES) | set(LEG_PART_BONES)) - {mesh.name for mesh in meshes})
    if missing:
        raise ValueError(f"Generated humanoid is missing riggable mesh parts: {', '.join(missing)}")

    for mesh in meshes:
        if mesh.name in RIGID_PART_BONES:
            _bind_rigid(mesh, armature, RIGID_PART_BONES[mesh.name])
        elif mesh.name in LEG_PART_BONES:
            upper, lower = LEG_PART_BONES[mesh.name]
            _bind_leg(mesh, armature, upper, lower, by_name[lower].head[2])
        else:
            raise ValueError(f"No deterministic skinning rule for generated mesh {mesh.name}")

    validation = validate_skinning(meshes, armature)
    metadata = {
        "schema": RIG_METADATA_SCHEMA,
        "rigId": RIG_ID,
        "jointCount": len(joints),
        "deformJointCount": sum(1 for joint in joints if joint.deform),
        "joints": [
            {
                "name": joint.name,
                "parent": joint.parent,
                "deform": joint.deform,
                "head": list(joint.head),
                "tail": list(joint.tail),
            }
            for joint in joints
        ],
        "skinning": validation,
        "smokePoses": SMOKE_POSES,
    }
    armature["rigMetadata"] = json.dumps(metadata, sort_keys=True)
    return armature, metadata


def write_rig_metadata(path: str | Path, metadata: dict) -> None:
    Path(path).write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
