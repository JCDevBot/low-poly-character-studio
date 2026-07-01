#!/usr/bin/env bash
set -e

TARGET="human"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -studio|--studio)
      TARGET="studio"
      shift
      ;;
    -human|--human)
      TARGET="human"
      shift
      ;;
    -head|--head)
      TARGET="head"
      shift
      ;;
    -torso|--torso)
      TARGET="torso"
      shift
      ;;
    -arms|--arms)
      TARGET="arms"
      shift
      ;;
    -legs|--legs)
      TARGET="legs"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./scripts/build.sh [-studio|-human|-head|-torso|-arms|-legs]"
      exit 1
      ;;
  esac
done

case "$TARGET" in
  studio)
    echo "Starting Style Studio..."
    pnpm --filter @low-poly-character-studio/style-studio dev
    exit 0
    ;;
  human)
    SCRIPT="packages/asset-compiler/blender/scripts/build_base_human.py"
    ;;
  head)
    SCRIPT="packages/asset-compiler/blender/scripts/library-builders/build_head_v001.py"
    ;;
  torso)
    SCRIPT="packages/asset-compiler/blender/scripts/library-builders/build_torso_v001.py"
    ;;
  arms)
    SCRIPT="packages/asset-compiler/blender/scripts/library-builders/build_arms_v001.py"
    ;;
  legs)
    SCRIPT="packages/asset-compiler/blender/scripts/library-builders/build_legs_v001.py"
    ;;
esac

echo "Building: $TARGET"
echo "Script: $SCRIPT"

if [[ ! -f "$SCRIPT" ]]; then
  echo "Missing Blender script: $SCRIPT"
  exit 1
fi

blender -b --python "$SCRIPT"

echo "Done."
