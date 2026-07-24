# Final GLB Workflow

## Purpose

The Studio can run a local persisted humanoid job through model, rig, animation, validation, and export, then preview and download the validated GLB.

The workflow is currently local-only. GitHub Actions artifacts and local job files are build evidence; they are not a public deployment.

## Prerequisites

- Node.js 22
- pnpm 9.15.9
- the repository-pinned Blender version installed through `pnpm blender:setup`, or a compatible `BLENDER_COMMAND`

## Run locally

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm blender:setup
pnpm dev
```

The local services are:

- Studio: `http://localhost:5173`
- API: `http://localhost:3001`

## Complete the vertical slice

1. Select `humanoid/chibi-v1` in the model type catalog.
2. Load the Little Guy example reference set or choose a front image.
3. Run front-reference analysis, or place every required landmark manually.
4. Review and adjust the landmark markers. The final build reads the current editable marker positions, not only the original automated analysis.
5. Open **Validated GLB** in the lower-right corner.
6. Select **Build validated humanoid**.
7. Observe the persisted stages:
   - model
   - rig
   - animate
   - validate
   - export
8. After validation succeeds, select each animation clip in the browser preview.
9. Use **Download validated GLB** to download the job-scoped portable asset.

## Validation contract

A successful final artifact must:

- be a GLB using glTF 2.0;
- contain at least one mesh;
- contain at least one skin;
- contain at least one animation clip;
- contain no external buffer or image dependencies;
- embed `low-poly-character-studio-build/v1` provenance in `asset.extras`;
- identify the job, model type, pipeline schema, StyleDNA schema, generation settings, and source animation artifact;
- have a persisted validation report;
- be exposed only after both validate and export stages complete.

The export stage rewrites only the GLB JSON chunk to add provenance and preserves the binary chunks containing geometry, materials, rig, and animation data.

A failed validation stage does not expose a preview or successful download URL.

## Persisted artifacts

Local job files are written under:

```text
.workspace/build-jobs/<job-id>/
```

The final artifacts are:

```text
artifacts/validate/final-glb-validation.json
artifacts/export/humanoid-final.glb
artifacts/export/final-artifact.json
```

The API exposes:

```text
GET  /jobs/:id/final
GET  /jobs/:id/final.glb
GET  /jobs/:id/download
POST /jobs/:id/stages/finalize/run
```

## Troubleshooting

- **Landmarks missing:** run analysis or place every required marker before starting the build.
- **API unavailable:** confirm `pnpm dev` is running and the API responds at `/health`.
- **Blender unavailable:** run `pnpm blender:setup` and confirm the configured Blender command works.
- **Stage failed:** inspect the job manifest and stage error under `.workspace/build-jobs/<job-id>/manifest.json`.
- **Validation failed:** inspect `artifacts/validate/final-glb-validation.json`; invalid output is intentionally not downloadable.
- **Preview failed after validation:** verify the browser can reach the job-scoped `final.glb` endpoint and inspect the browser console for Three.js loader errors.
