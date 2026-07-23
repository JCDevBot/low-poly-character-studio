#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BLENDER_DIR = ROOT / "asset-compiler" / "blender"
sys.path.insert(0, str(BLENDER_DIR))

from generator.body_topology import (
    TOPOLOGY_SCHEMA,
    build_body_graph,
    candidate_bones_for_point,
    normalized_weights_for_point,
    resolve_body_landmarks,
    validate_body_graph,
)
from generator.character_dna import LittleGuyDNA
from generator.rig_contract import JOINT_PARENTS, RIG_ID, build_joint_spec, validate_joint_spec


def assert_blend(weights: dict[str, float], expected: set[str]) -> None:
    assert expected.issubset(weights), (weights, expected)
    assert abs(sum(weights.values()) - 1.0) < 1e-9
    assert all(weight > 0 for weight in weights.values())


def main() -> None:
    compact = LittleGuyDNA(H=1.30)
    tall = LittleGuyDNA(H=1.65)
    compact_joints = build_joint_spec(compact)
    tall_joints = build_joint_spec(tall)

    assert RIG_ID == "humanoid-basic-v1"
    assert TOPOLOGY_SCHEMA == "humanoid-connected-body/v1"
    assert tuple(joint.name for joint in compact_joints) == tuple(JOINT_PARENTS)
    assert compact_joints == build_joint_spec(compact)
    assert compact_joints != tall_joints

    by_name = {joint.name: joint for joint in compact_joints}
    assert by_name["head"].parent == "neck"
    assert by_name["forearm.L"].parent == "upper_arm.L"
    assert by_name["shin.R"].parent == "thigh.R"
    assert by_name["foot.L"].tail[1] < by_name["foot.L"].head[1]

    compact_nodes, compact_edges = build_body_graph(compact)
    tall_nodes, _ = build_body_graph(tall)
    validate_body_graph(compact_nodes, compact_edges)
    assert len(compact_nodes) >= 52
    assert len(compact_edges) == len(compact_nodes) - 1
    assert compact_nodes == build_body_graph(compact)[0]
    assert compact_nodes != tall_nodes
    node_names = {node.name for node in compact_nodes}
    for required in (
        "upper-chest",
        "neck-top",
        "lower-armpit-support.L",
        "lower-armpit-support.R",
        "socket-floor-support.L",
        "socket-floor-support.R",
        "upper-socket-support.L",
        "upper-socket-support.R",
        "elbow-above.L",
        "elbow.L",
        "elbow-below.L",
        "wrist.L",
        "knee-above.L",
        "knee.L",
        "knee-below.L",
        "ankle.L",
        "foot-core.L",
    ):
        assert required in node_names
    assert "armpit-support.L" not in node_names
    assert "toe-tip.L" not in node_names

    nodes_by_name = {node.name: node for node in compact_nodes}
    left_clavicle = nodes_by_name["clavicle.L"]
    lower_support = nodes_by_name["lower-armpit-support.L"]
    floor_support = nodes_by_name["socket-floor-support.L"]
    upper_support = nodes_by_name["upper-socket-support.L"]
    left_shoulder = nodes_by_name["shoulder.L"]
    assert abs(left_clavicle.point[0]) < abs(lower_support.point[0]) < abs(floor_support.point[0]) < abs(upper_support.point[0]) < abs(left_shoulder.point[0])
    assert lower_support.point[2] < floor_support.point[2] < upper_support.point[2] < left_shoulder.point[2]
    assert lower_support.radius[0] > floor_support.radius[0] > upper_support.radius[0] > left_shoulder.radius[0]
    node_index = {node.name: index for index, node in enumerate(compact_nodes)}
    assert (node_index["clavicle.L"], node_index["lower-armpit-support.L"]) in compact_edges
    assert (node_index["lower-armpit-support.L"], node_index["socket-floor-support.L"]) in compact_edges
    assert (node_index["socket-floor-support.L"], node_index["upper-socket-support.L"]) in compact_edges
    assert (node_index["upper-socket-support.L"], node_index["shoulder.L"]) in compact_edges

    marks = resolve_body_landmarks(compact)
    assert compact.head_bottom_z - marks.shoulder_z < compact.head_height * 0.28
    assert marks.neck_top_z - compact.neck_z < compact.head_height * 0.18
    assert compact.foot_width > compact.calf_radius * 3

    assert_blend(normalized_weights_for_point((-marks.elbow_x, 0, marks.elbow_z), compact, by_name), {"upper_arm.L", "forearm.L"})
    assert_blend(normalized_weights_for_point((-marks.hip_x, 0, marks.knee_z), compact, by_name), {"thigh.L", "shin.L"})
    assert_blend(normalized_weights_for_point((-marks.wrist_x, 0, marks.wrist_z), compact, by_name), {"forearm.L", "hand.L"})
    ankle_transition = normalized_weights_for_point((-marks.hip_x, 0, marks.ankle_z + compact.calf_radius * 0.35), compact, by_name)
    assert_blend(ankle_transition, {"shin.L", "foot.L"})
    foot_core_weights = normalized_weights_for_point((-marks.hip_x, -compact.foot_length * 0.16, compact.foot_height * 0.90), compact, by_name)
    assert foot_core_weights == {"foot.L": 1.0}

    neck_weights = normalized_weights_for_point((0, 0, marks.chest_z), compact, by_name)
    assert {"chest", "neck"}.issubset(neck_weights)

    shoulder_point = (-marks.shoulder_x * 0.92, 0, marks.shoulder_z)
    shoulder_candidates = candidate_bones_for_point(shoulder_point, compact)
    assert "chest" in shoulder_candidates
    assert "upper_arm.L" in shoulder_candidates
    shoulder_weights = normalized_weights_for_point(shoulder_point, compact, by_name, max_influences=3)
    assert_blend(shoulder_weights, {"chest", "upper_arm.L"})

    shoulder_x = -(marks.shoulder_x + compact.arm_radius * 0.24)
    lower_armpit = normalized_weights_for_point((shoulder_x, 0, marks.shoulder_z - compact.arm_radius * 1.20), compact, by_name)
    socket_band = normalized_weights_for_point((shoulder_x, 0, marks.shoulder_z - compact.arm_radius * 0.18), compact, by_name)
    upper_cap = normalized_weights_for_point((shoulder_x, 0, marks.shoulder_z + compact.arm_radius * 0.78), compact, by_name)
    for weights in (lower_armpit, socket_band, upper_cap):
        assert_blend(weights, {"chest", "upper_arm.L"})
    assert lower_armpit["chest"] >= 0.70
    assert 0.30 <= socket_band["upper_arm.L"] <= 0.70
    assert upper_cap["upper_arm.L"] >= 0.68
    assert lower_armpit["upper_arm.L"] < socket_band["upper_arm.L"] < upper_cap["upper_arm.L"]

    floor_x = -(marks.shoulder_x - compact.arm_radius * 0.36)
    socket_floor = normalized_weights_for_point((floor_x, 0, marks.shoulder_z - compact.arm_radius * 0.48), compact, by_name)
    upper_socket = normalized_weights_for_point((-(marks.shoulder_x - compact.arm_radius * 0.18), 0, marks.shoulder_z - compact.arm_radius * 0.20), compact, by_name)
    assert_blend(socket_floor, {"chest", "upper_arm.L"})
    assert_blend(upper_socket, {"chest", "upper_arm.L"})
    assert socket_floor["chest"] >= 0.72
    assert socket_floor["upper_arm.L"] <= 0.28
    assert upper_socket["upper_arm.L"] > socket_floor["upper_arm.L"]

    hip_point = (-marks.hip_x, 0, marks.hips_z - compact.thigh_radius * 0.20)
    hip_candidates = candidate_bones_for_point(hip_point, compact)
    assert "hips" in hip_candidates
    assert "thigh.L" in hip_candidates
    hip_weights = normalized_weights_for_point(hip_point, compact, by_name, max_influences=3)
    assert_blend(hip_weights, {"hips", "thigh.L"})

    boxer_waistband = normalized_weights_for_point((-compact.hip_width * 0.45, 0, marks.hips_z + compact.head_height * 0.01), compact, by_name, part_name="Clothing_Boxers")
    assert boxer_waistband == {"hips": 1.0}
    boxer_lower_outer = normalized_weights_for_point((-compact.hip_width * 0.50, 0, marks.hips_z - compact.head_height * 0.11), compact, by_name, part_name="Clothing_Boxers")
    assert_blend(boxer_lower_outer, {"hips", "thigh.L"})
    assert boxer_lower_outer["hips"] >= 0.84
    assert boxer_lower_outer["thigh.L"] <= 0.16
    boxer_center = normalized_weights_for_point((0, 0, marks.hips_z - compact.head_height * 0.11), compact, by_name, part_name="Clothing_Boxers")
    assert boxer_center == {"hips": 1.0}

    invalid = list(compact_joints)
    invalid.pop()
    try:
        validate_joint_spec(invalid)
    except ValueError as error:
        assert "missing" in str(error)
    else:
        raise AssertionError("missing joint should fail validation")

    disconnected_edges = list(compact_edges)
    disconnected_edges[-1] = disconnected_edges[-2]
    try:
        validate_body_graph(compact_nodes, disconnected_edges)
    except ValueError as error:
        assert "connected" in str(error).lower() or "tree" in str(error).lower()
    else:
        raise AssertionError("disconnected body should fail validation")

    print("humanoid rig and connected-body contract tests passed")


if __name__ == "__main__":
    main()
