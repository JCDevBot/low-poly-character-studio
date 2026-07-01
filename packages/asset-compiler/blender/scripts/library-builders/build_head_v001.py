import math
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
BLENDER_DIR = SCRIPT_DIR.parents[1]
ASSET_COMPILER_DIR = BLENDER_DIR.parent

OUT_DIR = ASSET_COMPILER_DIR / "libraries/base-human/head"
BLEND_OUT = OUT_DIR / "head_v001.blend"
GLB_OUT = OUT_DIR / "head_v001.glb"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def mat(name, color):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    return material


def create_head_mesh(material):
    # Custom low-poly head, front faces negative Y.
    # Shape goal: round forehead, soft cheeks, small chin, helmet-friendly cranium.
    rings = [
        # z, half_width, half_depth
        (-0.34, 0.17, 0.14),  # small chin
        (-0.22, 0.28, 0.22),  # jaw / lower cheeks
        (-0.04, 0.34, 0.28),  # cheeks
        (0.16, 0.36, 0.30),   # eye / temple area
        (0.34, 0.32, 0.28),   # upper head
        (0.48, 0.22, 0.20),   # crown
    ]

    segments = 12
    verts = []

    for z, hw, hd in rings:
        for i in range(segments):
            angle = (math.tau * i) / segments

            x = math.cos(angle) * hw
            y = math.sin(angle) * hd

            # Flatten face slightly on front.
            if y < 0:
                y *= 0.82

            # Rounder cheeks, slightly narrower back lower jaw.
            if z < -0.10 and y > 0:
                x *= 0.88

            verts.append((x, y, z))

    top_index = len(verts)
    verts.append((0, 0, 0.56))

    bottom_index = len(verts)
    verts.append((0, -0.02, -0.42))

    faces = []

    # Ring faces
    for r in range(len(rings) - 1):
        for i in range(segments):
            a = r * segments + i
            b = r * segments + (i + 1) % segments
            c = (r + 1) * segments + (i + 1) % segments
            d = (r + 1) * segments + i
            faces.append((a, b, c, d))

    # Top cap
    top_ring_start = (len(rings) - 1) * segments
    for i in range(segments):
        a = top_ring_start + i
        b = top_ring_start + (i + 1) % segments
        faces.append((a, b, top_index))

    # Bottom cap
    for i in range(segments):
        a = i
        b = (i + 1) % segments
        faces.append((bottom_index, b, a))

    mesh = bpy.data.meshes.new("LittleGuyHeadMesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    obj = bpy.data.objects.new("Head_LittleGuy_v001", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_flat()
    obj.select_set(False)

    return obj


def create_eye(name, x, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -0.245, 0.04))
    eye = bpy.context.object
    eye.name = name
    eye.scale = (0.018, 0.012, 0.085)
    eye.data.materials.append(material)

    bevel = eye.modifiers.new("rounded_eye", "BEVEL")
    bevel.width = 0.012
    bevel.segments = 2

    return eye


def create_ear(name, x, material):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=8,
        ring_count=4,
        radius=1,
        location=(x, 0.0, -0.02),
    )
    ear = bpy.context.object
    ear.name = name
    ear.scale = (0.055, 0.035, 0.075)
    ear.data.materials.append(material)
    bpy.ops.object.shade_flat()
    return ear


def add_reference_floor():
    bpy.ops.mesh.primitive_grid_add if False else None


def add_scene():
    bpy.ops.object.light_add(type="AREA", location=(0, -3, 3))
    light = bpy.context.object
    light.name = "Key_Light"
    light.data.energy = 350
    light.data.size = 4

    bpy.ops.object.camera_add(
        location=(0, -2.4, 0.08),
        rotation=(math.radians(88), 0, 0),
    )
    bpy.context.scene.camera = bpy.context.object


def save_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUT))
    bpy.ops.export_scene.gltf(filepath=str(GLB_OUT), export_format="GLB")

    print(f"Saved head blend: {BLEND_OUT}")
    print(f"Saved head glb:   {GLB_OUT}")


def main():
    clear_scene()

    skin = mat("skin_warm_peach", (0.86, 0.55, 0.36, 1))
    eye_mat = mat("eye_dark_brown", (0.02, 0.014, 0.01, 1))

    root = bpy.data.objects.new("HeadAssetRoot", None)
    bpy.context.collection.objects.link(root)

    head = create_head_mesh(skin)
    left_eye = create_eye("Eye_Left", -0.08, eye_mat)
    right_eye = create_eye("Eye_Right", 0.08, eye_mat)
    left_ear = create_ear("Ear_Left", -0.36, skin)
    right_ear = create_ear("Ear_Right", 0.36, skin)

    for obj in [head, left_eye, right_eye, left_ear, right_ear]:
        obj.parent = root

    add_scene()
    save_outputs()


if __name__ == "__main__":
    main()
