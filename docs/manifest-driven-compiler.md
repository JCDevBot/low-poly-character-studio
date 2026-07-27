# Manifest-Driven Blender Compiler

The asset compiler has one stable Blender entry point:

```bash
blender --background --factory-startup --python-exit-code 1 \
  --python packages/asset-compiler/blender/scripts/compile_build_manifest.py \
  -- --manifest /absolute/or/relative/path/to/manifest.json
```

The entry point accepts `blender-build-manifest/v1`, validates every referenced artifact before invoking Blender generation, resolves runtime implementation IDs through `packages/model-types/runtime-registry.json`, and then runs the repository-owned model, rig, animation, and review implementations.

## Required manifest fields

```json
{
  "schema": "blender-build-manifest/v1",
  "jobId": "example-job",
  "pipelineVersion": "1.0.0",
  "modelType": { "id": "humanoid/chibi-v1", "version": "1.0.0" },
  "artifacts": {
    "styleDna": "style-dna.json",
    "modelPlan": "model-plan.json",
    "rigPlan": "rig-plan.json",
    "animationPlan": "animation-plan.json"
  },
  "outputDir": "output"
}
```

Paths are resolved relative to the manifest. The referenced plans use the shared `1.0.0` pipeline artifact envelopes and must form a consistent chain:

- the model plan selects the registered model implementation;
- the rig plan references that model plan and selects the registered rig;
- the animation plan references that rig plan and selects the registered pack;
- StyleDNA and every plan must match the manifest job and model type.

Unknown schemas, model types, versions, implementation IDs, broken artifact references, incompatible StyleDNA, or malformed requested clips fail before generation begins.

## Outputs

A successful compile writes stage directories beneath `outputDir`:

- `model/`: model Blend, GLB, and generation metadata;
- `rig/`: rigged Blend, GLB, and rig metadata;
- `animate/`: animated Blend, portable GLB, and clip metadata;
- `review/`: deterministic animation review renders and manifest;
- `compile-result.json`: implementation IDs, source manifest, requested clips, output paths, sizes, and SHA-256 hashes.

Prior stage artifacts remain available when a later stage fails. The compiler does not execute generated Python; every executable path comes from the checked-in runtime registry.

## Validation

Contract validation without Blender:

```bash
pnpm manifest-compiler:test
```

Pinned-Blender compact and tall smoke compilation:

```bash
pnpm blender:setup
pnpm manifest-compiler:smoke
```

The smoke harness generates temporary versioned plans for the existing compact and tall StyleDNA fixtures, runs both through the single manifest entry point, verifies the four requested clips, and checks every recorded output hash and size.
