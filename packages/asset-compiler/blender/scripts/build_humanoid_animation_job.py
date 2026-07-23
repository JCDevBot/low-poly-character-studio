import argparse
import json
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
BLENDER_DIR = SCRIPT_DIR.parent
sys.path.append(str(BLENDER_DIR))

from generator.animation_pack import apply_animation_pack


def parse_args():
    parser = argparse.ArgumentParser(description="Animate one humanoid-basic-v1 rig artifact")
    parser.add_argument("--input-blend", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--job-id", default="local")
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def main():
    args = parse_args()
    if not args.input_blend.is_file():
        raise ValueError(f"Rig-stage blend does not exist: {args.input_blend}")

    bpy.ops.wm.open_mainfile(filepath=str(args.input_blend))
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise ValueError(f"Expected exactly one animation armature, found {len(armatures)}")
    armature = armatures[0]

    metadata = apply_animation_pack(armature)
    metadata["jobId"] = args.job_id
    metadata["modelTypeId"] = "humanoid/chibi-v1"

    args.output_dir.mkdir(parents=True, exist_ok=True)
    blend_path = args.output_dir / "humanoid-animated.blend"
    glb_path = args.output_dir / "humanoid-animated.glb"
    metadata_path = args.output_dir / "animation-metadata.json"

    bpy.context.scene.render.fps = metadata["fps"]
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
    )
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    print(f"Saved animated blend: {blend_path}")
    print(f"Saved animated GLB:   {glb_path}")
    print(f"Saved animation metadata: {metadata_path}")


if __name__ == "__main__":
    main()
