# Local Gold-Standard Vertical Slice

This guide exercises the first coherent `humanoid/chibi-v1` workflow from the approved reference image through a validated animated GLB.

## Requirements

- Node.js 22
- pnpm 9
- Blender available as `blender`, or install the repository-pinned toolchain with `pnpm blender:setup`
- a browser with WebGL support

## Start the Studio

From the repository root:

```bash
pnpm install
pnpm studio
```

The command starts the API at `http://localhost:3001` and the Studio at `http://localhost:5173`. Wait for the terminal to report that the API is ready before using the Studio.

## Run the approved reference

1. Open `http://localhost:5173`.
2. Select **Chibi Humanoid** (`humanoid/chibi-v1`).
3. Add `docs/reference/gold-standard-humanoid-chibi.png` as the required front reference.
4. Run the reference analysis and review the detected view, expected parts, uncertainty, landmarks, and generated StyleDNA.
5. Explicitly confirm `humanoid/chibi-v1`. The complete build remains unavailable until the required reference, analysis, and model-type confirmation are ready.
6. Adjust supported landmarks or StyleDNA values when needed. These edits become the persisted input to the build.
7. Open **Validated GLB** and select **Run complete pipeline**.
8. Observe the persisted `model`, `rig`, `animate`, `validate`, and `export` stage states. A failed stage remains visible with its actionable error.
9. After validation succeeds, inspect the generated model in the browser and play `a-pose`, `idle`, `walk`, and `wave`.
10. Select **Download validated GLB** and verify that one self-contained `.glb` is downloaded. Invalid output must not expose the download action.

A completed run creates one persisted job and uses the resumable `POST /jobs/:id/run` API. Re-running an interrupted persisted job skips stages already marked complete and resumes at the first incomplete stage.

## Human milestone checks

Test the coherent workflow rather than individual implementation PRs.

### Product flow

- A first-time user can understand how to select the model type, add the front reference, confirm the recommendation, and start the build.
- Analysis assumptions, uncertainty, StyleDNA, stage state, validation, clips, and download status remain understandable.
- Failure text gives a practical next action and invalid output is never presented as successful.

### Responsive and interaction checks

Repeat the primary flow at:

- 320 × 568
- 768 × 1024
- 1024 × 768
- 1366 × 768
- 1920 × 1080

At 1366 × 768, also test 125% and 150% browser zoom. Confirm:

- the viewport remains the dominant surface;
- core navigation and build/download actions remain reachable;
- no horizontal page scrolling is required;
- the reference drawer does not permanently shrink the viewport;
- keyboard focus follows a usable order;
- drawers and panels open and close from the keyboard;
- independently scrollable panels remain predictable and do not trap page navigation.

### Generated-asset checks

Compare the result with `docs/gold-standard-humanoid-chibi.md` and the approved source image. Review the front, three-quarter, side, rear, viewport, and wireframe evidence when available. Confirm that the result:

- reads as the intended friendly chibi humanoid;
- remains approximately 2.6–2.8 heads tall;
- preserves the dominant head, compact torso, short sturdy legs, oversized hands and feet, and faceted surface language;
- contains the expected mesh, materials, skeleton, skin, and four animation clips;
- avoids obvious joint collapse during idle, walk, and wave;
- downloads as a portable GLB with no external resource dependency.

Automated structural validation does not establish subjective visual acceptance. Record visual or interaction feedback against issue #27 with the exact browser size, zoom, job ID, stage, and observed result.

## Relevant checks

Run the focused non-Blender checks with:

```bash
pnpm vertical-slice:test
pnpm pipeline-runner:test
pnpm studio-responsive:test
pnpm studio:build
```

Run the manifest-driven Blender smoke path with:

```bash
pnpm manifest-compiler:smoke
```

The full pull-request CI also validates delivery routing, contracts, the Studio build, responsive screenshots, compact and tall manifest compilation, rigging, animations, and generated diagnostics.