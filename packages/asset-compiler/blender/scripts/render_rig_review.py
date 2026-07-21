import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


NEUTRAL_VIEWS = (
    ("neutral-front", (0.0, -1.0, 0.0)),
    ("neutral-three-quarter-front", (-1.0, -1.0, 0.0)),
    ("neutral-side", (-1.0, 0.0, 0.0)),
    ("neutral-three-quarter-back", (-1.0, 1.0, 0.0)),
    ("neutral-back", (0.0, 1.0, 0.0)),
)

POSED_VIEWS = (
    ("posed-front", (0.0, -1.0, 0.0)),
    ("posed-three-quarter-front", (-1.0, -1.0, 0.0)),
    ("posed-side", (-1.0, 0.0, 0.0)),
)

REVIEW_POSE = {
    "upper_arm.L": (0.0, 0.0, math.radians(42.0)),
    "forearm.L": (math.radians(58.0), 0.0, 0.0),
    "hand.L": (0.0, math.radians(18.0), 0.0),
    "thigh.L": (math.radians(24.0), 0.0, 0.0),
    "shin.L": (math.radians(-46.0), 0.0, 0.0),
    "foot.L": (math.radians(16.0), 0.0, 0.0),
    "neck": (0.0, 0.0, math.radians(8.0)),
    "head": (0.0, 0.0, math.radians(12.0)),
}

ISOLATED_POSES = (
    ("isolated-shoulder-front", {"upper_arm.L": (0.0, 0.0, math.radians(45.0))}, (0.0, -1.0, 0.0)),
    ("isolated-elbow-three-quarter", {"forearm.L": (math.radians(62.0), 0.0, 0.0)}, (-1.0, -1.0, 0.0)),
    ("isolated-wrist-front", {"hand.L": (0.0, math.radians(28.0), 0.0)}, (0.0, -1.0, 0.0)),
    ("isolated-hip-side", {"thigh.L": (math.radians(28.0), 0.0, 0.0)}, (-1.0, 0.0, 0.0)),
    ("isolated-knee-side", {"shin.L": (math.radians(-52.0), 0.0, 0.0)}, (-1.0, 0.0, 0.0)),
    ("isolated-ankle-side", {"foot.L": (math.radians(24.0), 0.0, 0.0)}, (-1.0, 0.0, 0.0)),
    ("isolated-neck-three-quarter", {"neck": (0.0, 0.0, math.radians(18.0))}, (-1.0, -1.0, 0.0)),
)


def parse_args():
    parser = argparse.ArgumentParser(description="Render a deterministic rig-review image set")
    parser.add_argument("--input-blend", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--label", required=True)
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def configure_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False

    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_shadows = True
    shading.show_cavity = True
    if hasattr(shading, "cavity_type"):
        shading.cavity_type = "WORLD"
    if hasattr(shading, "show_specular_highlight"):
        shading.show_specular_highlight = False
    if hasattr(shading, "background_type"):
        shading.background_type = "VIEWPORT"
    if hasattr(shading, "background_color"):
        shading.background_color = (0.035, 0.04, 0.05)

    camera_data = bpy.data.cameras.new("RigReviewCamera")
    camera_data.type = "ORTHO"
    camera_data.lens = 50
    camera = bpy.data.objects.new("RigReviewCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return scene, camera


def find_armature():
    armature = bpy.data.objects.get("humanoid-basic-v1")
    if armature is None:
        armature = next((obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"), None)
    if armature is None:
        raise ValueError("Rig review requires an armature object")
    return armature


def set_pose(armature, rotations):
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.rotation_euler = rotations.get(pose_bone.name, (0.0, 0.0, 0.0))
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.scale = (1.0, 1.0, 1.0)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()


def evaluated_bounds():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    if not points:
        raise ValueError("Rig review found no renderable mesh geometry")

    minimum = Vector((
        min(point.x for point in points),
        min(point.y for point in points),
        min(point.z for point in points),
    ))
    maximum = Vector((
        max(point.x for point in points),
        max(point.y for point in points),
        max(point.z for point in points),
    ))
    return minimum, maximum


def position_camera(camera, direction):
    minimum, maximum = evaluated_bounds()
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    horizontal = Vector((direction[0], direction[1], 0.0)).normalized()
    distance = max(size.z, size.x, size.y) * 4.0
    camera.location = center + horizontal * distance + Vector((0.0, 0.0, size.z * 0.02))
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = max(size.z * 1.16, max(size.x, size.y) * 1.45)
    camera.data.clip_start = 0.01
    camera.data.clip_end = max(100.0, distance * 4.0)


def render_view(scene, camera, output_dir, name, direction):
    position_camera(camera, direction)
    output_path = output_dir / f"{name}.png"
    scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)
    return output_path.name


def render_wireframe(scene, camera, output_dir):
    shading = scene.display.shading
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    previous_objects = [(obj, obj.show_wire, obj.show_all_edges) for obj in mesh_objects]
    previous_shading = {
        "show_shadows": shading.show_shadows,
        "show_cavity": shading.show_cavity,
        "color_type": shading.color_type,
        "show_wireframes": getattr(shading, "show_wireframes", None),
    }
    try:
        for obj in mesh_objects:
            obj.show_wire = True
            obj.show_all_edges = True
        if hasattr(shading, "show_wireframes"):
            shading.show_wireframes = True
        shading.show_shadows = False
        shading.show_cavity = False
        shading.color_type = "SINGLE"
        if hasattr(shading, "single_color"):
            shading.single_color = (0.72, 0.74, 0.78)
        return render_view(
            scene,
            camera,
            output_dir,
            "neutral-wireframe-front",
            (0.0, -1.0, 0.0),
        )
    finally:
        for obj, show_wire, show_all_edges in previous_objects:
            obj.show_wire = show_wire
            obj.show_all_edges = show_all_edges
        shading.show_shadows = previous_shading["show_shadows"]
        shading.show_cavity = previous_shading["show_cavity"]
        shading.color_type = previous_shading["color_type"]
        if hasattr(shading, "show_wireframes") and previous_shading["show_wireframes"] is not None:
            shading.show_wireframes = previous_shading["show_wireframes"]


def main():
    args = parse_args()
    if not args.input_blend.is_file():
        raise ValueError(f"Rigged Blend file does not exist: {args.input_blend}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(args.input_blend))
    scene, camera = configure_scene()
    armature = find_armature()

    images = []
    set_pose(armature, {})
    for name, direction in NEUTRAL_VIEWS:
        images.append(render_view(scene, camera, args.output_dir, name, direction))
    images.append(render_wireframe(scene, camera, args.output_dir))

    set_pose(armature, REVIEW_POSE)
    for name, direction in POSED_VIEWS:
        images.append(render_view(scene, camera, args.output_dir, name, direction))

    isolated_manifest = {}
    for name, pose, direction in ISOLATED_POSES:
        set_pose(armature, pose)
        images.append(render_view(scene, camera, args.output_dir, name, direction))
        isolated_manifest[name] = {bone: list(rotation) for bone, rotation in pose.items()}

    set_pose(armature, {})
    manifest = {
        "schema": "rig-review-render/v2",
        "label": args.label,
        "inputBlend": args.input_blend.name,
        "blenderVersion": bpy.app.version_string,
        "rigId": armature.get("rigId", armature.name),
        "reviewPoseRadians": {name: list(rotation) for name, rotation in REVIEW_POSE.items()},
        "isolatedPosesRadians": isolated_manifest,
        "images": images,
    }
    (args.output_dir / "review-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Rendered {len(images)} rig review images to {args.output_dir}")


if __name__ == "__main__":
    main()
