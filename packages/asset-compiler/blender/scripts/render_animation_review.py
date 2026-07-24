import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


REVIEW_FRAMES = {
    "a-pose": (1,),
    "idle": (1, 13, 25, 37, 49),
    "walk": (1, 7, 13, 19, 25),
    "wave": (1, 13, 25, 37, 49),
}


def parse_args():
    parser = argparse.ArgumentParser(description="Render deterministic humanoid animation review frames")
    parser.add_argument("--input-blend", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--label", required=True)
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def configure_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
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

    camera_data = bpy.data.cameras.new("AnimationReviewCamera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("AnimationReviewCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return scene, camera


def find_armature():
    armature = bpy.data.objects.get("humanoid-basic-v1")
    if armature is None:
        armature = next((obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"), None)
    if armature is None:
        raise ValueError("Animation review requires an armature object")
    if armature.animation_data is None:
        armature.animation_data_create()
    return armature


def evaluated_bounds():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    if not points:
        raise ValueError("Animation review found no renderable mesh geometry")
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def position_camera(camera):
    minimum, maximum = evaluated_bounds()
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    direction = Vector((-1.0, -1.0, 0.0)).normalized()
    distance = max(size.z, size.x, size.y) * 4.0
    camera.location = center + direction * distance + Vector((0.0, 0.0, size.z * 0.02))
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = max(size.z * 1.18, max(size.x, size.y) * 1.50)
    camera.data.clip_start = 0.01
    camera.data.clip_end = max(100.0, distance * 4.0)


def action_by_name(name):
    action = bpy.data.actions.get(name)
    if action is None:
        raise ValueError(f"Animation review action not found: {name}")
    return action


def render_frame(scene, camera, armature, output_dir, label, clip, frame):
    armature.animation_data.action = action_by_name(clip)
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    position_camera(camera)
    output_path = output_dir / f"{label}-{clip}-frame-{frame:03d}.png"
    scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)
    return output_path.name


def main():
    args = parse_args()
    if not args.input_blend.is_file():
        raise FileNotFoundError(args.input_blend)
    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
    metadata_names = [clip["name"] for clip in metadata["clips"]]
    if metadata_names != list(REVIEW_FRAMES):
        raise ValueError(f"Unexpected animation metadata clips: {metadata_names}")

    bpy.ops.wm.open_mainfile(filepath=str(args.input_blend))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    scene, camera = configure_scene()
    armature = find_armature()

    rendered = []
    for clip, frames in REVIEW_FRAMES.items():
        for frame in frames:
            rendered.append(render_frame(scene, camera, armature, args.output_dir, args.label, clip, frame))

    armature.animation_data.action = None
    manifest = {
        "schema": "humanoid-animation-review/v1",
        "label": args.label,
        "view": "three-quarter-front",
        "clips": {name: list(frames) for name, frames in REVIEW_FRAMES.items()},
        "renders": rendered,
    }
    (args.output_dir / "review-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Rendered {len(rendered)} animation review frames to {args.output_dir}")


if __name__ == "__main__":
    main()
