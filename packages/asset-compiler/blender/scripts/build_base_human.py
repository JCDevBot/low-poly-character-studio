import math
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
BLENDER_DIR = SCRIPT_DIR.parent
ASSET_COMPILER_DIR = BLENDER_DIR.parent
sys.path.append(str(BLENDER_DIR))

from generator.body_topology import TOPOLOGY_SCHEMA, build_body_graph, resolve_body_landmarks
from generator.character_dna import LittleGuyDNA


DIST = ASSET_COMPILER_DIR / "dist"
BLEND_OUT = DIST / "blend" / "base_human_v003_style_dna.blend"
GLB_OUT = DIST / "glb" / "base_human_v003_style_dna.glb"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def mat(name, color):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    return material


def lowpoly(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_flat()
    obj.select_set(False)


def _activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def _apply_modifier(obj, modifier):
    _activate(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def _mesh_component_count(obj):
    vertex_count = len(obj.data.vertices)
    if vertex_count == 0:
        return 0
    adjacency = {index: set() for index in range(vertex_count)}
    for edge in obj.data.edges:
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


def _fuse_body_components(obj, dna):
    """Voxel-union Skin modifier branches into one manifold deforming body."""
    initial_components = _mesh_component_count(obj)
    obj["preFusionComponentCount"] = initial_components
    if initial_components == 1:
        obj["fusionMethod"] = "not-required"
        obj["fusionVoxelSize"] = 0.0
        obj["fusionAttemptCount"] = 0
        return

    smallest_limb_radius = min(dna.arm_radius, dna.thigh_radius, dna.calf_radius)
    base_voxel_size = max(0.0065, smallest_limb_radius * 0.32)
    attempts = []

    for factor in (1.0, 1.30, 1.65, 2.0):
        voxel_size = base_voxel_size * factor
        _activate(obj)
        obj.data.remesh_mode = "VOXEL"
        obj.data.remesh_voxel_size = voxel_size
        obj.data.remesh_voxel_adaptivity = 0.0
        if hasattr(obj.data, "use_remesh_fix_poles"):
            obj.data.use_remesh_fix_poles = True
        if hasattr(obj.data, "use_remesh_preserve_volume"):
            obj.data.use_remesh_preserve_volume = False
        if hasattr(obj.data, "use_remesh_preserve_attributes"):
            obj.data.use_remesh_preserve_attributes = False

        result = bpy.ops.object.voxel_remesh()
        if "FINISHED" not in result:
            raise ValueError(
                f"Body_Core voxel remesh did not finish at voxel size {voxel_size}: {result}"
            )
        bpy.context.view_layer.update()
        component_count = _mesh_component_count(obj)
        attempts.append((voxel_size, component_count))
        if component_count == 1:
            obj["fusionMethod"] = "voxel-remesh"
            obj["fusionVoxelSize"] = voxel_size
            obj["fusionAttemptCount"] = len(attempts)
            print(
                "Fused Body_Core mesh components "
                f"{initial_components} -> 1 at voxel size {voxel_size:.6f}"
            )
            return

    attempt_summary = ", ".join(
        f"{voxel_size:.6f}:{component_count}"
        for voxel_size, component_count in attempts
    )
    raise ValueError(
        "Body_Core voxel fusion could not produce one connected component; "
        f"started with {initial_components}; attempts={attempt_summary}"
    )


def mesh_object(name, vertices, faces, material):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    lowpoly(obj)
    return obj


def cube(name, loc, dimensions, material, bevel_width=0.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = dimensions
    obj.data.materials.append(material)
    lowpoly(obj)
    if bevel_width:
        bevel = obj.modifiers.new("soft_low_poly_edges", "BEVEL")
        bevel.width = bevel_width
        bevel.segments = 1
    return obj


def sphere(name, loc, scale, material, segments=8, rings=4):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=1,
        location=loc,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    lowpoly(obj)
    return obj


def _append_box(vertices, faces, center, dimensions):
    cx, cy, cz = center
    hx, hy, hz = (dimension / 2 for dimension in dimensions)
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


def _append_tapered_prism(vertices, faces, bottom_z, top_z, bottom_width, top_width, depth, center_y=-0.008):
    front_y = center_y - depth / 2
    back_y = center_y + depth / 2
    start = len(vertices)
    vertices.extend(
        (
            (-bottom_width / 2, front_y, bottom_z),
            (bottom_width / 2, front_y, bottom_z),
            (bottom_width / 2, back_y, bottom_z),
            (-bottom_width / 2, back_y, bottom_z),
            (-top_width / 2, front_y, top_z),
            (top_width / 2, front_y, top_z),
            (top_width / 2, back_y, top_z),
            (-top_width / 2, back_y, top_z),
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


def custom_head(name, dna: LittleGuyDNA, material):
    """Custom broad low-poly head. Front faces negative Y."""
    sx, sy, sz = dna.head_scale
    segments = dna.low_poly_segments

    rings = [
        (-1.00, 0.44 * dna.chin_softness, 0.38),
        (-0.78, 0.69, 0.61),
        (-0.46, 0.94 * dna.cheek_fullness, 0.84),
        (-0.12, 1.00 * dna.cheek_fullness, 0.98),
        (0.24, 0.97 * dna.cranium_roundness, 1.00),
        (0.62, 0.82 * dna.cranium_roundness, 0.90),
        (0.92, 0.48, 0.54),
    ]

    verts = []
    for z_norm, x_mul, y_mul in rings:
        for i in range(segments):
            angle = math.tau * i / segments
            x = math.cos(angle) * sx * x_mul
            y = math.sin(angle) * sy * y_mul
            if y < 0:
                y *= 0.86
            if z_norm < -0.4 and y > 0:
                x *= 0.94
            verts.append((x, y, dna.head_center_z + z_norm * sz))

    top_index = len(verts)
    verts.append((0, 0, dna.head_center_z + 1.05 * sz))
    bottom_index = len(verts)
    verts.append((0, -0.02 * sy, dna.head_center_z - 1.08 * sz))

    faces = []
    for ring in range(len(rings) - 1):
        for i in range(segments):
            a = ring * segments + i
            b = ring * segments + (i + 1) % segments
            c = (ring + 1) * segments + (i + 1) % segments
            d = (ring + 1) * segments + i
            faces.append((a, b, c, d))

    top_ring_start = (len(rings) - 1) * segments
    for i in range(segments):
        faces.append((top_ring_start + i, top_ring_start + (i + 1) % segments, top_index))
    for i in range(segments):
        faces.append((bottom_index, (i + 1) % segments, i))

    return mesh_object(name, verts, faces, material)


def hair_cap(name, dna: LittleGuyDNA, material):
    """Open faceted cap with an irregular chunky front fringe."""
    sx, sy, sz = dna.head_scale
    segments = dna.low_poly_segments
    ring_specs = (
        (0.06, 1.035, 1.03),
        (0.40, 1.025, 1.04),
        (0.72, 0.87, 0.92),
    )
    vertices = []
    for ring_index, (z_norm, x_mul, y_mul) in enumerate(ring_specs):
        for i in range(segments):
            angle = math.tau * i / segments
            x = math.cos(angle) * sx * x_mul
            y = math.sin(angle) * sy * y_mul
            local_z = z_norm
            if ring_index == 0 and y < 0:
                local_z -= 0.19 if i % 3 else 0.27
            elif ring_index == 0:
                local_z -= 0.02
            vertices.append((x, y, dna.head_center_z + local_z * sz))

    top_index = len(vertices)
    vertices.append((0, 0, dna.head_center_z + 1.055 * sz))
    faces = []
    for ring in range(len(ring_specs) - 1):
        for i in range(segments):
            a = ring * segments + i
            b = ring * segments + (i + 1) % segments
            c = (ring + 1) * segments + (i + 1) % segments
            d = (ring + 1) * segments + i
            faces.append((a, b, c, d))
    top_ring_start = (len(ring_specs) - 1) * segments
    for i in range(segments):
        faces.append((top_ring_start + i, top_ring_start + (i + 1) % segments, top_index))
    return mesh_object(name, vertices, faces, material)


def connected_body(name, dna: LittleGuyDNA, material):
    """Build one connected low-poly deforming body with support nodes at every joint."""
    nodes, edges = build_body_graph(dna)
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata([node.point for node in nodes], edges, [])
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj["topologySchema"] = TOPOLOGY_SCHEMA
    obj["guideNodeCount"] = len(nodes)
    obj["guideEdgeCount"] = len(edges)

    _activate(obj)
    skin = obj.modifiers.new("connected_body_skin", "SKIN")
    if hasattr(skin, "branch_smoothing"):
        skin.branch_smoothing = 0.24
    if hasattr(skin, "use_smooth_shade"):
        skin.use_smooth_shade = False

    if not obj.data.skin_vertices:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.customdata_skin_add()
        bpy.ops.object.mode_set(mode="OBJECT")
    skin_vertices = obj.data.skin_vertices[0].data
    for index, node in enumerate(nodes):
        skin_vertices[index].radius = node.radius
        skin_vertices[index].use_root = node.name == "hips"

    _apply_modifier(obj, skin)

    subdivision = obj.modifiers.new("joint_support_subdivision", "SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 1
    subdivision.render_levels = 1
    _apply_modifier(obj, subdivision)

    _fuse_body_components(obj, dna)

    triangle_count = sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)
    if triangle_count > 4200:
        decimate = obj.modifiers.new("low_poly_triangle_budget", "DECIMATE")
        decimate.decimate_type = "COLLAPSE"
        decimate.ratio = max(0.35, 3600 / triangle_count)
        _apply_modifier(obj, decimate)
        triangle_count = sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)

    final_components = _mesh_component_count(obj)
    if final_components != 1:
        raise ValueError(
            "Body_Core lost connected topology after low-poly reduction; "
            f"found {final_components} components"
        )

    obj["finalComponentCount"] = final_components
    obj["triangleCount"] = triangle_count
    lowpoly(obj)
    return obj


def create_eye(name, x, dna: LittleGuyDNA, material):
    front_y = -dna.head_depth * 0.42
    return sphere(
        name,
        (x, front_y - dna.head_depth * 0.012, dna.eye_center_z),
        (dna.eye_width / 2, dna.head_depth * 0.018, dna.eye_height / 2),
        material,
        segments=8,
        rings=4,
    )


def create_nose(dna: LittleGuyDNA, material):
    front_y = -dna.head_depth * 0.42
    z = dna.eye_center_z - dna.head_height * 0.135
    half_width = dna.head_height * 0.027
    half_height = dna.head_height * 0.042
    base_y = front_y - dna.head_depth * 0.008
    tip_y = front_y - dna.head_depth * 0.075
    vertices = (
        (-half_width, base_y, z - half_height),
        (half_width, base_y, z - half_height),
        (half_width * 0.72, base_y, z + half_height),
        (-half_width * 0.72, base_y, z + half_height),
        (0, tip_y, z - half_height * 0.12),
    )
    faces = (
        (0, 1, 2, 3),
        (0, 4, 1),
        (1, 4, 2),
        (2, 4, 3),
        (3, 4, 0),
    )
    return mesh_object("Face_Nose", vertices, faces, material)


def create_mouth(dna: LittleGuyDNA, material):
    front_y = -dna.head_depth * 0.425
    return cube(
        "Face_Mouth",
        (0, front_y - 0.004, dna.eye_center_z - dna.head_height * 0.245),
        (dna.head_width * 0.105, 0.010, dna.head_height * 0.012),
        material,
        bevel_width=0.003,
    )


def foot_shell(name, x, dna: LittleGuyDNA, material):
    return sphere(
        name,
        (x, -dna.foot_length * 0.42, dna.foot_height * 0.64),
        (dna.foot_width * 0.54, dna.foot_length * 0.58, dna.foot_height * 0.62),
        material,
        segments=8,
        rings=4,
    )


def a_frame_shirt(dna: LittleGuyDNA, material):
    marks = resolve_body_landmarks(dna)
    panel_bottom = dna.waist_z + dna.head_height * 0.035
    panel_top = marks.shoulder_z - dna.head_height * 0.19
    strap_top = marks.shoulder_z + dna.head_height * 0.012
    depth = dna.torso_depth * 1.08
    vertices = []
    faces = []

    _append_tapered_prism(
        vertices,
        faces,
        panel_bottom,
        panel_top,
        dna.torso_width * 1.06,
        dna.torso_width * 0.82,
        depth,
    )
    strap_height = strap_top - panel_top
    strap_z = (panel_top + strap_top) / 2
    for sign in (-1, 1):
        _append_box(
            vertices,
            faces,
            (sign * dna.torso_width * 0.29, -0.008, strap_z),
            (dna.torso_width * 0.15, depth * 0.88, strap_height),
        )

    return mesh_object("Clothing_AFrameShirt", vertices, faces, material)


def boxer_briefs(dna: LittleGuyDNA, material):
    vertices = []
    faces = []
    waist_height = dna.head_height * 0.060
    leg_height = dna.head_height * 0.115
    waist_center_z = dna.waist_z - waist_height * 0.18
    _append_box(
        vertices,
        faces,
        (0, 0, waist_center_z),
        (dna.hip_width * 1.13, dna.torso_depth * 1.11, waist_height),
    )
    leg_center_z = dna.waist_z - waist_height * 0.42 - leg_height * 0.50
    for sign in (-1, 1):
        _append_box(
            vertices,
            faces,
            (sign * dna.hip_width * 0.235, 0, leg_center_z),
            (dna.hip_width * 0.49, dna.torso_depth * 1.08, leg_height),
        )
    return mesh_object("Clothing_Boxers", vertices, faces, material)


def build_human(dna: LittleGuyDNA):
    skin = mat("skin_warm_peach", (0.86, 0.55, 0.36, 1))
    shirt = mat("a_frame_shirt_warm_white", (0.94, 0.91, 0.82, 1))
    boxers = mat("boxers_olive", (0.28, 0.33, 0.17, 1))
    dark = mat("simple_dark_features", (0.015, 0.012, 0.01, 1))
    hair = mat("hair_faceted_brown", (0.20, 0.095, 0.045, 1))

    root = bpy.data.objects.new("BaseHumanRoot", None)
    bpy.context.collection.objects.link(root)
    parts = []

    parts.append(connected_body("Body_Core", dna, skin))
    parts.append(custom_head("Body_Head", dna, skin))
    parts.append(hair_cap("Hair_Cap", dna, hair))
    parts.append(create_eye("Face_LeftEye", -dna.eye_spacing / 2, dna, dark))
    parts.append(create_eye("Face_RightEye", dna.eye_spacing / 2, dna, dark))
    parts.append(create_nose(dna, skin))
    parts.append(create_mouth(dna, dark))

    ear_x = dna.head_width * 0.43
    ear_scale = (
        dna.head_height * 0.070,
        dna.head_depth * 0.055,
        dna.ear_height * 0.52,
    )
    parts.append(
        sphere(
            "Body_LeftEar",
            (-ear_x, 0, dna.ear_center_z),
            ear_scale,
            skin,
            8,
            4,
        )
    )
    parts.append(
        sphere(
            "Body_RightEar",
            (ear_x, 0, dna.ear_center_z),
            ear_scale,
            skin,
            8,
            4,
        )
    )

    marks = resolve_body_landmarks(dna)
    parts.append(foot_shell("Body_LeftFoot", -marks.hip_x, dna, skin))
    parts.append(foot_shell("Body_RightFoot", marks.hip_x, dna, skin))
    parts.append(a_frame_shirt(dna, shirt))
    parts.append(boxer_briefs(dna, boxers))

    for part in parts:
        part.parent = root
    return root


def add_scene_setup():
    bpy.ops.object.light_add(type="AREA", location=(0, -3, 4))
    light = bpy.context.object
    light.name = "Key_Light"
    light.data.energy = 450
    light.data.size = 4

    bpy.ops.object.camera_add(
        location=(0, -3.2, 0.9),
        rotation=(math.radians(78), 0, 0),
    )
    bpy.context.scene.camera = bpy.context.object


def save_outputs():
    (DIST / "blend").mkdir(parents=True, exist_ok=True)
    (DIST / "glb").mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUT))
    bpy.ops.export_scene.gltf(filepath=str(GLB_OUT), export_format="GLB")

    print(f"Saved blend: {BLEND_OUT}")
    print(f"Saved glb:   {GLB_OUT}")


def main():
    clear_scene()
    dna = LittleGuyDNA()
    build_human(dna)
    add_scene_setup()
    save_outputs()


if __name__ == "__main__":
    main()
