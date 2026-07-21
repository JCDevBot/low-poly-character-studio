"""Pure deterministic connected-body graph and skin-weight helpers."""

from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Iterable, Mapping

TOPOLOGY_SCHEMA = "humanoid-connected-body/v1"


@dataclass(frozen=True)
class BodyLandmarks:
    hips_z: float
    chest_z: float
    shoulder_z: float
    neck_top_z: float
    shoulder_x: float
    elbow_x: float
    elbow_z: float
    wrist_x: float
    wrist_z: float
    hand_tip_z: float
    hip_x: float
    knee_z: float
    ankle_z: float
    toe_y: float


@dataclass(frozen=True)
class BodyNode:
    name: str
    point: tuple[float, float, float]
    radius: tuple[float, float]


def resolve_body_landmarks(dna) -> BodyLandmarks:
    shoulder_z = dna.neck_z - max(0.035, dna.torso_height * 0.18)
    shoulder_x = max(dna.torso_width * 0.52, dna.shoulder_width * 0.48)
    elbow_z = shoulder_z - dna.arm_length * 0.48
    wrist_z = shoulder_z - dna.arm_length * 0.90
    arm_out = dna.arm_radius * 0.55
    hip_x = dna.hip_width * 0.22
    knee_z = max(dna.foot_height * 2.15, dna.waist_z - dna.leg_length * 0.52)
    ankle_z = dna.foot_height * 1.05
    return BodyLandmarks(
        hips_z=dna.waist_z,
        chest_z=shoulder_z,
        shoulder_z=shoulder_z,
        neck_top_z=dna.head_bottom_z + dna.head_height * 0.08,
        shoulder_x=shoulder_x,
        elbow_x=shoulder_x + arm_out * 0.55,
        elbow_z=elbow_z,
        wrist_x=shoulder_x + arm_out,
        wrist_z=wrist_z,
        hand_tip_z=wrist_z - max(dna.arm_radius * 2.3, dna.head_height * 0.10),
        hip_x=hip_x,
        knee_z=knee_z,
        ankle_z=ankle_z,
        toe_y=-dna.foot_length * 0.90,
    )


