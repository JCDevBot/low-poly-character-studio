# Little Guy Style DNA v0.3

These values are a first-pass extraction from the uploaded style/proportion reference.

We are intentionally ignoring gear for the base body pass.

## Normalized values

- Total height: `H`
- Head height: `0.42H`
- Body height, neck to feet: `0.58H`
- Eye top from top: `0.21H`
- Eye center from top: `0.28H`
- Neck from top: `0.44H`
- Waist from top: `0.78H`
- Knee from top: `0.94H`

## Blender conversion

Current script uses:

- `H = 1.40 Blender units`
- `head_height = 0.588`
- `head_center_z = 1.106`
- `eye_center_z = 1.008`
- `neck_z = 0.784`
- `waist_z = 0.308`
- `knee_z = 0.084`

## Current output

Run:

```bash
blender -b --python packages/asset-compiler/blender/scripts/build_base_human.py
```

Output:

```text
packages/asset-compiler/dist/blend/base_human_v003_style_dna.blend
packages/asset-compiler/dist/glb/base_human_v003_style_dna.glb
```

## Notes

The head uses a custom procedural mesh instead of a UV sphere. Limbs are still temporary primitives and should be replaced one piece at a time.
