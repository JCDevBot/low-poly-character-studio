# Architecture Direction

## System shape

The product is a pipeline-oriented application with four major runtime surfaces:

1. **Studio UI**: uploads references, selects a model type, edits StyleDNA, previews progress and results, and downloads the final GLB.
2. **Job API**: validates requests, stores job state, invokes pipeline stages, and serves generated artifacts.
3. **Asset compiler**: runs image analysis, procedural modeling, rigging, animation, validation, and export.
4. **Model type registry**: declares which asset types are supported and supplies their type-specific implementations.

The existing React/Vite studio, Express API, Blender scripts, and StyleDNA work are the starting point. The immediate goal is to place those pieces behind stable contracts before adding more generation behavior.

## Pipeline

Every build advances through explicit, persisted stages:

1. `ingest`
2. `analyze`
3. `model`
4. `rig`
5. `animate`
6. `validate`
7. `export`

Each stage receives a versioned job manifest and writes versioned outputs. A failed stage must record an actionable error and preserve prior outputs for inspection.

A build should be resumable from the first incomplete or invalidated stage. Changing an upstream input invalidates downstream outputs.

## Model type registry

Model types should be discoverable through a registry rather than hard-coded UI conditionals. A model type owns its analysis schema, generator, rig, animation library, validation rules, examples, and documentation.

Recommended target structure:

```text
packages/
  pipeline-core/
  model-types/
    humanoid/
      chibi-v1/
        manifest.json
        schema/
        analysis/
        modeling/
        rigging/
        animations/
        validation/
        examples/
  asset-compiler/
  glb-export/
  shared/
```

The current Blender implementation can remain in `packages/asset-compiler` while the registry contract is introduced. Files should be moved only when a focused issue requires it.

## Model type manifest

Each model type exposes a machine-readable manifest similar to:

```json
{
  "id": "humanoid/chibi-v1",
  "name": "Chibi Humanoid",
  "version": "1.0.0",
  "referenceSlots": [
    { "id": "front", "required": true },
    { "id": "side", "required": false },
    { "id": "back", "required": false }
  ],
  "capabilities": {
    "rigged": true,
    "animated": true,
    "materials": true
  },
  "rig": "humanoid-basic-v1",
  "animations": ["a-pose", "idle", "walk", "wave"],
  "output": ["glb"]
}
```

The Studio uses the registry to display available model types, reference slots, expected outputs, controls, and capability badges. The API uses the same registry to validate jobs and resolve stage implementations.

## Intermediate representations

### Build manifest

The build manifest records:

- job ID
- model type and version
- pipeline version
- input references and hashes
- generation settings
- requested animation clips
- current stage and status
- produced artifacts and validation reports

### StyleDNA

StyleDNA is the editable bridge between source images and procedural generation. It should contain normalized, model-type-aware information rather than Blender-specific coordinates alone.

For the humanoid MVP, it should eventually include:

- body proportions and silhouette landmarks
- head and facial placement hints
- limb widths and lengths
- color/material regions
- clothing/accessory declarations
- confidence values
- user overrides

StyleDNA must be versioned and validated against the selected model type schema.

## API direction

The current synchronous build route should evolve toward a job API:

```text
POST /jobs
GET  /jobs/:id
POST /jobs/:id/run
POST /jobs/:id/cancel
GET  /jobs/:id/artifacts
GET  /model-types
GET  /model-types/:id
```

The first implementation may run locally and serially. The contract should not assume that Blender executes inside the web process long term.

## GLB contract

A completed output must:

- be a valid glTF 2.0 binary asset
- use a predictable coordinate system and scale
- contain named mesh, material, skeleton, and animation objects
- have no missing external resources
- include build metadata in glTF extras where practical
- pass automated validation before becoming downloadable

## Testing strategy

Use layered checks:

- schema and contract unit tests without Blender
- deterministic fixture tests for StyleDNA transformations
- Blender smoke tests for each model type
- GLB validation and metadata checks
- browser build and component tests
- golden-image or structural regression tests only where stable enough to be useful

GitHub-hosted CI should validate code that does not require Blender first. A dedicated Blender-capable runner or container can be introduced as a separate task.

## Deployment direction

CI runs on every pull request and push to `main`. Initial continuous delivery creates versioned Studio build artifacts on Git tags. Public hosting and a production Blender worker are separate infrastructure decisions and require explicit review before credentials or paid services are introduced.
