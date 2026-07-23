"""Humanoid generator package initialization."""

from __future__ import annotations

from . import body_topology as _body_topology
from .underarm_web_weights import apply_underarm_web_weight_band

_base_normalized_weights_for_point = _body_topology.normalized_weights_for_point


def _normalized_weights_with_underarm_web(
    point,
    dna,
    joints,
    part_name: str = "Body_Core",
    max_influences: int = 3,
):
    weights = _base_normalized_weights_for_point(
        point,
        dna,
        joints,
        part_name=part_name,
        max_influences=max_influences,
    )
    return apply_underarm_web_weight_band(
        point,
        dna,
        _body_topology.resolve_body_landmarks(dna),
        weights,
        part_name=part_name,
    )


_body_topology.normalized_weights_for_point = _normalized_weights_with_underarm_web