def build_body_graph(dna) -> tuple[tuple[BodyNode, ...], tuple[tuple[int, int], ...]]:
    """Return a connected, acyclic guide graph for Blender's Skin modifier."""
    marks = resolve_body_landmarks(dna)
    nodes: list[BodyNode] = []
    edges: list[tuple[int, int]] = []
    by_name: dict[str, int] = {}

    def add(name: str, point, radius, parent: str | None = None) -> None:
        if name in by_name:
            raise ValueError(f"Duplicate body graph node {name}")
        index = len(nodes)
        nodes.append(BodyNode(name, tuple(float(v) for v in point), tuple(float(v) for v in radius)))
        by_name[name] = index
        if parent is not None:
            edges.append((by_name[parent], index))

    torso_depth_radius = max(dna.torso_depth * 0.47, dna.arm_radius * 1.20)
    add("hips", (0, 0, marks.hips_z), (dna.hip_width * 0.48, torso_depth_radius))
    add(
        "waist",
        (0, 0, marks.hips_z + dna.torso_height * 0.17),
        (dna.torso_width * 0.45, dna.torso_depth * 0.46),
        "hips",
    )
    add(
        "belly",
        (0, -dna.torso_depth * 0.025, dna.torso_center_z),
        (dna.torso_width * 0.50, dna.torso_depth * 0.50),
        "waist",
    )
    add(
        "chest",
        (0, 0, marks.chest_z),
        (dna.torso_width * 0.54, dna.torso_depth * 0.50),
        "belly",
    )
    neck_radius = max(dna.arm_radius * 0.80, dna.head_width * 0.075)
    add(
        "neck-base",
        (0, 0, dna.neck_z - dna.head_height * 0.035),
        (neck_radius * 1.05, neck_radius),
        "chest",
    )
    add(
        "neck-top",
        (0, 0, marks.neck_top_z),
        (neck_radius, neck_radius * 0.94),
        "neck-base",
    )

    arm_band = max(dna.arm_radius * 0.72, dna.arm_length * 0.035)
    hand_length = marks.wrist_z - marks.hand_tip_z
    for suffix, sign in (("L", -1.0), ("R", 1.0)):
        x = lambda value: sign * value
        add(
            f"clavicle.{suffix}",
            (x(dna.torso_width * 0.38), 0, marks.shoulder_z + dna.arm_radius * 0.08),
            (dna.arm_radius * 1.45, dna.arm_radius * 1.25),
            "chest",
        )
        add(
            f"shoulder.{suffix}",
            (x(marks.shoulder_x), 0, marks.shoulder_z),
            (dna.arm_radius * 1.18, dna.arm_radius * 1.12),
            f"clavicle.{suffix}",
        )
        add(
            f"upper-arm.{suffix}",
            (x(marks.shoulder_x + dna.arm_radius * 0.12), 0, marks.shoulder_z - dna.arm_length * 0.22),
            (dna.arm_radius * 1.05, dna.arm_radius),
            f"shoulder.{suffix}",
        )
        add(
            f"elbow-above.{suffix}",
            (x(marks.elbow_x), 0, marks.elbow_z + arm_band),
            (dna.arm_radius * 0.96, dna.arm_radius * 0.92),
            f"upper-arm.{suffix}",
        )
        add(
            f"elbow.{suffix}",
            (x(marks.elbow_x), 0, marks.elbow_z),
            (dna.arm_radius * 0.86, dna.arm_radius * 0.83),
            f"elbow-above.{suffix}",
        )
        add(
            f"elbow-below.{suffix}",
            (x(marks.elbow_x + dna.arm_radius * 0.08), 0, marks.elbow_z - arm_band),
            (dna.arm_radius * 0.91, dna.arm_radius * 0.87),
            f"elbow.{suffix}",
        )
        add(
            f"forearm.{suffix}",
            (
                x((marks.elbow_x + marks.wrist_x) * 0.5),
                0,
                (marks.elbow_z + marks.wrist_z) * 0.5,
            ),
            (dna.arm_radius * 0.86, dna.arm_radius * 0.82),
            f"elbow-below.{suffix}",
        )
        add(
            f"wrist-above.{suffix}",
            (x(marks.wrist_x), 0, marks.wrist_z + arm_band * 0.70),
            (dna.arm_radius * 0.72, dna.arm_radius * 0.68),
            f"forearm.{suffix}",
        )
        add(
            f"wrist.{suffix}",
            (x(marks.wrist_x), 0, marks.wrist_z),
            (dna.arm_radius * 0.64, dna.arm_radius * 0.62),
            f"wrist-above.{suffix}",
        )
        add(
            f"hand.{suffix}",
            (x(marks.wrist_x), -dna.arm_radius * 0.10, marks.wrist_z - hand_length * 0.43),
            (dna.arm_radius * 1.35, dna.arm_radius * 1.10),
            f"wrist.{suffix}",
        )
        add(
            f"hand-tip.{suffix}",
            (x(marks.wrist_x), -dna.arm_radius * 0.18, marks.hand_tip_z),
            (dna.arm_radius * 1.05, dna.arm_radius * 0.88),
            f"hand.{suffix}",
        )

    leg_band = max((marks.hips_z - marks.ankle_z) * 0.055, dna.calf_radius * 0.70)
    for suffix, sign in (("L", -1.0), ("R", 1.0)):
        x = sign * marks.hip_x
        add(
            f"hip.{suffix}",
            (x, 0, marks.hips_z - leg_band * 0.10),
            (dna.thigh_radius * 1.42, dna.thigh_radius * 1.30),
            "hips",
        )
        add(
            f"thigh-upper.{suffix}",
            (x, 0, marks.hips_z - leg_band),
            (dna.thigh_radius * 1.25, dna.thigh_radius * 1.18),
            f"hip.{suffix}",
        )
        add(
            f"thigh.{suffix}",
            (x, 0, (marks.hips_z + marks.knee_z) * 0.5),
            (dna.thigh_radius * 1.05, dna.thigh_radius),
            f"thigh-upper.{suffix}",
        )
        add(
            f"knee-above.{suffix}",
            (x, 0, marks.knee_z + leg_band),
            (dna.thigh_radius * 0.96, dna.thigh_radius * 0.92),
            f"thigh.{suffix}",
        )
        add(
            f"knee.{suffix}",
            (x, 0, marks.knee_z),
            (max(dna.calf_radius, dna.thigh_radius * 0.82), max(dna.calf_radius, dna.thigh_radius * 0.78)),
            f"knee-above.{suffix}",
        )
        add(
            f"knee-below.{suffix}",
            (x, 0, marks.knee_z - leg_band),
            (dna.calf_radius * 1.02, dna.calf_radius * 0.98),
            f"knee.{suffix}",
        )
        add(
            f"calf.{suffix}",
            (x, 0, (marks.knee_z + marks.ankle_z) * 0.5),
            (dna.calf_radius * 0.98, dna.calf_radius * 0.94),
            f"knee-below.{suffix}",
        )
        add(
            f"ankle-above.{suffix}",
            (x, 0, marks.ankle_z + leg_band * 0.72),
            (dna.calf_radius * 0.78, dna.calf_radius * 0.74),
            f"calf.{suffix}",
        )
        add(
            f"ankle.{suffix}",
            (x, 0, marks.ankle_z),
            (dna.calf_radius * 0.66, dna.calf_radius * 0.64),
            f"ankle-above.{suffix}",
        )
        add(
            f"heel.{suffix}",
            (x, 0, dna.foot_height * 0.58),
            (dna.foot_width * 0.72, dna.foot_height * 0.78),
            f"ankle.{suffix}",
        )
        add(
            f"ball.{suffix}",
            (x, -dna.foot_length * 0.47, dna.foot_height * 0.55),
            (dna.foot_width * 0.78, dna.foot_height * 0.76),
            f"heel.{suffix}",
        )
        add(
            f"toe.{suffix}",
            (x, marks.toe_y, dna.foot_height * 0.52),
            (dna.foot_width * 0.66, dna.foot_height * 0.58),
            f"ball.{suffix}",
        )

    validate_body_graph(nodes, edges)
    return tuple(nodes), tuple(edges)


