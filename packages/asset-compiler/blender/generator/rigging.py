"""Blender armature creation and deterministic low-poly skinning for humanoid-basic-v1."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import bpy

from .body_topology import TOPOLOGY_SCHEMA, normalized_weights_for_point
from .rig_contract import RIG_ID, Joint, build_joint_spec, validate_joint_spec

RIG_METADATA_SCHEMA = "humanoid-rig-metadata/v1"
TARGET_BODY_TRIANGLES = 2200
MAX_BODY_TRIANGLES = 2800

RIGID_PART_BONES = {
    "Body_Head": "head",
    "Hair_Cap": "head",
    "Face_LeftEye": "head",
    "Face_RightEye": "head",
    "Face_Nose": "head",
    "Face_Mouth": "head",
    "Body_LeftEar": "head",
    "Body_RightEar": "head",
    "Body_LeftFoot": "foot.L",
    "Body_RightFoot": "foot.R",
}

DEFORMING_PARTS = {
    "Body_Core",
    "Clothing_AFrameShirt",
    "Clothing_Boxers",
}

SMOKE_POSES = {
    "shoulder": {"upper_arm.L": (0.0, 0.0, 0.35), "upper_arm.R": (0.0, 0.0, -0.35)},
    "elbow": {"forearm.L": (0.45, 0.0, 0.0), "forearm.R": (0.45, 0.0, 0.0)},
    "wrist": {"hand.L": (0.0, 0.30, 0.0), "hand.R": (0.0, -0.30, 0.0)},
    "hip": {"thigh.L": (0.25, 0.0, 0.0), "thigh.R": (-0.25, 0.0, 0.0)},
    "knee": {"shin.L": (-0.45, 0.0, 0.0), "shin.R": (-0.45, 0.0, 0.0)},
    "ankle": {"foot.L": (0.25, 0.0, 0.0), "foot.R": (0.25, 0.0, 0.0)},
    "neck": {"neck": (0.0, 0.0, 0.20), "head": (0.0, 0.0, 0.12)},
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


def _activate(mesh: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh


def _apply_modifier(mesh: bpy.types.Object, modifier: bpy.types.Modifier) -> None:
    _activate(mesh)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def _triangle_count(mesh: bpy.types.Object) -> int:
    return sum(max(0, len(polygon.vertices) - 2) for polygon in mesh.data.polygons)


def _clear_groups(mesh: bpy.types.Object) -> None:
    for group in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(group)


def _add_armature_modifier(mesh: bpy.types.Object, armature: bpy.types.Object) -> None:
    modifier = mesh.modifiers.new(name=RIG_ID, type="ARMATURE")
    modifier.object = armature
    modifier.use_deform_preserve_volume = True


def _bind_rigid(mesh: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    _clear_groups(mesh)
    group = mesh.vertex_groups.new(name=bone_name)
    group.add([vertex.index for vertex in mesh.data.vertices], 1.0, "REPLACE")
    _add_armature_modifier(mesh, armature)


def _bind_deforming(
    mesh: bpy.types.Object,
    armature: bpy.types.Object,
    dna,
    joints: dict[str, Joint],
) -> None:
    _clear_groups(mesh)
    groups: dict[str, bpy.types.VertexGroup] = {}
    for vertex in mesh.data.vertices:
        world_point = tuple(mesh.matrix_world @ vertex.co)
        weights = normalized_weights_for_point(
            world_point,
            dna,
            joints,
            part_name=mesh.name,
            max_influences=3,
        )
        for bone_name, weight in weights.items():
            group = groups.get(bone_name)
            if group is None:
                group = mesh.vertex_groups.new(name=bone_name)
                groups[bone_name] = group
            group.add([vertex.index], weight, "REPLACE")
    _add_armature_modifier(mesh, armature)


def _parent_to_armature(mesh: bpy.types.Object, armature: bpy.types.Object) -> None:
    """Use the glTF-compatible armature hierarchy without changing world placement."""
    world_matrix = mesh.matrix_world.copy()
    mesh.parent = armature
    mesh.parent_type = "OBJECT"
    mesh.matrix_world = world_matrix


def _mesh_component_count(mesh: bpy.types.Object) -> int:
    vertex_count = len(mesh.data.vertices)
    if vertex_count == 0:
        return 0
    adjacency = {index: set() for index in range(vertex_count)}
    for edge in mesh.data.edges:
        a, b = edge.vertices
        adjacency[a].add(b)
        adjacency[b].add(a)
    unvisited = set(adjacency)
    components = 0
    while unvisited:
        components += 1
        pending = [unvisited.pop()]
        while pending:
            current = pending.pop()
            for neighbor in adjacency[current]:
                if neighbor in unvisited:
                    unvisited.remove(neighbor)
                    pending.append(neighbor)
    return components


def _enforce_body_triangle_budget(mesh: bpy.types.Object) -> None:
    initial_count = _triangle_count(mesh)
    mesh["preRigReductionTriangleCount"] = initial_count
    mesh["targetTriangleCount"] = TARGET_BODY_TRIANGLES

    if initial_count > MAX_BODY_TRIANGLES:
        decimate = mesh.modifiers.new("rig_low_poly_triangle_budget", "DECIMATE")
        decimate.decimate_type = "COLLAPSE"
        decimate.ratio = max(0.05, min(1.0, TARGET_BODY_TRIANGLES / initial_count))
        _apply_modifier(mesh, decimate)

    final_count = _triangle_count(mesh)
    component_count = _mesh_component_count(mesh)
    if component_count != 1:
        raise ValueError(
            "Body_Core lost connected topology while enforcing the rig triangle budget; "
            f"found {component_count} components"
        )
    if final_count > MAX_BODY_TRIANGLES:
        raise ValueError(
            f"Body_Core has {final_count} triangles after reduction; maximum is {MAX_BODY_TRIANGLES}"
        )

    mesh["postRigReductionTriangleCount"] = final_count
    mesh["triangleCount"] = final_count


def _validate_connected_body(mesh: bpy.types.Object) -> dict:
    if mesh.get("topologySchema") != TOPOLOGY_SCHEMA:
        raise ValueError(f"Body_Core topologySchema must be {TOPOLOGY_SCHEMA}")
    component_count = _mesh_component_count(mesh)
    if component_count != 1:
        raise ValueError(f"Body_Core must be one connected mesh component; found {component_count}")
    triangle_count = _triangle_count(mesh)
    if triangle_count < 400:
        raise ValueError(
            f"Body_Core has only {triangle_count} triangles; joint-support topology was not generated"
        )
    if triangle_count > MAX_BODY_TRIANGLES:
        raise ValueError(
            f"Body_Core has {triangle_count} triangles; maximum is {MAX_BODY_TRIANGLES}"
        )
    return {
        "schema": mesh.get("topologySchema"),
        "componentCount": component_count,
        "triangleCount": triangle_count,
        "vertexCount": len(mesh.data.vertices),
        "preFusionComponentCount": mesh.get("preFusionComponentCount"),
        "fusionMethod": mesh.get("fusionMethod"),
        "fusionVoxelSize": mesh.get("fusionVoxelSize"),
        "fusionAttemptCount": mesh.get("fusionAttemptCount"),
        "finalComponentCount": mesh.get("finalComponentCount"),
        "preRigReductionTriangleCount": mesh.get("preRigReductionTriangleCount"),
        "targetTriangleCount": mesh.get("targetTriangleCount"),
        "postRigReductionTriangleCount": mesh.get("postRigReductionTriangleCount"),
    }


def validate_skinning(meshes: Iterable[bpy.types.Object], armature: bpy.types.Object) -> dict:
    meshes = tuple(meshes)
    valid_bones = {bone.name for bone in armature.data.bones if bone.use_deform}
    weighted_vertices = 0
    maximum_influences = 0
    parented_meshes = 0
    for mesh in meshes:
        if mesh.type != "MESH":
            continue
        if mesh.parent != armature:
            raise ValueError(f"{mesh.name} must be parented to {RIG_ID} for glTF skin export")
        parented_meshes += 1
        modifiers = [
            modifier
            for modifier in mesh.modifiers
            if modifier.type == "ARMATURE" and modifier.object == armature
        ]
        if len(modifiers) != 1:
            raise ValueError(f"{mesh.name} must have exactly one {RIG_ID} armature modifier")
        for vertex in mesh.data.vertices:
            total = 0.0
            influence_count = 0
            for membership in vertex.groups:
                group = mesh.vertex_groups[membership.group]
                if group.name not in valid_bones:
                    raise ValueError(
                        f"{mesh.name} vertex {vertex.index} references invalid deform joint {group.name}"
                    )
                total += membership.weight
                if membership.weight > 1e-6:
                    influence_count += 1
            if abs(total - 1.0) > 1e-5:
                raise ValueError(
                    f"{mesh.name} vertex {vertex.index} weights sum to {total}, expected 1.0"
                )
            maximum_influences = max(maximum_influences, influence_count)
            weighted_vertices += 1
    if weighted_vertices == 0:
        raise ValueError("Rig contains no weighted mesh vertices")
    return {
        "meshCount": len(meshes),
        "parentedMeshCount": parented_meshes,
        "weightedVertexCount": weighted_vertices,
        "maximumInfluencesPerVertex": maximum_influences,
    }


def apply_humanoid_rig(root: bpy.types.Object, dna) -> tuple[bpy.types.Object, dict]:
    joints = build_joint_spec(dna)
    joints_by_name = {joint.name: joint for joint in joints}
    armature = _create_armature(joints)
    armature.parent = root
    meshes = [child for child in root.children if child.type == "MESH"]

    expected = set(RIGID_PART_BONES) | DEFORMING_PARTS
    names = {mesh.name for mesh in meshes}
    missing = sorted(expected - names)
    unknown = sorted(names - expected)
    if missing:
        raise ValueError(f"Generated humanoid is missing riggable mesh parts: {', '.join(missing)}")
    if unknown:
        raise ValueError(f"No deterministic skinning rule for generated meshes: {', '.join(unknown)}")

    body_mesh = next(mesh for mesh in meshes if mesh.name == "Body_Core")
    _enforce_body_triangle_budget(body_mesh)
    body_topology = _validate_connected_body(body_mesh)

    for mesh in meshes:
        if mesh.name in RIGID_PART_BONES:
            _bind_rigid(mesh, armature, RIGID_PART_BONES[mesh.name])
        else:
            _bind_deforming(mesh, armature, dna, joints_by_name)
        _parent_to_armature(mesh, armature)

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
        "bodyTopology": body_topology,
        "skinning": validation,
        "smokePoses": SMOKE_POSES,
    }
    armature["rigMetadata"] = json.dumps(metadata, sort_keys=True)
    return armature, metadata


def write_rig_metadata(path: str | Path, metadata: dict) -> None:
    Path(path).write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
