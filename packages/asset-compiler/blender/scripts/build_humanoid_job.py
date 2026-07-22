import argparse
import json
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
BLENDER_DIR = SCRIPT_DIR.parent
sys.path.append(str(BLENDER_DIR))

from generator.character_dna import LittleGuyDNA
from generator.presentation_geometry import refine_presentation_geometry
from generator.style_dna import generation_metadata, load_style_dna
from scripts.build_base_human import add_scene_setup, build_human, clear_scene


def parse_args():
    parser = argparse.ArgumentParser(description="Build one humanoid/chibi-v1 model stage")
    parser.add_argument("--style-dna", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--job-id", default="local")
    parser.add_argument("--preset", choices=["little-guy"])
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def save_outputs(output_dir: Path, metadata: dict):
    output_dir.mkdir(parents=True, exist_ok=True)
    blend_path = output_dir / "humanoid.blend"
    glb_path = output_dir / "humanoid.glb"
    metadata_path = output_dir / "generation-metadata.json"

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB")
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    print(f"Saved blend: {blend_path}")
    print(f"Saved glb:   {glb_path}")
    print(f"Saved metadata: {metadata_path}")


def main():
    args = parse_args()
    if args.style_dna and args.preset:
        raise ValueError("Choose either --style-dna or --preset, not both")
    if not args.style_dna and args.preset != "little-guy":
        raise ValueError("A validated --style-dna file is required for normal jobs")

    if args.style_dna:
        dna, style_document = load_style_dna(args.style_dna)
    else:
        dna, style_document = LittleGuyDNA(), None

    metadata = generation_metadata(dna, style_document)
    metadata["jobId"] = args.job_id

    clear_scene()
    root = build_human(dna)
    refine_presentation_geometry(root, dna)
    root["modelTypeId"] = metadata["modelTypeId"]
    root["styleDnaSchema"] = metadata["styleDnaSchema"]
    root["jobId"] = args.job_id
    bpy.context.scene["generationMetadata"] = json.dumps(metadata, sort_keys=True)
    add_scene_setup()
    save_outputs(args.output_dir, metadata)


if __name__ == "__main__":
    main()
