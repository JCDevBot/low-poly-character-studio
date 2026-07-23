"""Localized deterministic skin weighting for the procedural underarm web."""

from __future__ import annotations

from math import sqrt
from typing import Mapping

UNDERARM_WEB_WEIGHT_SCHEMA = "underarm-web-weights/v1"


def _smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def apply_underarm_web_weight_band(
    point,
    dna,
    marks,
    weights: Mapping[str, float],
    *,
    part_name: str,
) -> dict[str, float]:
    """Blend Body_Core weights along the torso-rooted underarm web guide.

    The inner web stays chest-dominant, the midpoint blends, and the outer
    web follows the upper arm. Influence falls off elliptically away from the
    guide and around the separately anchored socket floor so the correction
    remains local without widening the neutral shoulder.
    """
    if part_name != "Body_Core":
        return dict(weights)

    x, y, z = (float(value) for value in point)
    side = "L" if x < 0 else "R"
    arm_name = f"upper_arm.{side}"
    if "chest" not in weights or arm_name not in weights:
        return dict(weights)

    radius = max(float(dna.arm_radius), 1e-6)
    lateral = abs(x)
    inner = (
        marks.shoulder_x - radius * 1.02,
        marks.shoulder_z - radius * 0.80,
    )
    outer = (
        marks.shoulder_x - radius * 0.25,
        marks.shoulder_z - radius * 0.31,
    )
    guide_x = outer[0] - inner[0]
    guide_z = outer[1] - inner[1]
    guide_length_squared = guide_x * guide_x + guide_z * guide_z
    if guide_length_squared <= 1e-12:
        return dict(weights)

    point_x = lateral - inner[0]
    point_z = z - inner[1]
    progress = max(
        0.0,
        min(1.0, (point_x * guide_x + point_z * guide_z) / guide_length_squared),
    )
    closest_x = inner[0] + guide_x * progress
    closest_z = inner[1] + guide_z * progress
    perpendicular = sqrt((lateral - closest_x) ** 2 + (z - closest_z) ** 2)

    planar_influence = 1.0 - _smoothstep(perpendicular / (radius * 0.62))
    depth_influence = 1.0 - _smoothstep(abs(y) / (radius * 1.35))

    floor_x = marks.shoulder_x - radius * 0.36
    floor_z = marks.shoulder_z - radius * 0.48
    floor_dx = (lateral - floor_x) / (radius * 0.28)
    floor_dz = (z - floor_z) / (radius * 0.22)
    floor_distance = sqrt(floor_dx * floor_dx + floor_dz * floor_dz)
    floor_exclusion = _smoothstep(floor_distance)

    influence = planar_influence * depth_influence * floor_exclusion
    if influence <= 1e-6:
        return dict(weights)

    target_arm_weight = 0.10 + 0.64 * _smoothstep(progress)
    blend_strength = 0.82 * influence
    current_arm_weight = float(weights[arm_name])
    arm_weight = current_arm_weight * (1.0 - blend_strength) + target_arm_weight * blend_strength
    arm_weight = min(0.82, max(0.06, arm_weight))
    return {"chest": 1.0 - arm_weight, arm_name: arm_weight}
