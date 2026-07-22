"""Gold-standard presentation geometry layered onto the generated humanoid model.

The connected deforming body remains the structural source for rigging. These parts
provide the visible low-poly clothing and broad bare-foot silhouette required by
``humanoid/chibi-v1`` without changing the armature contract.
"""

from __future__ import annotations

import bpy

from .body_topology import resolve_body_landmarks


PRESENTATION_SCHEMA = "humanoid-presentation-geometry/v1"


def _lowpoly(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_flat()
    obj.select_set(False)


def _mesh_object(name: str, vertices, faces, material) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj["presentationSchema"] = PRESENTATION_SCHEMA
    _lowpoly(obj)
    return obj


def _append_box(vertices, faces, center, dimensions) -> None:
    cx, cy, cz = center
    hx, hy, hz = (value / 2 for value in dimensions)
    start = len(vertices)
    vertices.extend(
        (
            (cx - hx, cy - hy, cz - hz),
            (cx + hx, cy - hy, cz - hz),
            (cx + hx, cy + hy, cz - hz),
            (cx - hx, cy + hy, cz - hz),
            (cx - hx, cy - hy, cz + hz),
            (cx + hx, cy - hy, cz + hz),
            (cx + hx, cy + hy, cz + hz),
            (cx - hx, cy + hy, cz + hz),
        )
    )
    faces.extend(
        (
            (start + 0, start + 1, start + 2, start + 3),
            (start + 4, start + 7, start + 6, start + 5),
            (start + 0, start + 4, start + 5, start + 1),
            (start + 1, start + 5, start + 6, start + 2),
            (start + 2, start + 6, start + 7, start + 3),
            (start + 4, start + 0, start + 3, start + 7),
        )
    )


def _append_tapered_panel(
    vertices,
    faces,
    *,
    bottom_z: float,
    top_z: float,
    bottom_width: float,
    top_width: float,
    bottom_center_y: float,
    top_center_y: float,
    thickness: float,
) -> None:
    """Append a low-poly garment band that follows torso depth between two heights."""
    bottom_front_y = bottom_center_y - thickness / 2
    bottom_back_y = bottom_center_y + thickness / 2
    top_front_y = top_center_y - thickness / 2
    top_back_y = top_center_y + thickness / 2
    start = len(vertices)
    vertices.extend(
        (
            (-bottom_width / 2, bottom_front_y, bottom_z),
            (bottom_width / 2, bottom_front_y, bottom_z),
            (bottom_width / 2, bottom_back_y, bottom_z),
            (-bottom_width / 2, bottom_back_y, bottom_z),
            (-top_width / 2, top_front_y, top_z),
            (top_width / 2, top_front_y, top_z),
            (top_width / 2, top_back_y, top_z),
            (-top_width / 2, top_back_y, top_z),
        )
    )
    faces.extend(
        (
            (start + 0, start + 1, start + 2, start + 3),
            (start + 4, start + 7, start + 6, start + 5),
            (start + 0, start + 4, start + 5, start + 1),
            (start + 1, start + 5, start + 6, start + 2),
            (start + 2, start + 6, start + 7, start + 3),
            (start + 4, start + 0, start + 3, start + 7),
        )
    )


def _material_from(obj: bpy.types.Object):
    if not obj.data.materials:
        raise ValueError(f"{obj.name} must contain a material before presentation refinement")
    return obj.data.materials[0]


def _remove(obj: bpy.types.Object) -> None:
    mesh = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)


