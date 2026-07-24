# Humanoid Basic Animation Pack

`humanoid-basic-v1/default-v1` is the initial reusable animation pack for `humanoid/chibi-v1`.

## Conventions

- Frame rate: 24 fps.
- Coordinate system: Blender Z-up; generated humanoids face negative Y.
- Motion: in-place. Root motion is disabled for every MVP clip.
- Rotation mode: XYZ Euler channels on joints declared by `humanoid-basic-v1`.
- Interpolation: linear, preserving the deliberately simple low-poly motion language.
- Looping: the first and last keyed poses of looping clips are identical.

## Clips

| Clip | Frames | Loop | Purpose |
| --- | ---: | --- | --- |
| `a-pose` | 1 | No | Neutral setup pose with modest shoulder-girdle and upper-arm elevation. |
| `idle` | 1-49 | Yes | Subtle alternating hips/chest sway. |
| `walk` | 1-25 | Yes | Simple in-place opposing arm and leg cycle. |
| `wave` | 1-49 | No | Right arm raise with repeated hand rotation. |

## Stage artifacts

The animate stage consumes `artifacts/rig/humanoid-rigged.blend` and produces:

- `artifacts/animate/humanoid-animated.blend`
- `artifacts/animate/humanoid-animated.glb`
- `artifacts/animate/animation-metadata.json`

The metadata document uses schema `humanoid-animation-pack/v1` and records pack ID, rig ID, frame rate, clip ranges, durations, loop flags, root-motion flags, and targeted joints. Studio clients should use this artifact for clip labels and playback controls rather than duplicating clip definitions.

## Validation

Ordinary CI validates the contract and runner without Blender. Blender-capable CI applies the same pack to compact and tall StyleDNA fixtures, exports GLBs, and verifies that both GLBs contain actions named `a-pose`, `idle`, `walk`, and `wave`.
