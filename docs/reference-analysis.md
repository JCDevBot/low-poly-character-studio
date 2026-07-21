# Humanoid Reference Analysis

The Style Studio provides a local-first analysis adapter for `humanoid/chibi-v1`. It creates an editable starting point from the required front reference without uploading the image or downloading an inference model.

## Contract

Analysis results use `humanoid-reference-analysis/v1` and record:

- model type and adapter identifiers
- source image dimensions
- silhouette bounds
- all landmarks required by the existing StyleDNA editor
- overall and per-landmark confidence values
- dominant color samples for head, torso, and lower-body regions
- explicit warnings for heuristic landmarks, low contrast, or cropped subjects

The Studio resolves analysis through a model-type-keyed adapter registry. Future model types must register their own adapter rather than adding conditionals to the upload interface.

## Initial algorithm

The first adapter is intentionally deterministic and dependency-free:

1. Estimate the background from image corners.
2. Separate foreground pixels using alpha and color distance.
3. Measure the full silhouette and representative horizontal spans.
4. Infer head, eye, shoulder, waist, and foot landmarks from chibi-oriented proportions.
5. Estimate regional colors and confidence.
6. Populate the existing landmark editor, where every inferred marker remains draggable or removable.

This is a useful starting estimate, not exact reconstruction. The Studio always displays uncertainty and asks the user to review markers before generation.

## Failure behavior

Analysis failure does not remove or replace uploaded references. The user can retry after improving the reference or continue with manual landmark placement.

## Validation

Run:

```bash
pnpm reference-analysis:test
pnpm studio:build
```

The contract test uses synthetic humanoid, cropped, blank, and invalid raster fixtures. Browser review should additionally verify upload analysis, visible confidence warnings, and manual marker correction.
