# Modular Pipeline Artifacts

The image-to-GLB compiler exchanges versioned semantic artifacts. Blender consumes repository-owned compiler code plus these plans; jobs never execute arbitrary generated Python.

## Stage sequence

1. `ingest` writes a reference set.
2. `classify` recommends a model type and records confirmation or override.
3. `analyze-view` records view role, orientation, pose, ground line and occlusion.
4. `observe-parts` maps visible evidence to the selected model type's expected-part ontology.
5. `build-part-graph` records parent, attachment and deformation relationships.
6. `derive-style-dna` produces editable model-type-aware values.
7. `plan-model` selects the stable procedural model implementation and settings.
8. `plan-rig` selects the compatible standard skeleton and required joints.
9. `plan-animation` selects the versioned animation pack and clips.
10. `model`, `rig` and `animate` run repository-owned Blender implementations.
11. `validate` writes technical and model-type-specific findings.
12. `export` publishes a portable GLB only after validation passes.

The shared TypeScript contracts are defined in `packages/pipeline-contracts/src/artifacts.ts`.

## Artifact envelope

Every artifact records:

- a stable artifact kind and semantic schema version;
- artifact and job IDs;
- creation time;
- producer implementation ID and version.

Artifacts refer to one another by ID. Source images and generated binaries are external resources identified by URI and hash rather than embedded in contract fixtures.

## Evidence and provenance

Semantic values use an evidence envelope containing:

- `value`, which may be unavailable;
- `origin`: measured, inferred, mirrored, defaulted, user-confirmed, user-overridden or unavailable;
- normalized confidence when meaningful;
- explicit confirmation state;
- optional source artifact IDs and explanatory notes.

This preserves uncertainty and user correction without reducing interpretation to Blender coordinates.

## Artifact responsibilities

- **Reference set:** normalized input slots, media metadata and hashes.
- **Classification:** recommended model type, alternatives and confirmation state.
- **View analysis:** orientation, pose, visible side, ground line and occlusion.
- **Expected-part observations:** observed, inferred, occluded, absent, unknown or unsupported states.
- **Semantic part graph:** expected-part identity, hierarchy, attachment and deformation roles.
- **StyleDNA:** editable, model-type-aware evidence values.
- **Model plan:** stable implementation ID, expected parts and deterministic generation settings.
- **Rig plan:** compatible rig implementation and required joints.
- **Animation plan:** pack implementation, requested clips, frame rate and root-motion convention.
- **Build manifest:** pipeline/model versions, every artifact reference, stage state, outputs and validation reports.
- **Validation report:** pass/fail result plus actionable typed findings.

## Invalidation

An upstream change invalidates every downstream semantic plan and runtime artifact that depends on it. The canonical invalidation table is exported as `invalidatesAfter` from the shared contract module. Prior outputs remain inspectable but cannot be treated as current or downloadable.

Examples:

- changing a reference invalidates classification through export;
- overriding model type invalidates part observations, StyleDNA, all plans and runtime stages;
- changing StyleDNA invalidates model planning through export;
- changing the rig plan invalidates animation planning, rigging, animation, validation and export;
- validation changes invalidate export only.

## Humanoid fixture

The ordinary Node test builds a complete metadata-only front-reference fixture for `humanoid/chibi-v1`. It references `docs/reference/gold-standard-humanoid-chibi.png` by synthetic URI/hash metadata, produces StyleDNA, model, rig and animation plans, and assembles a build manifest without executing Blender or committing duplicated image assets.
