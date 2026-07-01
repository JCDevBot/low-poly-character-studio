import math
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
BLENDER_DIR = SCRIPT_DIR.parent
ASSET_COMPILER_DIR = BLENDER_DIR.parent
sys.path.append(str(BLENDER_DIR))

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


def cylinder(name, loc, radius, depth, material, rotation=(0, 0, 0), vertices=8):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=loc,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    lowpoly(obj)
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

    # z, x multiplier, y multiplier
    # Designed to avoid the old egg shape: fuller cheeks, soft chin, rounder side.
    rings = [
        (-1.00, 0.42 * dna.chin_softness, 0.36),  # soft chin, not a point
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

            # Flatten face plane a bit while keeping the side/back round.
            if y < 0:
                y *= 0.84

            # Keep the lower back slightly tucked in.
            if z_norm < -0.4 and y > 0:
                x *= 0.94

            verts.append((x, y, dna.head_center_z + z_norm * sz))

    top_index = len(verts)
    verts.append((0, 0, dna.head_center_z + 1.05 * sz))

    bottom_index = len(verts)
    verts.append((0, -0.02 * sy, dna.head_center_z - 1.08 * sz))

    faces = []
    for r in range(len(rings) - 1):
        for i in range(segments):
            a = r * segments + i
            b = r * segments + (i + 1) % segments
            c = (r + 1) * segments + (i + 1) % segments
            d = (r + 1) * segments + i
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


def create_eye(name, x, dna: LittleGuyDNA, material):
    front_y = -dna.head_depth / 2 * 0.86
    obj = cube(
        name,
        (x, front_y - 0.004, dna.eye_center_z),
        (dna.eye_width / 2, 0.009, dna.eye_height / 2),
        material,
        bevel_width=0.006,
    )
    return obj


def build_human(dna: LittleGuyDNA):
    skin = mat("skin_warm_peach", (0.86, 0.55, 0.36, 1))
    shirt = mat("a_frame_shirt_warm_white", (0.88, 0.84, 0.72, 1))
    boxers = mat("boxers_olive", (0.28, 0.33, 0.17, 1))
    eyes = mat("simple_dark_eyes", (0.015, 0.012, 0.01, 1))

    root = bpy.data.objects.new("BaseHumanRoot", None)
    bpy.context.collection.objects.link(root)
    parts = []

    # Head and face from measured StyleDNA.
    parts.append(custom_head("Body_Head", dna, skin))
    parts.append(create_eye("Face_LeftEye", -dna.eye_spacing / 2, dna, eyes))
    parts.append(create_eye("Face_RightEye", dna.eye_spacing / 2, dna, eyes))

    # Ears placed from the style sheet.
    ear_x = dna.head_width / 2 * 0.98
    parts.append(sphere("Body_LeftEar", (-ear_x, 0, dna.ear_center_z), (0.035, 0.024, dna.ear_height / 2), skin, 8, 4))
    parts.append(sphere("Body_RightEar", (ear_x, 0, dna.ear_center_z), (0.035, 0.024, dna.ear_height / 2), skin, 8, 4))

    # Neck and body. Simple for now, but driven by image-derived landmarks.
    parts.append(cylinder("Body_Neck", (0, 0, dna.neck_z - 0.03), 0.045, 0.09, skin, vertices=8))

    parts.append(
        cube(
            "Body_Torso",
            (0, 0, dna.torso_center_z),
            (dna.torso_width / 2, dna.torso_depth / 2, dna.torso_height / 2),
            skin,
            bevel_width=0.025,
        )
    )

    parts.append(
        cube(
            "Clothing_AFrameShirt",
            (0, -0.012, dna.torso_center_z + 0.015),
            (dna.torso_width * 0.54, dna.torso_depth * 0.54, dna.torso_height * 0.43),
            shirt,
            bevel_width=0.02,
        )
    )

    parts.append(
        cube(
            "Clothing_Boxers",
            (0, 0, dna.waist_z - 0.035),
            (dna.hip_width / 2, dna.torso_depth * 0.52, 0.055),
            boxers,
            bevel_width=0.02,
        )
    )

    # Arms: short, chunky, hanging naturally. We keep these as cylinders until mesh piece v001.
    shoulder_x = dna.shoulder_width / 2
    upper_arm_z = dna.torso_center_z + 0.02
    forearm_z = dna.torso_center_z - 0.17

    parts.append(cylinder("Body_LeftUpperArm", (-shoulder_x, 0, upper_arm_z), dna.arm_radius, dna.arm_length * 0.52, skin, rotation=(0, math.radians(17), 0), vertices=8))
    parts.append(cylinder("Body_RightUpperArm", (shoulder_x, 0, upper_arm_z), dna.arm_radius, dna.arm_length * 0.52, skin, rotation=(0, math.radians(-17), 0), vertices=8))
    parts.append(cylinder("Body_LeftForearm", (-shoulder_x * 1.12, 0, forearm_z), dna.arm_radius * 0.90, dna.arm_length * 0.45, skin, rotation=(0, math.radians(7), 0), vertices=8))
    parts.append(cylinder("Body_RightForearm", (shoulder_x * 1.12, 0, forearm_z), dna.arm_radius * 0.90, dna.arm_length * 0.45, skin, rotation=(0, math.radians(-7), 0), vertices=8))

    parts.append(sphere("Body_LeftHand", (-shoulder_x * 1.18, -0.005, forearm_z - 0.16), (0.046, 0.038, 0.055), skin, 8, 4))
    parts.append(sphere("Body_RightHand", (shoulder_x * 1.18, -0.005, forearm_z - 0.16), (0.046, 0.038, 0.055), skin, 8, 4))

    # Legs and feet.
    leg_center_z = (dna.waist_z - 0.06) / 2
    leg_x = dna.hip_width * 0.22
    parts.append(cylinder("Body_LeftLeg", (-leg_x, 0, leg_center_z), dna.thigh_radius, dna.leg_length, skin, vertices=8))
    parts.append(cylinder("Body_RightLeg", (leg_x, 0, leg_center_z), dna.thigh_radius, dna.leg_length, skin, vertices=8))

    parts.append(cube("Body_LeftFoot", (-leg_x, -dna.foot_length * 0.12, dna.foot_height / 2), (dna.foot_width, dna.foot_length / 2, dna.foot_height / 2), skin, bevel_width=0.018))
    parts.append(cube("Body_RightFoot", (leg_x, -dna.foot_length * 0.12, dna.foot_height / 2), (dna.foot_width, dna.foot_length / 2, dna.foot_height / 2), skin, bevel_width=0.018))

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
