import argparse
import json
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
BLENDER_DIR = SCRIPT_DIR.parent
sys.path.append(str(BLENDER_DIR))

from generator.rigging import apply_humanoid_rig, write_rig_metadata
from generator.style_dna import load_style_dna


DEFORMATION_PRESERVATION_SCHEMA = "humanoid-deformation-preservation/v1"
DEFORMATION_PRESERVATION_MODIFIER = "humanoid-basic-v1-volume-preservation"


def parse_args():
    parser = argparse.ArgumentParser(description="Rig and skin one humanoid/chibi-v1 model artifact")
    parser.add_argument("--input-blend", type=Path, required=True)
    parser.add_argument("--style-dna", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--job-id", default="local")
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def add_deformation_preservation(armature):
    """Add a bounded post-armature correction for shoulder and hip volume loss.

    The connected Skin/voxel body is intentionally faceted, but its irregular
    joint triangles can fold sharply during basic abduction and flexion. A
    moderate Corrective Smooth modifier after the armature uses the neutral
    generated mesh as the rest reference and reduces those local collapses. It
    remains non-destructive and is evaluated by Blender for review and GLB export.
    """
    body = bpy.data.objects.get("Body_Core")
    if body is None or body.type != "MESH":
        raise ValueError("Rigged humanoid is missing mesh object Body_Core")

    armature_modifiers = [
        modifier
        for modifier in body.modifiers
        if modifier.type == "ARMATURE" and modifier.object == armature
    ]
    if len(armature_modifiers) != 1:
        raise ValueError(
            "Body_Core must have exactly one armature modifier before deformation preservation"
        )

    existing = body.modifiers.get(DEFORMATION_PRESERVATION_MODIFIER)
    if existing is not None:
        body.modifiers.remove(existing)

    modifier = body.modifiers.new(DEFORMATION_PRESERVATION_MODIFIER, "CORRECTIVE_SMOOTH")
    modifier.factor = 0.55
    modifier.iterations = 6
    modifier.smooth_type = "LENGTH_WEIGHTED"
    modifier.rest_source = "ORCO"
    modifier.scale = 1.0
    modifier.use_only_smooth = False
    modifier.use_pin_boundary = False

    modifier_names = [item.name for item in body.modifiers]
    armature_index = modifier_names.index(armature_modifiers[0].name)
    corrective_index = modifier_names.index(modifier.name)
    if corrective_index <= armature_index:
        raise ValueError("Corrective Smooth must follow the armature modifier")

    body["deformationPreservationSchema"] = DEFORMATION_PRESERVATION_SCHEMA
    body["deformationPreservationModifier"] = DEFORMATION_PRESERVATION_MODIFIER
    return {
        "schema": DEFORMATION_PRESERVATION_SCHEMA,
        "object": body.name,
        "modifier": modifier.name,
        "afterArmature": True,
        "factor": modifier.factor,
        "iterations": modifier.iterations,
        "smoothType": modifier.smooth_type,
        "restSource": modifier.rest_source,
    }


def main():
    args = parse_args()
    if not args.input_blend.is_file():
        raise ValueError(f"Model-stage blend does not exist: {args.input_blend}")

    dna, style_document = load_style_dna(args.style_dna)
    bpy.ops.wm.open_mainfile(filepath=str(args.input_blend))
    root = bpy.data.objects.get("BaseHumanRoot")
    if root is None:
        raise ValueError("Model-stage blend is missing BaseHumanRoot")

    armature, metadata = apply_humanoid_rig(root, dna)
    metadata["deformationPreservation"] = add_deformation_preservation(armature)
    metadata["jobId"] = args.job_id
    metadata["modelTypeId"] = style_document["modelTypeId"]
    metadata["styleDnaSchema"] = style_document["schema"]
    root["rigId"] = metadata["rigId"]
    root["rigMetadataSchema"] = metadata["schema"]

    args.output_dir.mkdir(parents=True, exist_ok=True)
    blend_path = args.output_dir / "humanoid-rigged.blend"
    glb_path = args.output_dir / "humanoid-rigged.glb"
    metadata_path = args.output_dir / "rig-metadata.json"

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    for pose_name, rotations in metadata["smokePoses"].items():
        for bone_name, rotation in rotations.items():
            pose_bone = armature.pose.bones.get(bone_name)
            if pose_bone is None:
                raise ValueError(f"Smoke pose {pose_name} references missing joint {bone_name}")
            pose_bone.rotation_mode = "XYZ"
            pose_bone.rotation_euler = rotation
        bpy.context.view_layer.update()
        for pose_bone in armature.pose.bones:
            pose_bone.rotation_euler = (0.0, 0.0, 0.0)
    bpy.ops.object.mode_set(mode="OBJECT")

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB", export_skins=True)
    write_rig_metadata(metadata_path, metadata)

    print(f"Saved rigged blend: {blend_path}")
    print(f"Saved rigged GLB:   {glb_path}")
    print(f"Saved rig metadata: {metadata_path}")


if __name__ == "__main__":
    main()
