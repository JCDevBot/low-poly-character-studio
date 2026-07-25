# Responsive Studio review

Issue #41 establishes a viewport-first workspace. The character/reference viewport is the primary surface; references, landmarks, inspection, build, validation, animation, and download remain available through bounded, independently scrollable regions.

## Layout model

- Wide desktop: left landmark tools, dominant center viewport, and right inspector.
- Small desktop and tablet: viewport occupies the first full-width row; tools follow in two independently scrollable regions.
- Narrow windows and phones: viewport remains first; landmark and inspector tools stack below without horizontal page scrolling.
- The reference manager is an overlay drawer, so expansion does not permanently reduce viewport height.
- The validated-GLB launcher is in the stable model header rather than floating over the inspector.

## Required manual review sizes

Capture the selected-model workspace at each size:

- 320 × 568
- 768 × 1024
- 1024 × 768
- 1366 × 768
- 1920 × 1080
- 1366 × 768 at 125% browser zoom
- 1366 × 768 at 150% browser zoom

For every capture verify:

1. the viewport appears before secondary tools and remains the largest single work surface;
2. there is no horizontal page scrolling;
3. reference expansion does not resize the viewport into a narrow strip;
4. all panel content can be reached through its own scrolling region;
5. the validated-GLB launcher does not cover inspector controls;
6. model-type change, reference upload, landmark editing, canvas controls, StyleDNA inspection, build, validation, animation selection, and download remain reachable;
7. keyboard focus can reach the reference drawer controls, canvas controls, landmarks, inspector tabs, and final-build controls.

## Automated coverage

`pnpm studio-responsive:test` checks the shell placement and responsive state contract. `pnpm studio:build` validates the production TypeScript/CSS bundle. Manual screenshots remain required because automated source checks cannot establish subjective information hierarchy or detect every browser-specific overlap.
