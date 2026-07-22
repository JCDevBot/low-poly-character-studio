import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


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

WORLD_X = (1.0, 0.0, 0.0)
WORLD_Y = (0.0, 1.0, 0.0)

# Pose values are armature-space axis/angle pairs. Converting those axes into
# each bone's rest basis makes the review independent of implicit bone roll.
REVIEW_POSE = {
    "upper_arm.L": (WORLD_Y, math.radians(-42.0)),
    "forearm.L": (WORLD_X, math.radians(58.0)),
    "hand.L": (WORLD_X, math.radians(18.0)),
    "thigh.L": (WORLD_X, math.radians(24.0)),
    "shin.L": (WORLD_X, math.radians(-46.0)),
    "foot.L": (WORLD_X, math.radians(16.0)),
    "neck": (WORLD_Y, math.radians(8.0)),
    "head": (WORLD_Y, math.radians(12.0)),
}

ISOLATED_POSES = (
    ("isolated-shoulder-front", {"upper_arm.L": (WORLD_Y, math.radians(-45.0))}, (0.0, -1.0, 0.0)),
    ("isolated-elbow-three-quarter", {"forearm.L": (WORLD_X, math.radians(62.0))}, (-1.0, -1.0, 0.0)),
    ("isolated-wrist-front", {"hand.L": (WORLD_X, math.radians(28.0))}, (0.0, -1.0, 0.0)),
    ("isolated-hip-side", {"thigh.L": (WORLD_X, math.radians(28.0))}, (-1.0, 0.0, 0.0)),
    ("isolated-knee-side", {"shin.L": (WORLD_X, math.radians(-52.0))}, (-1.0, 0.0, 0.0)),
    ("isolated-ankle-side", {"foot.L": (WORLD_X, math.radians(24.0))}, (-1.0, 0.0, 0.0)),
    ("isolated-neck-three-quarter", {"neck": (WORLD_Y, math.radians(18.0))}, (-1.0, -1.0, 0.0)),
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


def _armature_axis_rotation(pose_bone, axis, angle):
    rest_basis = pose_bone.bone.matrix_local.to_3x3()
    armature_rotation = Matrix.Rotation(angle, 3, Vector(axis))
    local_rotation = rest_basis.inverted() @ armature_rotation @ rest_basis
    return local_rotation.to_quaternion()


def set_pose(armature, rotations):
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in armature.pose.bones:
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.scale = (1.0, 1.0, 1.0)
        pose_bone.rotation_mode = "QUATERNION"
        pose_bone.rotation_quaternion.identity()
        spec = rotations.get(pose_bone.name)
        if spec is not None:
            axis, angle = spec
            pose_bone.rotation_quaternion = _armature_axis_rotation(pose_bone, axis, angle)
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
    """Render evaluated mesh edges as real geometry so CI output is unambiguous."""
    shading = scene.display.shading
    originals = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and not obj.hide_render
    ]
    previous_hidden = [(obj, obj.hide_render) for obj in originals]
    previous_shading = {
        "show_shadows": shading.show_shadows,
        "show_cavity": shading.show_cavity,
        "color_type": shading.color_type,
    }
    depsgraph = bpy.context.evaluated_depsgraph_get()
    minimum, maximum = evaluated_bounds()
    thickness = max(0.0008, (maximum.z - minimum.z) * 0.0011)
    wire_material = bpy.data.materials.new("RigReviewWireMaterial")
    wire_material.diffuse_color = (0.78, 0.80, 0.84, 1.0)
    wire_objects = []

    try:
        for original in originals:
            evaluated = original.evaluated_get(depsgraph)
            mesh_data = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
            wire_object = bpy.data.objects.new(f"RigReviewWire_{original.name}", mesh_data)
            scene.collection.objects.link(wire_object)
            wire_object.matrix_world = evaluated.matrix_world.copy()
            mesh_data.materials.clear()
            mesh_data.materials.append(wire_material)
            modifier = wire_object.modifiers.new("RigReviewWireframe", "WIREFRAME")
            modifier.thickness = thickness
            modifier.use_replace = True
            modifier.use_even_offset = True
            wire_objects.append(wire_object)
            original.hide_render = True

        shading.show_shadows = False
        shading.show_cavity = False
        shading.color_type = "MATERIAL"
        return render_view(
            scene,
            camera,
            output_dir,
            "neutral-wireframe-front",
            (0.0, -1.0, 0.0),
        )
    finally:
        for original, hide_render in previous_hidden:
            original.hide_render = hide_render
        for wire_object in wire_objects:
            mesh_data = wire_object.data
            bpy.data.objects.remove(wire_object, do_unlink=True)
            if mesh_data.users == 0:
                bpy.data.meshes.remove(mesh_data)
        if wire_material.users == 0:
            bpy.data.materials.remove(wire_material)
        shading.show_shadows = previous_shading["show_shadows"]
        shading.show_cavity = previous_shading["show_cavity"]
        shading.color_type = previous_shading["color_type"]


def _pose_manifest(rotations):
    return {
        bone: {"axis": list(axis), "angleRadians": angle}
        for bone, (axis, angle) in rotations.items()
    }


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
        isolated_manifest[name] = _pose_manifest(pose)

    set_pose(armature, {})
    manifest = {
        "schema": "rig-review-render/v3",
        "label": args.label,
        "inputBlend": args.input_blend.name,
        "blenderVersion": bpy.app.version_string,
        "rigId": armature.get("rigId", armature.name),
        "poseSpace": "armature-axis-angle",
        "reviewPose": _pose_manifest(REVIEW_POSE),
        "isolatedPoses": isolated_manifest,
        "wireframeMode": "evaluated-geometry",
        "images": images,
    }
    (args.output_dir / "review-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Rendered {len(images)} rig review images to {args.output_dir}")


if __name__ == "__main__":
    main()
