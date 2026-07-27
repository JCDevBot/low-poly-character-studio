# Gold-standard Studio vertical slice

This workflow exercises the first coherent `humanoid/chibi-v1` path from a front reference to a validated animated GLB.

## Start locally

```bash
pnpm install
pnpm dev
```

Open the Studio URL printed by the development server. The API must be available at `http://localhost:3001`.

## Exercise the workflow

1. Select **Chibi Humanoid** from the model type catalog.
2. Expand **Reference set**.
3. Choose the canonical front reference at `docs/reference/gold-standard-humanoid-chibi.png`, or use the repository example preset for a non-canonical smoke test.
4. Select **Analyze front reference**.
5. Review the inferred landmarks, confidence, warnings, expected parts, and sampled color regions. Drag landmarks to correct the editable StyleDNA input where needed.
6. Select **Confirm Chibi Humanoid** in the gold-standard build-readiness panel.
7. Open **Validated GLB** and run **Build validated humanoid**.
8. Confirm the persisted model, rig, animate, validate, and export stages complete.
9. Preview and play `a-pose`, `idle`, `walk`, and `wave`.
10. Confirm validation passes before using **Download validated GLB**.

The build action remains unavailable until a front reference has been analyzed and the recommended model type has been explicitly confirmed. Analysis and confirmation are persisted with the reference-set job input.

## Responsive milestone checks

Exercise the integrated workflow at:

- 320 × 568
- 768 × 1024
- 1024 × 768
- 1366 × 768
- 1920 × 1080

At 1366 × 768, also check browser zoom at 125% and 150%. Confirm that:

- the viewport remains the dominant surface;
- the readiness, reference, build, validation, animation, and download controls remain reachable;
- opening and closing reference/build drawers preserves keyboard focus order;
- independently scrollable tool regions remain predictable and do not trap page navigation;
- no essential action overlaps or requires horizontal page scrolling.

## Acceptance boundaries

Automated checks establish readiness-state behavior, persisted inputs, build contracts, GLB validation, and responsive layout evidence. Product-owner testing at the completed vertical-slice milestone remains the appropriate point for subjective visual fidelity, interaction quality, and whether the generated character meets the humanoid chibi gold standard.
