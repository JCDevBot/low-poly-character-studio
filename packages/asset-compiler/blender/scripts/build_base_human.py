import math
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
BLENDER_DIR = SCRIPT_DIR.parent
ASSET_COMPILER_DIR = BLENDER_DIR.parent
sys.path.append(str(BLENDER_DIR))

from generator.body_topology import TOPOLOGY_SCHEMA, build_body_graph
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


def cube(name, loc, scale, material, bevel_width=0.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
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


def custom_head(name, dna: LittleGuyDNA, material):
    """
    Custom low-poly head from measured StyleDNA.
    Front faces negative Y.
    """
    sx, sy, sz = dna.head_scale
    segments = dna.low_poly_segments

    rings = [
        (-1.00, 0.42 * dna.chin_softness, 0.36),
        (-0.78, 0.66, 0.58),
        (-0.46, 0.92 * dna.cheek_fullness, 0.82),
        (-0.12, 1.00 * dna.cheek_fullness, 0.98),
        (0.24, 0.96 * dna.cranium_roundness, 1.00),
        (0.62, 0.80 * dna.cranium_roundness, 0.88),
        (0.92, 0.45, 0.50),
    ]

    verts = []
    for z_norm, x_mul, y_mul in rings:
        for i in range(segments):
            angle = math.tau * i / segments
            x = math.cos(angle) * sx * x_mul
            y = math.sin(angle) * sy * y_mul
            if y < 0:
                y *= 0.84
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

    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    lowpoly(obj)
    return obj


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
        skin.branch_smoothing = 0.20
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

    triangle_count = sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)
    if triangle_count > 2800:
        decimate = obj.modifiers.new("low_poly_triangle_budget", "DECIMATE")
        decimate.decimate_type = "COLLAPSE"
        decimate.ratio = max(0.25, 2500 / triangle_count)
        _apply_modifier(obj, decimate)
        triangle_count = sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)

    obj["triangleCount"] = triangle_count
    lowpoly(obj)
    return obj


def create_eye(name, x, dna: LittleGuyDNA, material):
    front_y = -dna.head_depth / 2 * 0.86
    return cube(
        name,
        (x, front_y - 0.004, dna.eye_center_z),
        (dna.eye_width / 2, 0.009, dna.eye_height / 2),
        material,
        bevel_width=0.006,
    )


def build_human(dna: LittleGuyDNA):
    skin = mat("skin_warm_peach", (0.86, 0.55, 0.36, 1))
    shirt = mat("a_frame_shirt_warm_white", (0.88, 0.84, 0.72, 1))
    boxers = mat("boxers_olive", (0.28, 0.33, 0.17, 1))
    eyes = mat("simple_dark_eyes", (0.015, 0.012, 0.01, 1))

    root = bpy.data.objects.new("BaseHumanRoot", None)
    bpy.context.collection.objects.link(root)
    parts = []

    parts.append(connected_body("Body_Core", dna, skin))
    parts.append(custom_head("Body_Head", dna, skin))
    parts.append(create_eye("Face_LeftEye", -dna.eye_spacing / 2, dna, eyes))
    parts.append(create_eye("Face_RightEye", dna.eye_spacing / 2, dna, eyes))

    ear_x = dna.head_width / 2 * 0.98
    parts.append(
        sphere(
            "Body_LeftEar",
            (-ear_x, 0, dna.ear_center_z),
            (0.035, 0.024, dna.ear_height / 2),
            skin,
            8,
            4,
        )
    )
    parts.append(
        sphere(
            "Body_RightEar",
            (ear_x, 0, dna.ear_center_z),
            (0.035, 0.024, dna.ear_height / 2),
            skin,
            8,
            4,
        )
    )

    parts.append(
        cube(
            "Clothing_AFrameShirt",
            (0, -0.006, dna.torso_center_z + dna.torso_height * 0.05),
            (dna.torso_width * 0.54, dna.torso_depth * 0.54, dna.torso_height * 0.43),
            shirt,
            bevel_width=0.02,
        )
    )
    parts.append(
        cube(
            "Clothing_Boxers",
            (0, 0, dna.waist_z - dna.head_height * 0.045),
            (dna.hip_width * 0.54, dna.torso_depth * 0.54, dna.head_height * 0.07),
            boxers,
            bevel_width=0.02,
        )
    )

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