def _create_a_frame_shirt(dna, material) -> bpy.types.Object:
    """Create body-hugging panels with readable depth, neckline, and open arm sides."""
    marks = resolve_body_landmarks(dna)
    torso_width = dna.torso_width * 1.02
    panel_bottom = dna.waist_z + dna.head_height * 0.035
    panel_mid = dna.torso_center_z
    underarm_z = marks.shoulder_z - dna.head_height * 0.15
    neckline_z = marks.shoulder_z - dna.head_height * 0.075
    strap_top = marks.shoulder_z + dna.head_height * 0.015
    thickness = max(0.006, dna.torso_depth * 0.040)

    front_bottom_y = -dna.torso_depth * 0.49
    front_mid_y = -dna.torso_depth * 0.545
    front_upper_y = -dna.torso_depth * 0.515
    back_bottom_y = dna.torso_depth * 0.475
    back_mid_y = dna.torso_depth * 0.505
    back_upper_y = dna.torso_depth * 0.49

    vertices = []
    faces = []

    # Two depth-profiled bands keep the shirt close to the belly and chest instead
    # of reading as one flat apron in side and three-quarter views.
    _append_tapered_panel(
        vertices,
        faces,
        bottom_z=panel_bottom,
        top_z=panel_mid,
        bottom_width=torso_width * 0.88,
        top_width=torso_width * 0.96,
        bottom_center_y=front_bottom_y,
        top_center_y=front_mid_y,
        thickness=thickness,
    )
    _append_tapered_panel(
        vertices,
        faces,
        bottom_z=panel_mid,
        top_z=underarm_z,
        bottom_width=torso_width * 0.96,
        top_width=torso_width,
        bottom_center_y=front_mid_y,
        top_center_y=front_upper_y,
        thickness=thickness,
    )

    upper_height = max(dna.head_height * 0.085, neckline_z - underarm_z)
    upper_z = underarm_z + upper_height / 2
    upper_piece_width = torso_width * 0.285
    for sign in (-1.0, 1.0):
        _append_box(
            vertices,
            faces,
            (sign * torso_width * 0.30, front_upper_y, upper_z),
            (upper_piece_width, thickness, upper_height),
        )

    strap_height = max(dna.head_height * 0.095, strap_top - neckline_z)
    strap_z = neckline_z + strap_height / 2
    for sign in (-1.0, 1.0):
        _append_box(
            vertices,
            faces,
            (sign * torso_width * 0.30, front_upper_y + thickness * 0.15, strap_z),
            (torso_width * 0.13, thickness, strap_height),
        )

    _append_tapered_panel(
        vertices,
        faces,
        bottom_z=panel_bottom,
        top_z=panel_mid,
        bottom_width=torso_width * 0.88,
        top_width=torso_width * 0.91,
        bottom_center_y=back_bottom_y,
        top_center_y=back_mid_y,
        thickness=thickness,
    )
    _append_tapered_panel(
        vertices,
        faces,
        bottom_z=panel_mid,
        top_z=strap_top,
        bottom_width=torso_width * 0.91,
        top_width=torso_width * 0.68,
        bottom_center_y=back_mid_y,
        top_center_y=back_upper_y,
        thickness=thickness,
    )

    side_height = max(dna.head_height * 0.10, (underarm_z - panel_bottom) * 0.34)
    side_z = panel_bottom + side_height / 2
    side_depth = dna.torso_depth * 0.96
    for sign in (-1.0, 1.0):
        _append_box(
            vertices,
            faces,
            (sign * torso_width * 0.44, 0.0, side_z),
            (thickness, side_depth, side_height),
        )

    obj = _mesh_object("Clothing_AFrameShirt", vertices, faces, material)
    obj["depthProfile"] = "waist-belly-chest/v1"
    return obj


def _create_foot(name: str, x: float, dna, material) -> bpy.types.Object:
    """Create a broad grounded foot shell that fully encloses the deforming core."""
    heel_y = dna.foot_length * 0.12
    mid_y = -dna.foot_length * 0.44
    toe_y = -dna.foot_length * 1.06
    heel_half = dna.foot_width * 0.38
    mid_half = dna.foot_width * 0.54
    toe_half = dna.foot_width * 0.50
    bottom_z = -dna.foot_height * 0.30

    outline = (
        (-heel_half, heel_y),
        (heel_half, heel_y),
        (mid_half, mid_y),
        (toe_half, toe_y),
        (-toe_half, toe_y),
        (-mid_half, mid_y),
    )
    top_heights = (
        dna.foot_height * 1.58,
        dna.foot_height * 1.58,
        dna.foot_height * 1.24,
        dna.foot_height * 0.84,
        dna.foot_height * 0.84,
        dna.foot_height * 1.24,
    )
    vertices = [(x + px, py, bottom_z) for px, py in outline]
    vertices.extend((x + px, py, top_z) for (px, py), top_z in zip(outline, top_heights))
    count = len(outline)
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))

    obj = _mesh_object(name, vertices, faces, material)
    obj["footCoreCoverage"] = "extended-heel-toe/v1"
    bevel = obj.modifiers.new("broad_foot_edges", "BEVEL")
    bevel.width = max(0.003, dna.foot_height * 0.075)
    bevel.segments = 1
    return obj


def refine_presentation_geometry(root: bpy.types.Object, dna) -> None:
    """Replace provisional clothing/feet while preserving rig-facing object names."""
    shirt = bpy.data.objects.get("Clothing_AFrameShirt")
    left_foot = bpy.data.objects.get("Body_LeftFoot")
    right_foot = bpy.data.objects.get("Body_RightFoot")
    if shirt is None or left_foot is None or right_foot is None:
        raise ValueError("Generated humanoid is missing provisional presentation geometry")

    shirt_material = _material_from(shirt)
    foot_material = _material_from(left_foot)
    _remove(shirt)
    _remove(left_foot)
    _remove(right_foot)

    marks = resolve_body_landmarks(dna)
    foot_center_x = max(marks.hip_x, dna.foot_width * 0.58)
    replacements = (
        _create_a_frame_shirt(dna, shirt_material),
        _create_foot("Body_LeftFoot", -foot_center_x, dna, foot_material),
        _create_foot("Body_RightFoot", foot_center_x, dna, foot_material),
    )
    for part in replacements:
        part.parent = root

    root["presentationGeometrySchema"] = PRESENTATION_SCHEMA
