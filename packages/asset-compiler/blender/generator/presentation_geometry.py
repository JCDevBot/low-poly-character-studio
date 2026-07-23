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


def _append_extruded_profile(vertices, faces, profile, thickness: float) -> None:
    """Extrude an ordered concave x/y/z outline into a thin garment panel."""
    start = len(vertices)
    half = thickness / 2
    count = len(profile)
    vertices.extend((x, y - half, z) for x, y, z in profile)
    vertices.extend((x, y + half, z) for x, y, z in profile)
    faces.append(tuple(start + index for index in range(count)))
    faces.append(tuple(start + count + index for index in range(count - 1, -1, -1)))
    for index in range(count):
        next_index = (index + 1) % count
        faces.append(
            (
                start + index,
                start + next_index,
                start + count + next_index,
                start + count + index,
            )
        )


def _append_rounded_side_panel(
    vertices,
    faces,
    *,
    sign: float,
    bottom_x: float,
    middle_x: float,
    underarm_x: float,
    bottom_z: float,
    middle_z: float,
    underarm_z: float,
    front_bottom_y: float,
    front_middle_y: float,
    front_underarm_y: float,
    back_bottom_y: float,
    back_middle_y: float,
    back_underarm_y: float,
    thickness: float,
) -> None:
    """Join vest panels with a fitted three-level lower side contour.

    The intermediate waist/chest ring prevents the side silhouette from being a
    single straight prism between the hem and underarm. It also introduces stable,
    intentional facets without adding subdivision or simulated cloth.
    """
    start = len(vertices)
    bottom_mid_x = sign * bottom_x * 1.035
    underarm_mid_x = sign * underarm_x * 1.035
    bottom_mid_y = (front_bottom_y + back_bottom_y) * 0.5
    underarm_mid_y = (front_underarm_y + back_underarm_y) * 0.5
    inner_offset = -sign * thickness

    outer = (
        (sign * bottom_x, front_bottom_y, bottom_z),
        (sign * middle_x, front_middle_y, middle_z),
        (sign * underarm_x, front_underarm_y, underarm_z),
        (underarm_mid_x, underarm_mid_y, underarm_z),
        (sign * underarm_x, back_underarm_y, underarm_z),
        (sign * middle_x, back_middle_y, middle_z),
        (sign * bottom_x, back_bottom_y, bottom_z),
        (bottom_mid_x, bottom_mid_y, bottom_z),
    )
    inner = tuple(
        (
            x + inner_offset,
            y + (thickness if y < 0 else -thickness),
            z,
        )
        for x, y, z in outer
    )
    vertices.extend(outer)
    vertices.extend(inner)

    count = len(outer)
    faces.append(tuple(start + index for index in range(count)))
    faces.append(tuple(start + count + index for index in range(count - 1, -1, -1)))
    for index in range(count):
        next_index = (index + 1) % count
        faces.append(
            (
                start + index,
                start + next_index,
                start + count + next_index,
                start + count + index,
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
    """Create a fitted A-frame vest with a real neck cutout and open arm sides."""
    marks = resolve_body_landmarks(dna)
    torso_width = dna.torso_width * 1.02
    bottom_z = dna.waist_z + dna.head_height * 0.035
    underarm_z = marks.shoulder_z - dna.head_height * 0.15
    middle_z = bottom_z + (underarm_z - bottom_z) * 0.56
    neckline_z = marks.shoulder_z - dna.head_height * 0.085
    strap_top = marks.shoulder_z + dna.head_height * 0.020
    thickness = max(0.006, dna.torso_depth * 0.040)

    bottom_half = torso_width * 0.40
    middle_half = torso_width * 0.425
    underarm_half = torso_width * 0.47
    shoulder_outer = torso_width * 0.36
    neck_outer = torso_width * 0.20
    neck_inner = torso_width * 0.135

    def front_y(z: float) -> float:
        span = max(strap_top - bottom_z, 1e-6)
        t = max(0.0, min(1.0, (z - bottom_z) / span))
        belly = 0.055 * (1.0 - abs(t - 0.46) / 0.46) if t <= 0.92 else 0.0
        return -dna.torso_depth * (0.49 + max(0.0, belly))

    def back_y(z: float) -> float:
        span = max(strap_top - bottom_z, 1e-6)
        t = max(0.0, min(1.0, (z - bottom_z) / span))
        return dna.torso_depth * (0.47 + 0.025 * min(1.0, t * 1.8))

    front_profile = (
        (-bottom_half, front_y(bottom_z), bottom_z),
        (bottom_half, front_y(bottom_z), bottom_z),
        (middle_half, front_y(middle_z), middle_z),
        (underarm_half, front_y(underarm_z), underarm_z),
        (shoulder_outer, front_y(strap_top), strap_top),
        (neck_outer, front_y(strap_top), strap_top),
        (neck_inner, front_y(neckline_z), neckline_z),
        (-neck_inner, front_y(neckline_z), neckline_z),
        (-neck_outer, front_y(strap_top), strap_top),
        (-shoulder_outer, front_y(strap_top), strap_top),
        (-underarm_half, front_y(underarm_z), underarm_z),
        (-middle_half, front_y(middle_z), middle_z),
    )

    back_neckline_z = marks.shoulder_z - dna.head_height * 0.025
    back_profile = (
        (-bottom_half, back_y(bottom_z), bottom_z),
        (-middle_half, back_y(middle_z), middle_z),
        (-underarm_half, back_y(underarm_z), underarm_z),
        (-shoulder_outer, back_y(strap_top), strap_top),
        (-neck_outer, back_y(strap_top), strap_top),
        (-neck_inner, back_y(back_neckline_z), back_neckline_z),
        (neck_inner, back_y(back_neckline_z), back_neckline_z),
        (neck_outer, back_y(strap_top), strap_top),
        (shoulder_outer, back_y(strap_top), strap_top),
        (underarm_half, back_y(underarm_z), underarm_z),
        (middle_half, back_y(middle_z), middle_z),
        (bottom_half, back_y(bottom_z), bottom_z),
    )

    vertices = []
    faces = []
    _append_extruded_profile(vertices, faces, front_profile, thickness)
    _append_extruded_profile(vertices, faces, back_profile, thickness)

    # Join only the lower torso. The waist/chest ring makes the garment follow the
    # torso depth profile rather than spanning the hem and underarm with one slab.
    # Armholes remain open above the underarm line.
    for sign in (-1.0, 1.0):
        _append_rounded_side_panel(
            vertices,
            faces,
            sign=sign,
            bottom_x=bottom_half,
            middle_x=middle_half,
            underarm_x=underarm_half,
            bottom_z=bottom_z,
            middle_z=middle_z,
            underarm_z=underarm_z,
            front_bottom_y=front_y(bottom_z),
            front_middle_y=front_y(middle_z),
            front_underarm_y=front_y(underarm_z),
            back_bottom_y=back_y(bottom_z),
            back_middle_y=back_y(middle_z),
            back_underarm_y=back_y(underarm_z),
            thickness=thickness,
        )

    obj = _mesh_object("Clothing_AFrameShirt", vertices, faces, material)
    obj["depthProfile"] = "fitted-rounded-vest/v6"
    obj["depthRingCount"] = 3
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