def validate_body_graph(nodes: Iterable[BodyNode], edges: Iterable[tuple[int, int]]) -> None:
    nodes = tuple(nodes)
    edges = tuple(edges)
    if not nodes:
        raise ValueError("Connected body graph must contain nodes")
    names = [node.name for node in nodes]
    if len(set(names)) != len(names):
        raise ValueError("Connected body graph node names must be unique")
    if len(edges) != len(nodes) - 1:
        raise ValueError("Connected body graph must be an acyclic tree")
    adjacency = {index: set() for index in range(len(nodes))}
    for start, end in edges:
        if start == end or start not in adjacency or end not in adjacency:
            raise ValueError(f"Invalid connected body graph edge {(start, end)}")
        adjacency[start].add(end)
        adjacency[end].add(start)
    visited = {0}
    pending = [0]
    while pending:
        current = pending.pop()
        for neighbor in adjacency[current]:
            if neighbor not in visited:
                visited.add(neighbor)
                pending.append(neighbor)
    if len(visited) != len(nodes):
        raise ValueError("Connected body graph contains disconnected nodes")
    for node in nodes:
        if min(node.radius) <= 0:
            raise ValueError(f"Connected body graph node {node.name} has a non-positive radius")


def candidate_bones_for_point(point, dna, part_name: str = "Body_Core") -> tuple[str, ...]:
    x, _, z = point
    marks = resolve_body_landmarks(dna)
    if part_name == "Clothing_AFrameShirt":
        return ("hips", "spine", "chest", "neck")
    if part_name == "Clothing_Boxers":
        return ("hips", "thigh.L", "thigh.R")
    if abs(x) > dna.torso_width * 0.46 and z > marks.hand_tip_z - dna.arm_radius:
        side = "L" if x < 0 else "R"
        return ("chest", f"upper_arm.{side}", f"forearm.{side}", f"hand.{side}")
    if z < marks.hips_z + dna.thigh_radius * 0.45:
        side = "L" if x < 0 else "R"
        return ("hips", f"thigh.{side}", f"shin.{side}", f"foot.{side}")
    return ("hips", "spine", "chest", "neck")


def _segment_distance(point, start, end) -> float:
    px, py, pz = point
    ax, ay, az = start
    bx, by, bz = end
    vx, vy, vz = bx - ax, by - ay, bz - az
    wx, wy, wz = px - ax, py - ay, pz - az
    length_squared = vx * vx + vy * vy + vz * vz
    if length_squared <= 1e-12:
        return sqrt(wx * wx + wy * wy + wz * wz)
    t = max(0.0, min(1.0, (wx * vx + wy * vy + wz * vz) / length_squared))
    dx, dy, dz = px - (ax + vx * t), py - (ay + vy * t), pz - (az + vz * t)
    return sqrt(dx * dx + dy * dy + dz * dz)


def normalized_weights_for_point(
    point,
    dna,
    joints: Mapping[str, object],
    part_name: str = "Body_Core",
    max_influences: int = 2,
) -> dict[str, float]:
    candidates = candidate_bones_for_point(point, dna, part_name)
    scored: list[tuple[float, str]] = []
    for name in candidates:
        joint = joints.get(name)
        if joint is None or not getattr(joint, "deform", True):
            continue
        distance = _segment_distance(point, joint.head, joint.tail)
        scored.append((1.0 / ((distance + 0.012) ** 3), name))
    if not scored:
        raise ValueError(f"No deform joints available for {part_name} point {tuple(point)}")
    scored.sort(key=lambda item: (-item[0], item[1]))
    selected = scored[:max(1, max_influences)]
    total = sum(score for score, _ in selected)
    return {name: score / total for score, name in selected}
